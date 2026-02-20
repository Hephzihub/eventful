import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { AddTicketTierDto, UpdateTicketTierDto } from './dto/ticket-tier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorators';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService } from 'src/upload/upload.service';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Events')
@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly uploadService: UploadService,
  ) {}

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get all published events with filters
   * Public - anyone can browse
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all published events' })
  @ApiResponse({ status: 200, description: 'List of published events' })
  async getAllEvents(@Query() queryDto: QueryEventsDto) {
    return this.eventService.getAllEvents(queryDto);
  }

  /**
   * Get featured events
   * Public
   */
  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured events' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results to return',
  })
  @ApiResponse({ status: 200, description: 'List of featured events' })
  async getFeaturedEvents(@Query('limit') limit?: number) {
    return this.eventService.getFeaturedEvents(limit);
  }

  /**
   * Get upcoming events
   * Public
   */
  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of upcoming events' })
  async getUpcomingEvents(
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    return this.eventService.getUpcomingEvents(city, category, limit);
  }

  // ==================== PROTECTED ENDPOINTS (ALL USERS) ====================

  /**
   * Get events user has tickets for
   * Requires authentication
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/my-events')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get events the current user has tickets for' })
  @ApiResponse({ status: 200, description: 'User ticket events' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserEvents(@CurrentUser() user: any) {
    // This will be implemented when we create the Tickets module
    return {
      message: 'This endpoint will show events you have tickets for',
      userId: user._id,
    };
  }

  // ==================== CREATOR-ONLY ENDPOINTS ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post(':id/images')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload an image to an event' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'JPEG, PNG or WebP. Max 5MB.' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded, URL appended to event' })
  @ApiResponse({ status: 400, description: 'Invalid file type, size exceeded, or 10 image limit reached' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadEventImage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const imageUrl = await this.uploadService.uploadEventImage(file);
    return this.eventService.addEventImage(id, user._id, imageUrl);
  }

  /**
   * Get creator's own events
   * Only creators
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('creator/my')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get all events created by the authenticated creator',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'published', 'cancelled', 'completed'],
  })
  @ApiResponse({ status: 200, description: 'Creator events list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — creator role required',
  })
  async getCreatorEvents(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.eventService.getCreatorEvents(user._id, status);
  }

  /**
   * Create new event
   * Only creators can create events
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new event (starts as draft)' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — creator role required' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async createEvent(
    @CurrentUser() user: any,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventService.createEvent(user._id, createEventDto);
  }

  /**
   * Get event by slug (public URL)
   * Public - but draft events only visible to creator
   */
  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get event by slug' })
  @ApiParam({ name: 'slug', description: 'URL-friendly event identifier' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventBySlug(@Param('slug') slug: string, @CurrentUser() user?: any) {
    return this.eventService.getEventBySlug(slug, user?._id);
  }

  /**
   * Check ticket availability
   * Public - anyone can check
   */
  @Public()
  @Get(':id/tiers/:tierId/availability')
  @ApiOperation({ summary: 'Check ticket availability for a tier' })
  @ApiParam({ name: 'id',     description: 'MongoDB ObjectId of the event' })
  @ApiParam({ name: 'tierId', description: 'MongoDB ObjectId of the ticket tier' })
  @ApiQuery({ name: 'quantity', required: false, type: Number, description: 'Number of tickets to check. Default: 1' })
  @ApiResponse({ status: 200, description: 'Availability result' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async checkTicketAvailability(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @Query('quantity') quantity: number = 1,
  ) {
    return this.eventService.checkTicketAvailability(id, tierId, quantity);
  }

  /**
   * Add ticket tier to event
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post(':id/tiers')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Add a ticket tier to an event' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({ status: 201, description: 'Tier added successfully' })
  @ApiResponse({ status: 400, description: 'Would exceed capacity or invalid dates' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async addTicketTier(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() tierDto: AddTicketTierDto,
  ) {
    return this.eventService.addTicketTier(id, user._id, tierDto);
  }

  /**
   * Update ticket tier
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Patch(':id/tiers/:tierId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a ticket tier' })
  @ApiParam({ name: 'id',     description: 'MongoDB ObjectId of the event' })
  @ApiParam({ name: 'tierId', description: 'MongoDB ObjectId of the ticket tier' })
  @ApiResponse({ status: 200, description: 'Tier updated successfully' })
  @ApiResponse({ status: 400, description: 'Quantity below sold count' })
  @ApiResponse({ status: 404, description: 'Event or tier not found' })
  async updateTicketTier(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @CurrentUser() user: any,
    @Body() tierDto: UpdateTicketTierDto,
  ) {
    return this.eventService.updateTicketTier(id, tierId, user._id, tierDto);
  }

  /**
   * Remove ticket tier
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Delete(':id/tiers/:tierId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove a ticket tier' })
  @ApiParam({ name: 'id',     description: 'MongoDB ObjectId of the event' })
  @ApiParam({ name: 'tierId', description: 'MongoDB ObjectId of the ticket tier' })
  @ApiResponse({ status: 200, description: 'Tier removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove — tickets already sold' })
  @ApiResponse({ status: 404, description: 'Event or tier not found' })
  async removeTicketTier(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @CurrentUser() user: any,
  ) {
    return this.eventService.removeTicketTier(id, tierId, user._id);
  }

  /**
   * Publish event (change from draft to published)
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post(':id/publish')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Publish a draft event' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({ status: 200, description: 'Event published successfully' })
  @ApiResponse({ status: 400, description: 'Event already published or not ready' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the event creator' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async publishEvent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventService.publishEvent(id, user._id);
  }

  /**
   * Update event
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update an event' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or business rule violated' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the event creator' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async updateEvent(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventService.updateEvent(id, user._id, updateEventDto);
  }

  /**
   * Delete or cancel event
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete event or cancel if tickets have been sold' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({ status: 200, description: 'Event deleted or cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the event creator' })
  @ApiResponse({ status: 404, description: 'Event not found' })

  async deleteEvent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventService.deleteEvent(id, user._id);
  }

  /**
   * Get event by ID
   * Public - but draft events only visible to creator
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventById(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.eventService.getEventById(id, user?._id);
  }
}
