import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument } from './payment.schema';
import { Event, EventDocument } from '../event/event.schema';
import { Ticket, TicketDocument } from '../ticket/ticket.schema';
import { PaystackService } from './paystack.service';
import { TicketService } from '../ticket/ticket.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { QueryPaymentsDto } from './dto/payment-query.dto';
import { EmailService } from 'src/email/email.service';
import { User, UserDocument } from 'src/users/user.schema';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private paystackService: PaystackService,
    private ticketService: TicketService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  // ==================== INITIATE PAYMENT ====================
  async initiatePayment(userId: string, initiateDto: InitiatePaymentDto) {
    const { eventId, tierId, quantity, email, attendees, metadata } = initiateDto;

    // Validate ticket purchase
    const validation = await this.ticketService.validateTicketPurchase(
      userId,
      {
        eventId,
        tierId,
        quantity,
        attendees,
      },
    );

    const { event, tier, subtotal, currency } = validation;

    // Calculate platform fee (only this is passed to customer)
    // Platform absorbs Paystack fees
    const platformFeePercentage = parseFloat(
      this.configService.get<string>('PLATFORM_FEE_PERCENTAGE', '0.025'),
    );
    const platformFee = Math.round(subtotal * platformFeePercentage);

    // Total amount customer pays (subtotal + platform fee only)
    const totalAmount = subtotal + platformFee;

    // Generate unique reference
    const reference = this.generateReference();

    // Callback URL
    const callbackUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    )}/payments/verify?reference=${reference}`;

    // Create payment record
    const payment = new this.paymentModel({
      userId: new Types.ObjectId(userId),
      eventId: new Types.ObjectId(eventId),
      tickets: [
        {
          tierId: new Types.ObjectId(tierId),
          quantity,
          unitPrice: tier.price,
        },
      ],
      amount: totalAmount,
      currency,
      fees: {
        platform: platformFee,
        paystack: 0, // We absorb this, not charged to customer
      },
      paystack: {
        reference,
      },
      status: 'pending',
      customerEmail: email,
      customerName: metadata?.customerName,
      customerPhone: metadata?.customerPhone,
    });

    await payment.save();

    this.logger.log(`Payment created: ${reference} for user ${userId}`);

    // Initialize Paystack transaction
    // Amount in kobo (multiply by 100)
    try {
      const paystackResponse = await this.paystackService.initializeTransaction(
        email,
        totalAmount * 100, // Convert to kobo
        reference,
        callbackUrl,
        {
          ...metadata,
          eventId,
          tierId,
          quantity,
          userId,
        },
      );

      // Update payment with Paystack details
      payment.paystack.accessCode = paystackResponse.access_code;
      await payment.save();

      this.logger.log(`Paystack transaction initialized: ${reference}`);

      return {
        paymentUrl: paystackResponse.authorization_url,
        reference,
        amount: totalAmount,
        breakdown: {
          subtotal,
          platformFee,
          total: totalAmount,
        },
        currency,
      };
    } catch (error) {
      // Mark payment as failed
      payment.status = 'failed';
      payment.failureReason = error.message;
      await payment.save();

      this.logger.error(`Payment initialization failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== HANDLE WEBHOOK ====================
  async handleWebhook(event: string, data: any): Promise<void> {
    this.logger.log(`Webhook received: ${event}`);

    if (event === 'charge.success') {
      await this.handleSuccessfulPayment(data);
    } else if (event === 'charge.failed') {
      await this.handleFailedPayment(data);
    } else if (event === 'refund.processed') {
      await this.handleRefundProcessed(data);
    } else {
      this.logger.log(`Unhandled webhook event: ${event}`);
    }
  }

  private async handleSuccessfulPayment(data: any) {
    const reference = data.reference;

    this.logger.log(`Processing successful payment: ${reference}`);

    // Find payment
    const payment = await this.paymentModel.findOne({
      'paystack.reference': reference,
    });

    if (!payment) {
      this.logger.error(`Payment not found for reference: ${reference}`);
      return;
    }

    // Check if already processed (idempotency)
    if (payment.isWebhookProcessed) {
      this.logger.log(`Webhook already processed for: ${reference}`);
      return;
    }

    // Verify payment with Paystack (double-check)
    try {
      const verification = await this.paystackService.verifyTransaction(reference);

      if (verification.status !== 'success') {
        this.logger.warn(`Payment verification failed: ${reference}`);
        return;
      }

      // Update payment
      payment.status = 'success';
      payment.paidAt = new Date(verification.paid_at);
      payment.paystack.channel = verification.channel;
      payment.paystack.authorization_code = verification.authorization?.authorization_code;
      payment.paystack.card_type = verification.authorization?.card_type;
      payment.paystack.last4 = verification.authorization?.last4;
      payment.isWebhookProcessed = true;
      payment.webhookProcessedAt = new Date();
      payment.paystackResponse = data;

      await payment.save();

      this.logger.log(`Payment updated to success: ${reference}`);

      // Create tickets
      try {
        const ticketInfo = payment.tickets[0];
        const tickets = await this.ticketService.createTicketsAfterPayment(
          payment._id.toString(),
          payment.userId.toString(),
          payment.eventId.toString(),
          ticketInfo.tierId.toString(),
          ticketInfo.quantity,
          data.metadata?.attendees,
        );

        this.logger.log(`${tickets.length} tickets created for payment: ${reference}`);

        const user = await this.userModel.findById(payment.userId.toString());
        const event = await this.eventModel.findById(payment.eventId.toString());

        if (user && event) {
          // Send ticket email
          await this.emailService.sendPaymentReceipt(
            user.email,
            user.profile.fullName,
            payment,
            event,
          ).catch((error) => {
            this.logger.error(`Failed to send payment receipt email: ${error.message}`);
          });
        }
      } catch (error) {
        this.logger.error(`Failed to create tickets: ${error.message}`);
        // Mark for manual review
        payment.needsManualReview = true;
        await payment.save();
      }
    } catch (error) {
      this.logger.error(`Error processing successful payment: ${error.message}`);
    }
  }

  private async handleFailedPayment(data: any) {
    const reference = data.reference;

    this.logger.log(`Processing failed payment: ${reference}`);

    const payment = await this.paymentModel.findOne({
      'paystack.reference': reference,
    });

    if (!payment) {
      this.logger.error(`Payment not found for reference: ${reference}`);
      return;
    }

    payment.status = 'failed';
    payment.failureReason = data.message || 'Payment failed';
    await payment.save();

    this.logger.log(`Payment marked as failed: ${reference}`);

    const user = await this.userModel.findById(payment.userId.toString());
    const event = await this.eventModel.findById(payment.eventId.toString());

    if (user && event) {
      // Send payment failure email
      await this.emailService.sendPaymentFailed(
        user.email,
        user.profile.fullName,
        event,
        payment.paystack.reference,
        payment.failureReason || 'Payment failed',
      ).catch((error) => {
        this.logger.error(`Failed to send payment failure email: ${error.message}`);
      });
    }
  }

  private async handleRefundProcessed(data: any) {
    const reference = data.transaction_reference;

    this.logger.log(`Processing refund: ${reference}`);

    const payment = await this.paymentModel.findOne({
      'paystack.reference': reference,
    });

    if (!payment) {
      this.logger.error(`Payment not found for refund: ${reference}`);
      return;
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundAmount = data.amount / 100; // Convert from kobo
    await payment.save();

    this.logger.log(`Payment refunded: ${reference}`);
  }

  // ==================== VERIFY PAYMENT ====================
  async verifyPayment(reference: string, userId: string) {
    const payment = await this.paymentModel
      .findOne({ 'paystack.reference': reference })
      .populate('eventId')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify ownership
    if (payment.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this payment');
    }

    // If still pending, verify with Paystack
    if (payment.status === 'pending') {
      try {
        const verification = await this.paystackService.verifyTransaction(
          reference,
        );

        if (verification.status === 'success') {
          payment.status = 'success';
          payment.paidAt = new Date(verification.paid_at);
          await payment.save();

          // Trigger ticket creation if not done by webhook
          if (!payment.isWebhookProcessed) {
            const ticketInfo = payment.tickets[0];
            await this.ticketService.createTicketsAfterPayment(
              payment._id.toString(),
              payment.userId.toString(),
              payment.eventId.toString(),
              ticketInfo.tierId.toString(),
              ticketInfo.quantity,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Payment verification failed: ${error.message}`);
      }
    }

    return payment.toJSON();
  }

  // ==================== GET USER PAYMENTS ====================
  async getUserPayments(userId: string, queryDto: QueryPaymentsDto) {
    const { status, eventId, startDate, endDate, page = 1, limit = 20 } = queryDto;

    const query: any = { userId: new Types.ObjectId(userId) };

    if (status) {
      query.status = status;
    }

    if (eventId) {
      query.eventId = new Types.ObjectId(eventId);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const payments = await this.paymentModel
      .find(query)
      .populate('eventId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.paymentModel.countDocuments(query);

    return {
      payments: payments.map((p) => p.toJSON()),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== GET PAYMENT BY ID ====================
  async getPaymentById(paymentId: string, userId: string) {
    const payment = await this.paymentModel
      .findById(paymentId)
      .populate('eventId')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify ownership
    if (payment.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this payment');
    }

    return payment.toJSON();
  }

  // ==================== GET EVENT REVENUE (CREATOR) ====================
  async getEventRevenue(eventId: string, creatorId: string) {
    // Verify event ownership
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You do not own this event');
    }

    // Aggregate payments
    const stats = await this.paymentModel.aggregate([
      {
        $match: {
          eventId: new Types.ObjectId(eventId),
          status: 'success',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          totalTickets: {
            $sum: { $arrayElemAt: ['$tickets.quantity', 0] },
          },
        },
      },
    ]);

    // Get breakdown by tier
    const tierBreakdown = await this.paymentModel.aggregate([
      {
        $match: {
          eventId: new Types.ObjectId(eventId),
          status: 'success',
        },
      },
      { $unwind: '$tickets' },
      {
        $group: {
          _id: '$tickets.tierId',
          revenue: {
            $sum: {
              $multiply: ['$tickets.quantity', '$tickets.unitPrice'],
            },
          },
          tickets: { $sum: '$tickets.quantity' },
        },
      },
    ]);

    const overall = stats[0] || {
      totalRevenue: 0,
      totalPayments: 0,
      totalTickets: 0,
    };

    return {
      overall,
      byTier: tierBreakdown,
    };
  }

  // ==================== PROCESS REFUND ====================
  async processRefund(paymentId: string, reason: string) {
    const payment = await this.paymentModel.findById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'success') {
      throw new BadRequestException('Can only refund successful payments');
    }

    // Process refund via Paystack
    const refund = await this.paystackService.processRefund(
      payment.paystack.reference,
      payment.amount * 100, // Convert to kobo
      reason,
    );

    // Update payment
    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundAmount = payment.amount;
    payment.refundReason = reason;
    await payment.save();

    this.logger.log(`Refund processed: ${payment.paystack.reference}`);

    return {
      message: 'Refund processed successfully',
      payment: payment.toJSON(),
    };
  }

  // ==================== ALL-TIME CREATOR ANALYTICS ====================
  async getCreatorAnalytics(creatorId: string) {
    // Get all events owned by this creator
    const events = await this.eventModel
      .find({ creatorId: new Types.ObjectId(creatorId) })
      .select('_id title status')
      .lean();

    const eventIds = events.map((e) => new Types.ObjectId(e._id as unknown as string));

    if (eventIds.length === 0) {
      return {
        totals: {
          revenue: 0,
          payments: 0,
          tickets: 0,
          scanned: 0,
          uniqueAttendees: 0,
        },
        eventCount: 0,
        events: [],
      };
    }

    // Revenue & payment totals across all events
    const [revenueStats] = await this.paymentModel.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'success' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
        },
      },
    ]);

    // Ticket totals (all statuses) across all events
    const [ticketStats] = await this.ticketModel.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          totalScanned: {
            $sum: { $cond: [{ $ne: ['$scannedAt', null] }, 1, 0] },
          },
          uniqueAttendees: { $addToSet: '$userId' },
        },
      },
    ]);

    // Per-event breakdown
    const perEvent = await this.paymentModel.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'success' } },
      {
        $group: {
          _id: '$eventId',
          revenue: { $sum: '$amount' },
          payments: { $sum: 1 },
        },
      },
    ]);

    // Map event names onto per-event data
    const eventMap = new Map(events.map((e) => [e._id.toString(), e]));
    const perEventWithNames = perEvent.map((e) => ({
      eventId: e._id,
      title: eventMap.get(e._id.toString())?.title ?? 'Unknown',
      status: eventMap.get(e._id.toString())?.status ?? 'unknown',
      revenue: e.revenue,
      payments: e.payments,
    }));

    return {
      totals: {
        revenue: revenueStats?.totalRevenue ?? 0,
        payments: revenueStats?.totalPayments ?? 0,
        tickets: ticketStats?.totalTickets ?? 0,
        scanned: ticketStats?.totalScanned ?? 0,
        uniqueAttendees: ticketStats?.uniqueAttendees?.length ?? 0,
      },
      eventCount: events.length,
      byEvent: perEventWithNames,
    };
  }

  // ==================== HELPER METHODS ====================
  private generateReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `EVT-${timestamp}-${random}`;
  }
}
