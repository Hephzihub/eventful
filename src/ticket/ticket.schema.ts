import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TicketDocument = Ticket & Document & {
  isValid: boolean;
  isUsed: boolean;
  canBeScanned: boolean;
  toJSON(): Omit<TicketDocument, '__v'>;
  markAsScanned(scannedBy: Types.ObjectId): Promise<TicketDocument>;
  cancel(): Promise<TicketDocument>;
  refund(): Promise<TicketDocument>;
};

// QR Code subdocument schema
@Schema({ _id: false })
export class QRCode {
  @Prop({ required: true })
  data: string; // Encrypted unique identifier

  @Prop({ required: true, default: Date.now })
  generatedAt: Date;
}

@Schema({
  timestamps: true,
  collection: 'tickets',
})
export class Ticket {
  @Prop({ 
    required: true, 
    unique: true, 
    index: true,
    uppercase: true 
  })
  ticketNumber: string; // Format: "TKT-2025-XXXXX"

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  tierId: Types.ObjectId; // References TicketTier within Event

  @Prop({ type: QRCode, required: true })
  qrCode: QRCode;

  @Prop({
    required: true,
    enum: ['valid', 'used', 'cancelled', 'refunded'],
    default: 'valid',
    index: true,
  })
  status: string;

  @Prop()
  scannedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  scannedBy?: Types.ObjectId; // Creator or staff who scanned

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true })
  paymentId: Types.ObjectId;

  // Additional metadata
  @Prop({ trim: true })
  attendeeName?: string; // In case ticket is transferred

  @Prop({ trim: true })
  attendeeEmail?: string;

  @Prop({ trim: true })
  attendeePhone?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// ==================== INDEXES ====================
// Compound indexes for common queries
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ eventId: 1, status: 1 });
TicketSchema.index({ eventId: 1, userId: 1 });
TicketSchema.index({ 'qrCode.data': 1 }, { unique: true });

// ==================== VIRTUAL FIELDS ====================
TicketSchema.virtual('isValid').get(function() {
  return this.status === 'valid';
});

TicketSchema.virtual('isUsed').get(function() {
  return this.status === 'used';
});

TicketSchema.virtual('canBeScanned').get(function() {
  return this.status === 'valid' && !this.scannedAt;
});

// ==================== METHODS ====================
TicketSchema.methods.toJSON = function() {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

// Method to mark ticket as scanned
TicketSchema.methods.markAsScanned = function(scannedBy: Types.ObjectId) {
  if (this.status !== 'valid') {
    throw new Error(`Cannot scan ticket with status: ${this.status}`);
  }
  
  if (this.scannedAt) {
    throw new Error('Ticket has already been scanned');
  }

  this.status = 'used';
  this.scannedAt = new Date();
  this.scannedBy = scannedBy;
  
  return this.save();
};

// Method to cancel ticket
TicketSchema.methods.cancel = function() {
  if (this.status === 'used') {
    throw new Error('Cannot cancel a used ticket');
  }
  
  if (this.status === 'refunded') {
    throw new Error('Cannot cancel a refunded ticket');
  }

  this.status = 'cancelled';
  return this.save();
};

// Method to refund ticket
TicketSchema.methods.refund = function() {
  if (this.status === 'used') {
    throw new Error('Cannot refund a used ticket');
  }

  this.status = 'refunded';
  return this.save();
};

// ==================== STATIC METHODS ====================
TicketSchema.statics.generateTicketNumber = function() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timestamp = Date.now().toString().slice(-5);
  
  return `TKT-${year}-${random}${timestamp}`;
};

// ==================== PRE-SAVE HOOKS ====================
TicketSchema.pre('save', function(next) {
  // Auto-generate ticket number if not provided
  if (!this.ticketNumber) {
    // @ts-ignore - static method
    this.ticketNumber = this.constructor.generateTicketNumber();
  }
});

// ==================== POST-SAVE HOOKS ====================
TicketSchema.post('save', function(doc, next) {
  // Here you could trigger notifications
  // Example: Send email with QR code when ticket is created
  if (doc.status === 'valid' && !doc.scannedAt) {
    // TODO: Trigger email notification with QR code
    console.log(`Ticket ${doc.ticketNumber} created for user ${doc.userId}`);
  }
  
  next();
});