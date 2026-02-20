import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

export type EventDocument = Event & Document & {
  totalTicketsSold: number;
  totalTicketsAvailable: number;
  isSoldOut: boolean;
  ticketsRemaining: number;
  toJSON(): Omit<EventDocument, '__v'>;
};

// Embedded TicketTier schema (nested within Event)
@Schema({ _id: true })
export class TicketTier {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string; // "Regular", "VIP", "VVIP"

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, default: 'NGN' })
  currency: string;

  @Prop({ required: true, min: 0 })
  quantity: number; // Total available

  @Prop({ required: true, default: 0, min: 0 })
  sold: number; // Number sold

  @Prop({ type: [String], default: [] })
  benefits: string[]; // ["Free drink", "Meet & greet", "VIP lounge access"]

  @Prop({ required: true })
  salesStart: Date;

  @Prop({ required: true })
  salesEnd: Date;
}

export const TicketTierSchema = SchemaFactory.createForClass(TicketTier);

// Venue subdocument schema
@Schema({ _id: false })
export class Venue {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, default: 'Nigeria' })
  country: string;

  @Prop({
    type: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    required: false,
    _id: false,
  })
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Schedule subdocument schema
@Schema({ _id: false })
export class Schedule {
  @Prop({ required: true, index: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ required: true, default: 'Africa/Lagos' })
  timezone: string;
}

// Reminders subdocument schema
@Schema({ _id: false })
export class EventReminders {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: [Number], default: [24, 168] }) // [24 hours, 168 hours (7 days)]
  intervals: number[]; // Hours before event
}

// Main Event schema
@Schema({
  timestamps: true,
  collection: 'events',
})
export class Event {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  creatorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug: string; // URL-friendly version of title

  @Prop({ required: true })
  description: string;

  @Prop({
    required: true,
    enum: ['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'],
    index: true,
  })
  category: string;

  @Prop({ type: [String], default: [] })
  images: string[]; // Array of image URLs

  // Event type: physical or online
  @Prop({
    required: true,
    enum: ['physical', 'online', 'hybrid'],
    default: 'physical',
    index: true,
  })
  eventType: string;

  // For physical and hybrid events
  @Prop({
    type: Venue,
    required: function () {
      return this.eventType === 'physical' || this.eventType === 'hybrid';
    },
  })
  venue?: Venue;

  // For online and hybrid events
  @Prop({
    trim: true,
    required: function () {
      return this.eventType === 'online' || this.eventType === 'hybrid';
    },
  })
  meetingLink?: string; // Zoom, Google Meet, Teams, etc.

  @Prop({ type: Schedule, required: true })
  schedule: Schedule;

  @Prop({ type: [TicketTierSchema], required: true })
  ticketTiers: TicketTier[];

  @Prop({ required: true, min: 0 })
  capacity: number; // Total event capacity

  @Prop({ type: EventReminders, default: () => ({}) })
  reminders: EventReminders;

  @Prop({
    required: true,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft',
    index: true,
  })
  status: string;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ default: false })
  isLive: boolean; // Currently happening

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// ==================== INDEXES ====================
// Compound indexes for common queries
EventSchema.index({ creatorId: 1, status: 1 });
EventSchema.index({ status: 1, 'schedule.startDate': 1 });
EventSchema.index({ category: 1, status: 1 });
EventSchema.index({ eventType: 1, status: 1 });
EventSchema.index({ isFeatured: 1, status: 1, 'schedule.startDate': 1 });

// Text index for search functionality
EventSchema.index({ title: 'text', description: 'text' });

// ==================== VIRTUAL FIELDS ====================
// Total tickets sold across all tiers
EventSchema.virtual('totalTicketsSold').get(function () {
  return this.ticketTiers.reduce((total, tier) => total + tier.sold, 0);
});

// Total tickets available across all tiers
EventSchema.virtual('totalTicketsAvailable').get(function () {
  return this.ticketTiers.reduce((total, tier) => total + tier.quantity, 0);
});

// Check if event is sold out
EventSchema.virtual('isSoldOut').get(function () {
  return this.ticketTiers.every((tier) => tier.sold >= tier.quantity);
});

// Tickets remaining
EventSchema.virtual('ticketsRemaining').get(function () {
  return this.ticketTiers.reduce(
    (total, tier) => total + (tier.quantity - tier.sold),
    0,
  );
});

// ==================== METHODS ====================
EventSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

// ==================== PRE-SAVE HOOKS ====================
EventSchema.pre('save', function () {
  // Auto-generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Validate that total capacity matches ticket tier quantities
  const totalTierQuantity = this.ticketTiers.reduce(
    (total, tier) => total + tier.quantity,
    0,
  );

  if (totalTierQuantity > this.capacity) {
    throw new BadRequestException(
      'Total ticket tier quantities cannot exceed event capacity',
    );
  }

  // Ensure venue is provided for physical/hybrid events
  if (
    (this.eventType === 'physical' || this.eventType === 'hybrid') &&
    !this.venue
  ) {
    throw new BadRequestException(
      'Venue is required for physical and hybrid events',
    );
  }

  // Ensure meeting link is provided for online/hybrid events
  if (
    (this.eventType === 'online' || this.eventType === 'hybrid') &&
    !this.meetingLink
  ) {
    throw new BadRequestException(
      'Meeting link is required for online and hybrid events',
    );
  }

  // Validate event dates
  if (this.schedule.startDate >= this.schedule.endDate) {
    throw new BadRequestException('Event end date must be after start date');
  }

  // Validate ticket sales dates per tier
  for (const tier of this.ticketTiers) {
    if (tier.salesStart >= tier.salesEnd) {
      throw new BadRequestException(
        `Ticket tier "${tier.name}" sales end date must be after sales start date`,
      );
    }

    // Fixed: use >= so sales cannot still be open at the exact moment the event starts
    if (tier.salesEnd >= this.schedule.startDate) {
      throw new BadRequestException(
        `Ticket tier "${tier.name}" sales must end before event starts`,
      );
    }
  }
});