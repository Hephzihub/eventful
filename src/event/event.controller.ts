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

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get all published events with filters
   * Public - anyone can browse
   */
  @Public()
  @Get()
  async getAllEvents(@Query() queryDto: QueryEventsDto) {
    return this.eventService.getAllEvents(queryDto);
  }

  /**
   * Get featured events
   * Public
   */
  @Public()
  @Get('featured')
  async getFeaturedEvents(@Query('limit') limit?: number) {
    return this.eventService.getFeaturedEvents(limit);
  }

  /**
   * Get upcoming events
   * Public
   */
  @Public()
  @Get('upcoming')
  async getUpcomingEvents(
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    return this.eventService.getUpcomingEvents(city, category, limit);
  }

  /**
   * Get event by slug (public URL)
   * Public - but draft events only visible to creator
   */
  @Public()
  @Get('slug/:slug')
  async getEventBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: any,
  ) {
    return this.eventService.getEventBySlug(slug, user?._id);
  }

  /**
   * Get event by ID
   * Public - but draft events only visible to creator
   */
  @Public()
  @Get(':id')
  async getEventById(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.eventService.getEventById(id, user?._id);
  }

  // ==================== PROTECTED ENDPOINTS (ALL USERS) ====================

  /**
   * Get events user has tickets for
   * Requires authentication
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/my-events')
  async getUserEvents(@CurrentUser() user: any) {
    // This will be implemented when we create the Tickets module
    // For now, return placeholder
    return {
      message: 'This endpoint will show events you have tickets for',
      userId: user._id,
    };
  }

  // ==================== CREATOR-ONLY ENDPOINTS ====================

  /**
   * Create new event
   * Only creators can create events
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post()
  async createEvent(
    @CurrentUser() user: any,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventService.createEvent(user._id, createEventDto);
  }

  /**
   * Get creator's own events
   * Only creators
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('creator/my')
  async getCreatorEvents(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.eventService.getCreatorEvents(user._id, status);
  }

  /**
   * Update event
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Patch(':id')
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
  async deleteEvent(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.eventService.deleteEvent(id, user._id);
  }

  /**
   * Publish event (change from draft to published)
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post(':id/publish')
  async publishEvent(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.eventService.publishEvent(id, user._id);
  }

  /**
   * Add ticket tier to event
   * Only event creator
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post(':id/tiers')
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
  async removeTicketTier(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @CurrentUser() user: any,
  ) {
    return this.eventService.removeTicketTier(id, tierId, user._id);
  }

  /**
   * Check ticket availability
   * Public - anyone can check
   */
  @Public()
  @Get(':id/tiers/:tierId/availability')
  async checkTicketAvailability(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @Query('quantity') quantity: number = 1,
  ) {
    return this.eventService.checkTicketAvailability(id, tierId, quantity);
  }
}