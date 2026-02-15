import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { AddTicketTierDto, UpdateTicketTierDto } from './dto/ticket-tier.dto';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  // ==================== CREATE EVENT ====================
  async createEvent(creatorId: string, createEventDto: CreateEventDto) {
    // Generate slug if not provided
    const slug = createEventDto.slug || this.generateSlug(createEventDto.title);

    // Check if slug already exists
    const existingEvent = await this.eventModel.findOne({ slug });
    if (existingEvent) {
      throw new ConflictException('Event with this slug already exists');
    }

    // Validate dates
    this.validateEventDates(createEventDto.schedule.startDate, createEventDto.schedule.endDate);

    // Validate ticket tiers
    this.validateTicketTiers(createEventDto.ticketTiers, createEventDto.capacity, new Date(createEventDto.schedule.startDate));

    // Create event
    const event = new this.eventModel({
      ...createEventDto,
      creatorId: new Types.ObjectId(creatorId),
      slug,
      status: 'draft', // All events start as draft
    });

    await event.save();

    return {
      message: 'Event created successfully',
      event: event.toJSON(),
    };
  }

  // ==================== UPDATE EVENT ====================
  async updateEvent(
    eventId: string,
    creatorId: string,
    updateEventDto: UpdateEventDto,
  ) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only update your own events');
    }

    // Check if tickets have been sold
    const ticketsSold = event.ticketTiers.reduce((sum, tier) => sum + tier.sold, 0);

    // Prevent critical changes if tickets sold
    if (ticketsSold > 0) {
      if (updateEventDto.eventType && updateEventDto.eventType !== event.eventType) {
        throw new BadRequestException('Cannot change event type after tickets are sold');
      }

      if (updateEventDto.capacity && updateEventDto.capacity < ticketsSold) {
        throw new BadRequestException(`Cannot reduce capacity below ${ticketsSold} (tickets already sold)`);
      }

      // Check if event is soon (within 7 days)
      const daysUntilEvent = Math.ceil(
        (new Date(event.schedule.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilEvent <= 7 && updateEventDto.schedule) {
        throw new BadRequestException('Cannot change event schedule within 7 days of event when tickets are sold');
      }
    }

    // Validate new slug if provided
    if (updateEventDto.slug && updateEventDto.slug !== event.slug) {
      const existingEvent = await this.eventModel.findOne({ slug: updateEventDto.slug });
      if (existingEvent) {
        throw new ConflictException('Event with this slug already exists');
      }
    }

    // Validate dates if schedule is updated
    if (updateEventDto.schedule) {
      this.validateEventDates(
        updateEventDto.schedule.startDate,
        updateEventDto.schedule.endDate,
      );
    }

    // Validate ticket tiers if updated
    if (updateEventDto.ticketTiers) {
      const capacity = updateEventDto.capacity || event.capacity;
      const startDate = updateEventDto.schedule?.startDate
        ? new Date(updateEventDto.schedule.startDate)
        : event.schedule.startDate;
      
      this.validateTicketTiers(updateEventDto.ticketTiers, capacity, startDate);
    }

    // Update event
    Object.assign(event, updateEventDto);
    await event.save();

    return {
      message: 'Event updated successfully',
      event: event.toJSON(),
    };
  }

  // ==================== DELETE/CANCEL EVENT ====================
  async deleteEvent(eventId: string, creatorId: string) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only delete your own events');
    }

    // Check if tickets have been sold
    const ticketsSold = event.ticketTiers.reduce((sum, tier) => sum + tier.sold, 0);

    if (ticketsSold > 0) {
      // Can't delete, must cancel instead
      event.status = 'cancelled';
      await event.save();

      return {
        message: 'Event cancelled successfully. Ticket holders will be notified.',
        event: event.toJSON(),
      };
    } else {
      // No tickets sold, safe to delete
      await this.eventModel.findByIdAndDelete(eventId);

      return {
        message: 'Event deleted successfully',
      };
    }
  }

  // ==================== PUBLISH EVENT ====================
  async publishEvent(eventId: string, creatorId: string) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only publish your own events');
    }

    // Check if already published
    if (event.status === 'published') {
      throw new BadRequestException('Event is already published');
    }

    // Validate event is complete and ready to publish
    this.validateEventForPublishing(event);

    // Publish event
    event.status = 'published';
    await event.save();

    return {
      message: 'Event published successfully',
      event: event.toJSON(),
    };
  }

  // ==================== GET EVENT BY ID ====================
  async getEventById(eventId: string, userId?: string) {
    const event = await this.eventModel
      .findById(eventId)
      .populate('creatorId', 'email profile.fullName');

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // If event is draft, only creator can view
    if (event.status === 'draft') {
      if (!userId || event.creatorId.toString() !== userId) {
        throw new ForbiddenException('This event is not yet published');
      }
    }

    return event.toJSON();
  }

  // ==================== GET EVENT BY SLUG ====================
  async getEventBySlug(slug: string, userId?: string) {
    const event = await this.eventModel
      .findOne({ slug })
      .populate('creatorId', 'email profile.fullName');

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // If event is draft, only creator can view
    if (event.status === 'draft') {
      if (!userId || event.creatorId.toString() !== userId) {
        throw new ForbiddenException('This event is not yet published');
      }
    }

    return event.toJSON();
  }

  // ==================== GET ALL EVENTS (PUBLIC) ====================
  async getAllEvents(queryDto: QueryEventsDto) {
    const {
      category,
      eventType,
      status = 'published', // Default to published only
      city,
      state,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
      sort = 'date',
      order = 'asc',
      isFeatured,
      isLive,
      excludeSoldOut,
    } = queryDto;

    const query: any = { status };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Event type filter
    if (eventType) {
      query.eventType = eventType;
    }

    // Location filters
    if (city) {
      query['venue.city'] = new RegExp(city, 'i');
    }
    if (state) {
      query['venue.state'] = new RegExp(state, 'i');
    }

    // Date range filters
    if (startDate) {
      query['schedule.startDate'] = { $gte: new Date(startDate) };
    }
    if (endDate) {
      query['schedule.startDate'] = {
        ...query['schedule.startDate'],
        $lte: new Date(endDate),
      };
    }

    // Search in title and description
    if (search) {
      query.$text = { $search: search };
    }

    // Featured filter
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured;
    }

    // Live filter
    if (isLive !== undefined) {
      query.isLive = isLive;
    }

    // Price range filter (check minimum price across all tiers)
    if (minPrice !== undefined || maxPrice !== undefined) {
      query['ticketTiers'] = { $elemMatch: {} };
      if (minPrice !== undefined) {
        query['ticketTiers.$elemMatch.price'] = { $gte: minPrice };
      }
      if (maxPrice !== undefined) {
        query['ticketTiers.$elemMatch.price'] = {
          ...query['ticketTiers.$elemMatch.price'],
          $lte: maxPrice,
        };
      }
    }

    // Build sort object
    const sortObj: any = {};
    if (sort === 'date') {
      sortObj['schedule.startDate'] = order === 'asc' ? 1 : -1;
    } else if (sort === 'price') {
      sortObj['ticketTiers.0.price'] = order === 'asc' ? 1 : -1;
    } else if (sort === 'newest') {
      sortObj.createdAt = -1;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    let events = await this.eventModel
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('creatorId', 'email profile.fullName')
      .exec();

    // Filter out sold out events if requested
    if (excludeSoldOut) {
      events = events.filter((event) => {
        const totalAvailable = event.ticketTiers.reduce(
          (sum, tier) => sum + tier.quantity,
          0
        );
        const totalSold = event.ticketTiers.reduce(
          (sum, tier) => sum + tier.sold,
          0
        );
        return totalSold < totalAvailable;
      });
    }

    const total = await this.eventModel.countDocuments(query);

    return {
      events: events.map((e) => e.toJSON()),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== GET CREATOR'S EVENTS ====================
  async getCreatorEvents(creatorId: string, status?: string) {
    const query: any = { creatorId: new Types.ObjectId(creatorId) };

    if (status) {
      query.status = status;
    }

    const events = await this.eventModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();

    return events.map((e) => e.toJSON());
  }

  // ==================== GET FEATURED EVENTS ====================
  async getFeaturedEvents(limit: number = 10) {
    const events = await this.eventModel
      .find({
        status: 'published',
        isFeatured: true,
        'schedule.startDate': { $gte: new Date() }, // Only upcoming events
      })
      .sort({ 'schedule.startDate': 1 })
      .limit(limit)
      .populate('creatorId', 'email profile.fullName')
      .exec();

    return events.map((e) => e.toJSON());
  }

  // ==================== GET UPCOMING EVENTS ====================
  async getUpcomingEvents(city?: string, category?: string, limit: number = 20) {
    const query: any = {
      status: 'published',
      'schedule.startDate': { $gte: new Date() },
    };

    if (city) {
      query['venue.city'] = new RegExp(city, 'i');
    }

    if (category) {
      query.category = category;
    }

    const events = await this.eventModel
      .find(query)
      .sort({ 'schedule.startDate': 1 })
      .limit(limit)
      .populate('creatorId', 'email profile.fullName')
      .exec();

    return events.map((e) => e.toJSON());
  }

  // ==================== ADD TICKET TIER ====================
  async addTicketTier(
    eventId: string,
    creatorId: string,
    tierDto: AddTicketTierDto,
  ) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only modify your own events');
    }

    // Check capacity
    const currentTotalQuantity = event.ticketTiers.reduce(
      (sum, tier) => sum + tier.quantity,
      0
    );

    if (currentTotalQuantity + tierDto.quantity > event.capacity) {
      throw new BadRequestException(
        `Adding this tier would exceed event capacity of ${event.capacity}`
      );
    }

    // Validate tier dates
    if (new Date(tierDto.salesStart) >= new Date(tierDto.salesEnd)) {
      throw new BadRequestException('Sales end date must be after sales start date');
    }

    if (new Date(tierDto.salesEnd) > event.schedule.startDate) {
      throw new BadRequestException('Ticket sales must end before event starts');
    }

    // Add tier
    event.ticketTiers.push({
      _id: new Types.ObjectId(),
      ...tierDto,
      sold: 0,
    } as any);

    await event.save();

    return {
      message: 'Ticket tier added successfully',
      event: event.toJSON(),
    };
  }

  // ==================== UPDATE TICKET TIER ====================
  async updateTicketTier(
    eventId: string,
    tierId: string,
    creatorId: string,
    tierDto: UpdateTicketTierDto,
  ) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only modify your own events');
    }

    // Find tier
    const tier = event.ticketTiers.find((t) => t._id.toString() === tierId);

    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }

    // Can't reduce quantity below sold
    if (tierDto.quantity !== undefined && tierDto.quantity < tier.sold) {
      throw new BadRequestException(
        `Cannot reduce quantity below ${tier.sold} (already sold)`
      );
    }

    // Update tier
    Object.assign(tier, tierDto);
    await event.save();

    return {
      message: 'Ticket tier updated successfully',
      event: event.toJSON(),
    };
  }

  // ==================== REMOVE TICKET TIER ====================
  async removeTicketTier(eventId: string, tierId: string, creatorId: string) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify ownership
    if (event.creatorId.toString() !== creatorId) {
      throw new ForbiddenException('You can only modify your own events');
    }

    // Find tier
    const tier = event.ticketTiers.find((t) => t._id.toString() === tierId);

    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }

    // Can't remove if tickets sold
    if (tier.sold > 0) {
      throw new BadRequestException(
        `Cannot remove tier with ${tier.sold} tickets sold`
      );
    }

    // Remove tier
    event.ticketTiers = event.ticketTiers.filter(
      (t) => t._id.toString() !== tierId
    );

    await event.save();

    return {
      message: 'Ticket tier removed successfully',
      event: event.toJSON(),
    };
  }

  // ==================== CHECK TICKET AVAILABILITY ====================
  async checkTicketAvailability(
    eventId: string,
    tierId: string,
    quantity: number,
  ) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== 'published') {
      return {
        available: false,
        reason: 'Event is not published',
      };
    }

    const tier = event.ticketTiers.find((t) => t._id.toString() === tierId);

    if (!tier) {
      return {
        available: false,
        reason: 'Ticket tier not found',
      };
    }

    // Check if sales are open
    const now = new Date();
    if (now < new Date(tier.salesStart)) {
      return {
        available: false,
        reason: 'Sales have not started yet',
      };
    }

    if (now > new Date(tier.salesEnd)) {
      return {
        available: false,
        reason: 'Sales have ended',
      };
    }

    // Check availability
    const available = tier.quantity - tier.sold;

    if (available < quantity) {
      return {
        available: false,
        reason: `Only ${available} tickets available`,
      };
    }

    return {
      available: true,
      availableTickets: available,
    };
  }

  // ==================== HELPER METHODS ====================

  private generateSlug(title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Add random suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${slug}-${randomSuffix}`;
  }

  private validateEventDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start <= now) {
      throw new BadRequestException('Event start date must be in the future');
    }

    if (end <= start) {
      throw new BadRequestException('Event end date must be after start date');
    }
  }

  private validateTicketTiers(
    tiers: any[],
    capacity: number,
    eventStartDate: Date,
  ) {
    const totalQuantity = tiers.reduce((sum, tier) => sum + tier.quantity, 0);

    if (totalQuantity > capacity) {
      throw new BadRequestException(
        `Total ticket quantity (${totalQuantity}) exceeds event capacity (${capacity})`
      );
    }

    for (const tier of tiers) {
      const salesStart = new Date(tier.salesStart);
      const salesEnd = new Date(tier.salesEnd);

      if (salesStart >= salesEnd) {
        throw new BadRequestException(
          `Tier "${tier.name}": Sales end date must be after sales start date`
        );
      }

      if (salesEnd > eventStartDate) {
        throw new BadRequestException(
          `Tier "${tier.name}": Ticket sales must end before event starts`
        );
      }
    }
  }

  private validateEventForPublishing(event: EventDocument) {
    // Check required fields
    if (!event.title || !event.description || !event.category) {
      throw new BadRequestException('Event must have title, description, and category');
    }

    // Check venue for physical/hybrid
    if ((event.eventType === 'physical' || event.eventType === 'hybrid') && !event.venue) {
      throw new BadRequestException('Physical and hybrid events must have a venue');
    }

    // Check meeting link for online/hybrid
    if ((event.eventType === 'online' || event.eventType === 'hybrid') && !event.meetingLink) {
      throw new BadRequestException('Online and hybrid events must have a meeting link');
    }

    // Check ticket tiers
    if (!event.ticketTiers || event.ticketTiers.length === 0) {
      throw new BadRequestException('Event must have at least one ticket tier');
    }

    // Check event is in future
    if (event.schedule.startDate <= new Date()) {
      throw new BadRequestException('Cannot publish event in the past');
    }
  }
}