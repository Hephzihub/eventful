import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
// import { VerifyPaymentDto } from './dto/payment-query.dto';
import { QueryPaymentsDto } from './dto/payment-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ==================== INITIATE PAYMENT ====================
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Initiate payment for tickets',
    description:
      'Validates purchase, calculates fees, creates payment record, and returns Paystack payment URL. User is redirected to Paystack to complete payment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initialized successfully',
    schema: {
      example: {
        paymentUrl: 'https://checkout.paystack.com/abc123xyz',
        reference: 'EVT-1709212800000-ABC123X',
        amount: 10250,
        breakdown: {
          subtotal: 10000,
          platformFee: 250,
          total: 10250,
        },
        currency: 'NGN',
      },
    },
  })
  @ApiBody({ type: InitiatePaymentDto })
  @ApiResponse({ status: 400, description: 'Validation failed or tickets unavailable' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiatePayment(
    @CurrentUser() user: any,
    @Body() initiateDto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiatePayment(user._id, initiateDto);
  }

  // ==================== VERIFY PAYMENT ====================
  @UseGuards(JwtAuthGuard)
  @Get('verify/:reference')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Verify payment status after redirect from Paystack',
    description:
      'Called after user completes payment on Paystack and is redirected back. Verifies payment status and returns payment details.',
  })
  @ApiParam({
    name: 'reference',
    description: 'Paystack transaction reference',
    example: 'EVT-1709212800000-ABC123X',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    schema: {
      example: {
        _id: '...',
        reference: 'EVT-1709212800000-ABC123X',
        status: 'success',
        amount: 10250,
        eventId: { title: 'Concert'},
        paidAt: '2025-11-01T10:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async verifyPayment(
    @Param('reference') reference: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentService.verifyPayment(reference, user._id);
  }

  // ==================== GET USER PAYMENTS ====================
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get all payments for authenticated user',
    description: 'Returns payment history with filters and pagination',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'success', 'failed', 'refunded'], description: 'Filter by payment status' })
  @ApiQuery({ name: 'eventId', required: false, type: String, description: 'Filter by event ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'List of payments',
    schema: {
      example: {
        payments: [
          {
            _id: '...',
            reference: 'EVT-1709212800000-ABC123X',
            status: 'success',
            amount: 10250,
            eventId: { title: 'Concert'},
          },
        ],
        pagination: {
          total: 15,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPayments(
    @CurrentUser() user: any,
    @Query() queryDto: QueryPaymentsDto,
  ) {
    return this.paymentService.getUserPayments(user._id, queryDto);
  }

  // ==================== GET PAYMENT BY ID ====================
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get payment details by ID',
    description: 'Returns full payment information including event details',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the payment' })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    schema: {
      example: {
        _id: '...',
        reference: 'EVT-1709212800000-ABC123X',
        status: 'success',
        amount: 10250,
        breakdown: {
          subtotal: 10000,
          platformFee: 250,
          total: 10250,
        },
        eventId: { title: 'Concert'},
        tickets: [{ tierId: '...', quantity: 2 }],
        paidAt: '2025-11-01T10:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentService.getPaymentById(id, user._id);
  }

  // ==================== GET EVENT REVENUE (CREATOR ONLY) ====================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('event/:eventId/revenue')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get revenue statistics for an event',
    description:
      'Returns total revenue, payment count, and breakdown by tier. Only event creator can access.',
  })
  @ApiParam({ name: 'eventId', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({
    status: 200,
    description: 'Revenue statistics',
    schema: {
      example: {
        overall: {
          totalRevenue: 1525000,
          totalPayments: 150,
          totalTickets: 300,
        },
        byTier: [
          {
            _id: '507f191e810c19729de860ea',
            revenue: 1000000,
            tickets: 200,
          },
          {
            _id: '507f191e810c19729de860eb',
            revenue: 525000,
            tickets: 100,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventRevenue(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentService.getEventRevenue(eventId, user._id);
  }

  // ==================== ALL-TIME CREATOR ANALYTICS ====================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('creator/analytics')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get all-time analytics for the authenticated creator',
    description:
      'Returns aggregated totals across all events created by this creator: total revenue, payments, tickets sold, QR scans, and unique attendees. Also includes a per-event revenue breakdown.',
  })
  @ApiResponse({
    status: 200,
    description: 'All-time creator analytics',
    schema: {
      example: {
        totals: {
          revenue: 5250000,
          payments: 420,
          tickets: 850,
          scanned: 600,
          uniqueAttendees: 390,
        },
        eventCount: 8,
        byEvent: [
          {
            eventId: '507f191e810c19729de860ea',
            title: 'Jazz Night 2025',
            status: 'completed',
            revenue: 1500000,
            payments: 120,
          },
          {
            eventId: '507f191e810c19729de860eb',
            title: 'Tech Summit',
            status: 'published',
            revenue: 3750000,
            payments: 300,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — creator role required' })
  async getCreatorAnalytics(@CurrentUser() user: any) {
    return this.paymentService.getCreatorAnalytics(user._id);
  }
}
