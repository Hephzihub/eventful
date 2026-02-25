import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from './ticket.schema';
import { Event, EventDocument } from '../event/event.schema';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { QrCodeService } from './qr-code.service';
import { EmailService } from 'src/email/email.service';
import { User, UserDocument } from 'src/users/user.schema';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private qrCodeService: QrCodeService,
    private emailService: EmailService,
  ) {}

  // ==================== VALIDATE TICKET PURCHASE ====================
  async validateTicketPurchase(userId: string, purchaseDto: PurchaseTicketDto) {
    const { eventId, tierId, quantity, attendees } = purchaseDto;

    // Find event
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check event is published
    if (event.status !== 'published') {
      throw new BadRequestException(
        'Event is not available for ticket purchase',
      );
    }

    // Check event hasn't already happened
    if (event.schedule.startDate < new Date()) {
      throw new BadRequestException('Cannot purchase tickets for past events');
    }

    // Find ticket tier
    const tier = event.ticketTiers.find((t) => t._id.toString() === tierId);

    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }

    // Check sales window
    const now = new Date();
    if (now < new Date(tier.salesStart)) {
      throw new BadRequestException('Ticket sales have not started yet');
    }

    if (now > new Date(tier.salesEnd)) {
      throw new BadRequestException('Ticket sales have ended');
    }

    // Check availability
    const available = tier.quantity - tier.sold;
    if (available < quantity) {
      throw new BadRequestException(
        `Only ${available} ticket(s) available for this tier`,
      );
    }

    // Validate attendees array if provided
    if (attendees) {
      if (attendees.length !== quantity) {
        throw new BadRequestException(
          `Attendees array length (${attendees.length}) must match quantity (${quantity})`,
        );
      }
    }

    // Calculate total price
    const subtotal = tier.price * quantity;

    return {
      event,
      tier,
      subtotal,
      currency: tier.currency,
      quantity,
      attendees,
    };
  }

  // ==================== CREATE TICKETS AFTER PAYMENT ====================
  async createTicketsAfterPayment(
    paymentId: string,
    userId: string,
    eventId: string,
    tierId: string,
    quantity: number,
    attendees?: Array<{ name?: string; email?: string; phone?: string }>,
  ) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const tier = event.ticketTiers.find((t) => t._id.toString() === tierId);

    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }

    const tickets: TicketDocument[] = [];

    // Create tickets
    for (let i = 0; i < quantity; i++) {
      // Generate QR code data
      const ticketId = new Types.ObjectId();
      const qrCodeData = this.qrCodeService.generateQRCodeData(
        ticketId.toString(),
        eventId,
      );

      // Get attendee info for this ticket (if provided)
      const attendeeInfo = attendees?.[i];

      const ticket = new this.ticketModel({
        _id: ticketId,
        eventId: new Types.ObjectId(eventId),
        userId: new Types.ObjectId(userId),
        tierId: new Types.ObjectId(tierId),
        paymentId: new Types.ObjectId(paymentId),
        qrCode: {
          data: qrCodeData,
          generatedAt: new Date(),
        },
        status: 'valid',
        attendeeName: attendeeInfo?.name,
        attendeeEmail: attendeeInfo?.email,
        attendeePhone: attendeeInfo?.phone,
      });

      await ticket.save();
      tickets.push(ticket);
    }

    // Update tier sold count
    tier.sold += quantity;
    await event.save();

    const user = await this.userModel.findById(userId);
    if (user) {
      const qrCodes = await Promise.all(
        tickets.map(async (t) => ({
          ticketNumber: t.ticketNumber,
          qrCodeImage: await this.qrCodeService.generateQRCodeImage(
            t.qrCode.data,
          ),
        })),
      );
      await this.emailService
        .sendTicketConfirmation(
          user.email,
          user.profile.fullName,
          event,
          tickets,
          qrCodes,
        )
        .catch((err) =>
          this.logger.error(`Ticket confirmation email failed: ${err.message}`),
        );
    }

    return tickets;
  }

  // ==================== GET USER TICKETS ====================
  async getUserTickets(userId: string, queryDto: QueryTicketsDto) {
    const { status, eventId, upcoming, past, page = 1, limit = 20 } = queryDto;

    const query: any = { userId: new Types.ObjectId(userId) };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by event
    if (eventId) {
      query.eventId = new Types.ObjectId(eventId);
    }

    // Build aggregation pipeline to join with events
    const pipeline: any[] = [
      { $match: query },
      {
        $lookup: {
          from: 'events',
          localField: 'eventId',
          foreignField: '_id',
          as: 'event',
        },
      },
      { $unwind: '$event' },
    ];

    // Filter by upcoming/past events
    if (upcoming) {
      pipeline.push({
        $match: {
          'event.schedule.startDate': { $gte: new Date() },
        },
      });
    }

    if (past) {
      pipeline.push({
        $match: {
          'event.schedule.startDate': { $lt: new Date() },
        },
      });
    }

    // Sort by event date (upcoming first)
    pipeline.push({
      $sort: { 'event.schedule.startDate': 1 },
    });

    // Pagination
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    const tickets = await this.ticketModel.aggregate(pipeline);

    // Get total count
    const totalPipeline = [...pipeline.slice(0, -2)]; // Remove skip and limit
    totalPipeline.push({ $count: 'total' });
    const countResult = await this.ticketModel.aggregate(totalPipeline);
    const total = countResult[0]?.total || 0;

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== GET TICKET BY ID ====================
  async getTicketById(ticketId: string, userId: string) {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('eventId')
      .populate('userId', 'email profile')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify ownership
    if (ticket.userId._id.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    return ticket.toJSON();
  }

  // ==================== SCAN TICKET ====================
  async scanTicket(qrCodeData: string, scannerId: string) {
    // Verify QR code structure
    if (!this.qrCodeService.verifyQRCode(qrCodeData)) {
      throw new BadRequestException('Invalid QR code');
    }

    // Decrypt QR code to get ticket ID
    const payload = this.qrCodeService.decryptQRCode(qrCodeData);
    const { ticketId, eventId } = payload;

    // Find ticket
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('eventId')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify ticket belongs to this event
    if (ticket.eventId._id.toString() !== eventId) {
      throw new BadRequestException('Ticket is not for this event');
    }

    // Get event to verify scanner is creator
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify scanner is event creator
    if (event.creatorId.toString() !== scannerId) {
      throw new ForbiddenException(
        'Only the event creator can scan tickets for this event',
      );
    }

    // Check ticket status
    if (ticket.status !== 'valid') {
      return {
        success: false,
        message: `Ticket is ${ticket.status}`,
        ticket: ticket.toJSON(),
      };
    }

    // Check if already scanned
    if (ticket.scannedAt) {
      return {
        success: false,
        message: 'Ticket has already been scanned',
        scannedAt: ticket.scannedAt,
        ticket: ticket.toJSON(),
      };
    }

    // Mark ticket as scanned
    await ticket.markAsScanned(new Types.ObjectId(scannerId));

    return {
      success: true,
      message: 'Ticket scanned successfully',
      ticket: ticket.toJSON(),
      scannedAt: ticket.scannedAt,
    };
  }

  // ==================== CANCEL TICKET (REFUND) ====================
  async cancelTicket(ticketId: string, userId: string) {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('eventId')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify ownership
    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    // Check if ticket already used
    if (ticket.status === 'used') {
      throw new BadRequestException(
        'Cannot cancel a ticket that has been scanned',
      );
    }

    // Check if ticket already cancelled or refunded
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      throw new BadRequestException('Ticket has already been cancelled');
    }

    // Check refund deadline (24 hours before event)
    const event: any = ticket.eventId;
    const eventStartTime = new Date(event.schedule.startDate).getTime();
    const now = Date.now();
    const hoursUntilEvent = (eventStartTime - now) / (1000 * 60 * 60);

    if (hoursUntilEvent < 24) {
      throw new BadRequestException(
        'Cannot cancel ticket within 24 hours of event start',
      );
    }

    // Cancel ticket
    await ticket.cancel();

    // Update event tier sold count
    const eventDoc = await this.eventModel.findById(event._id);

    if (!eventDoc) {
      throw new NotFoundException('Event not found');
    }

    const tier = eventDoc.ticketTiers.find(
      (t) => t._id.toString() === ticket.tierId.toString(),
    );

    if (tier) {
      tier.sold -= 1;
      await eventDoc.save();
    }

    const user = await this.userModel.findById(userId);

    if (user && tier) {
      // Send cancellation email
      await this.emailService
        .sendCancellationConfirmation(
          user.email,
          user.profile.fullName,
          event,
          ticket,
          tier.price,
        )
        .catch((err) =>
          this.logger.error(`Cancellation email failed: ${err.message}`),
        );
    }

    // TODO: Process refund via payment service
    // await this.paymentService.processRefund(ticket.paymentId);

    return {
      message: 'Ticket cancelled successfully. Refund will be processed.',
      ticket: ticket.toJSON(),
    };
  }

  // ==================== GET EVENT TICKETS (FOR CREATORS) ====================
  async getEventTickets(eventId: string, creatorId: string) {
    // Verify event exists and user is creator
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You do not own this event');
    }

    // Get all tickets for this event
    const tickets = await this.ticketModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .populate('userId', 'email profile')
      .sort({ createdAt: -1 })
      .exec();

    // Calculate statistics
    const stats = {
      total: tickets.length,
      valid: tickets.filter((t) => t.status === 'valid').length,
      used: tickets.filter((t) => t.status === 'used').length,
      cancelled: tickets.filter((t) => t.status === 'cancelled').length,
      refunded: tickets.filter((t) => t.status === 'refunded').length,
      scanned: tickets.filter((t) => t.scannedAt).length,
      byTier: {} as Record<string, number>,
    };

    // Group by tier
    tickets.forEach((ticket) => {
      const tierId = ticket.tierId.toString();
      stats.byTier[tierId] = (stats.byTier[tierId] || 0) + 1;
    });

    return {
      tickets: tickets.map((t) => t.toJSON()),
      stats,
    };
  }

  // ==================== GET TICKET STATISTICS ====================
  async getTicketStats(eventId: string, creatorId: string) {
    // Verify event exists and user is creator
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You do not own this event');
    }

    // Aggregate statistics
    const stats = await this.ticketModel.aggregate([
      { $match: { eventId: new Types.ObjectId(eventId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          valid: {
            $sum: { $cond: [{ $eq: ['$status', 'valid'] }, 1, 0] },
          },
          used: {
            $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          refunded: {
            $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] },
          },
          scanned: {
            $sum: { $cond: [{ $ne: ['$scannedAt', null] }, 1, 0] },
          },
        },
      },
    ]);

    // Get breakdown by tier
    const tierBreakdown = await this.ticketModel.aggregate([
      { $match: { eventId: new Types.ObjectId(eventId) } },
      {
        $group: {
          _id: '$tierId',
          count: { $sum: 1 },
          scanned: {
            $sum: { $cond: [{ $ne: ['$scannedAt', null] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      overall: stats[0] || {
        total: 0,
        valid: 0,
        used: 0,
        cancelled: 0,
        refunded: 0,
        scanned: 0,
      },
      byTier: tierBreakdown,
    };
  }

  // ==================== GENERATE QR CODE IMAGE ====================
  async getTicketQRCodeImage(ticketId: string, userId: string) {
    const ticket = await this.ticketModel.findById(ticketId);

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verify ownership
    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    // Generate QR code image
    const qrCodeImage = await this.qrCodeService.generateQRCodeImage(
      ticket.qrCode.data,
    );

    return {
      ticketNumber: ticket.ticketNumber,
      qrCodeImage, // Base64 data URL
    };
  }

  // ==================== SET USER REMINDER INTERVALS ====================
  async setUserReminders(
    ticketId: string,
    userId: string,
    intervals: number[],
  ) {
    const ticket = await this.ticketModel.findById(ticketId);

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    if (ticket.status !== 'valid') {
      throw new BadRequestException('Can only set reminders on valid tickets');
    }

    const validIntervals = intervals.filter((h) => h > 0);
    ticket.userReminderIntervals = [...new Set(validIntervals)].sort(
      (a, b) => b - a,
    );
    await ticket.save();

    return {
      message: 'Reminders set successfully',
      ticketId: ticket._id,
      intervals: ticket.userReminderIntervals,
    };
  }

  // ==================== CLEAR USER REMINDER INTERVALS ====================
  async clearUserReminders(ticketId: string, userId: string) {
    const ticket = await this.ticketModel.findById(ticketId);

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    ticket.userReminderIntervals = [];
    await ticket.save();

    return {
      message: 'Reminders cleared',
      ticketId: ticket._id,
    };
  }

  // ==================== GET USER REMINDER INTERVALS ====================
  async getUserReminders(ticketId: string, userId: string) {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('eventId', 'title schedule.startDate')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }

    return {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      event: ticket.eventId,
      intervals: ticket.userReminderIntervals,
    };
  }
}
