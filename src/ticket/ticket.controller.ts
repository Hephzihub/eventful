import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketsService: TicketService) {}

  // ==================== VALIDATE PURCHASE ====================
  /**
   * Validate ticket purchase (step 1 before payment)
   * Returns purchase details and price calculation
   */
  @UseGuards(JwtAuthGuard)
  @Post('validate-purchase')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Validate ticket purchase before payment',
    description:
      'Step 1: Validates ticket availability, sales window, and calculates total price. Call this before creating payment. Does not create tickets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase validated. Proceed to payment.',
    schema: {
      example: {
        event: { _id: '...', title: 'Concert', },
        tier: { name: 'VIP', price: 15000 },
        subtotal: 30000,
        currency: 'NGN',
        quantity: 2,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed (sold out, sales ended, etc.)' })
  @ApiResponse({ status: 404, description: 'Event or tier not found' })
  async validatePurchase(
    @CurrentUser() user: any,
    @Body() purchaseDto: PurchaseTicketDto,
  ) {
    return this.ticketsService.validateTicketPurchase(user._id, purchaseDto);
  }

  // ==================== GET USER TICKETS ====================
  /**
   * Get all tickets owned by the authenticated user
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get all tickets for the authenticated user',
    description: 'Returns all tickets purchased by the user with event details',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tickets',
    schema: {
      example: {
        tickets: [
          {
            _id: '...',
            ticketNumber: 'TKT-2025-ABC12',
            event: { title: 'Concert' },
            status: 'valid',
            qrCode: { data: '...', generatedAt: '...' },
          },
        ],
        pagination: {
          total: 10,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserTickets(
    @CurrentUser() user: any,
    @Query() queryDto: QueryTicketsDto,
  ) {
    return this.ticketsService.getUserTickets(user._id, queryDto);
  }

  // ==================== GET TICKET BY ID ====================
  /**
   * Get specific ticket details
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get ticket details by ID',
    description: 'Returns full ticket information including QR code',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the ticket' })
  @ApiResponse({
    status: 200,
    description: 'Ticket details',
    schema: {
      example: {
        _id: '...',
        ticketNumber: 'TKT-2025-ABC12',
        event: { title: 'Concert' },
        status: 'valid',
        qrCode: { data: '...', generatedAt: '...' },
        attendeeName: 'John Doe',
        attendeeEmail: 'john@example.com',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.getTicketById(id, user._id);
  }

  // ==================== GET QR CODE IMAGE ====================
  /**
   * Get QR code image for a ticket
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/qr-code')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get QR code image for a ticket',
    description: 'Returns QR code as base64 data URL that can be displayed or printed',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the ticket' })
  @ApiResponse({
    status: 200,
    description: 'QR code image',
    schema: {
      example: {
        ticketNumber: 'TKT-2025-ABC12',
        qrCodeImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketQRCode(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.getTicketQRCodeImage(id, user._id);
  }

  // ==================== CANCEL TICKET ====================
  /**
   * Cancel ticket and request refund
   * Only allowed 24+ hours before event
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Cancel ticket and request refund',
    description:
      'Cancel a ticket at least 24 hours before the event. Ticket status will be updated and refund will be processed.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the ticket' })
  @ApiResponse({
    status: 200,
    description: 'Ticket cancelled successfully',
    schema: {
      example: {
        message: 'Ticket cancelled successfully. Refund will be processed.',
        ticket: { _id: '...', status: 'cancelled' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel (within 24h of event or already scanned)',
  })
  @ApiResponse({ status: 403, description: 'You do not own this ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async cancelTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.cancelTicket(id, user._id);
  }

  // ==================== SCAN TICKET (CREATOR ONLY) ====================
  /**
   * Scan ticket QR code at event entrance
   * Only event creator can scan
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post('scan')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Scan ticket QR code at event entrance',
    description:
      'Creator scans attendee QR code to verify and admit entry. Only the event creator can scan tickets for their events.',
  })
  @ApiResponse({
    status: 200,
    description: 'Scan result',
    schema: {
      examples: {
        success: {
          value: {
            success: true,
            message: 'Ticket scanned successfully',
            ticket: { ticketNumber: 'TKT-2025-ABC12' },
            scannedAt: '2025-08-15T19:30:00Z',
          },
        },
        alreadyScanned: {
          value: {
            success: false,
            message: 'Ticket has already been scanned',
            scannedAt: '2025-08-15T19:15:00Z',
            ticket: { status: 'used'},
          },
        },
        invalidStatus: {
          value: {
            success: false,
            message: 'Ticket is cancelled',
            ticket: { status: 'cancelled' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid QR code' })
  @ApiResponse({
    status: 403,
    description: 'Only the event creator can scan tickets',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async scanTicket(
    @Body() scanDto: ScanTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.scanTicket(scanDto.qrCodeData, user._id);
  }

  // ==================== GET EVENT TICKETS (CREATOR ONLY) ====================
  /**
   * Get all tickets for an event (creator only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('event/:eventId')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get all tickets for an event',
    description:
      'Returns all tickets sold for the event with buyer information. Only event creator can access.',
  })
  @ApiParam({ name: 'eventId', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({
    status: 200,
    description: 'Event tickets and statistics',
    schema: {
      example: {
        tickets: [{ ticketNumber: 'TKT-2025-ABC12' }],
        stats: {
          total: 150,
          valid: 120,
          used: 25,
          cancelled: 3,
          refunded: 2,
          scanned: 25,
          byTier: {
            '507f191e810c19729de860ea': 100,
            '507f191e810c19729de860eb': 50,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventTickets(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.getEventTickets(eventId, user._id);
  }

  // ==================== GET TICKET STATISTICS (CREATOR ONLY) ====================
  /**
   * Get ticket statistics for an event
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('event/:eventId/stats')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get ticket statistics for an event',
    description:
      'Returns aggregated statistics about ticket sales and scanning for the event.',
  })
  @ApiParam({ name: 'eventId', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({
    status: 200,
    description: 'Ticket statistics',
    schema: {
      example: {
        overall: {
          total: 150,
          valid: 120,
          used: 25,
          cancelled: 3,
          refunded: 2,
          scanned: 25,
        },
        byTier: [
          {
            _id: '507f191e810c19729de860ea',
            count: 100,
            scanned: 15,
          },
          {
            _id: '507f191e810c19729de860eb',
            count: 50,
            scanned: 10,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not own this event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getTicketStats(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.getTicketStats(eventId, user._id);
  }
}