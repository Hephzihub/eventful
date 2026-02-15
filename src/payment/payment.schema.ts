import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document & {
  subtotal: number;
  totalTickets: number;
  isPaid: boolean;
  isPending: boolean;
  toJSON(): Omit<PaymentDocument, '__v'>;
  markAsSuccessful(paystackResponse: any): Promise<PaymentDocument>;
  markAsFailed(reason: string): Promise<PaymentDocument>;
  refund(amount?: number, reason?: string): Promise<PaymentDocument>;
};

// Ticket purchase details subdocument
@Schema({ _id: false })
export class TicketPurchase {
  @Prop({ type: Types.ObjectId, required: true })
  tierId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

// Fee breakdown subdocument
@Schema({ _id: false })
export class Fees {
  @Prop({ required: true, default: 0, min: 0 })
  platform: number; // Eventful platform fee

  @Prop({ required: true, default: 0, min: 0 })
  paystack: number; // Paystack transaction fee
}

// Paystack payment details subdocument
@Schema({ _id: false })
export class PaystackDetails {
  @Prop({ required: true, unique: true, index: true })
  reference: string; // Paystack transaction reference

  @Prop()
  accessCode?: string; // Paystack access code for payment

  @Prop()
  authorizationCode?: string; // For recurring payments

  @Prop({ enum: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'] })
  channel?: string;

  @Prop()
  cardType?: string; // visa, mastercard, verve

  @Prop()
  last4?: string; // Last 4 digits of card

  @Prop()
  bank?: string; // Bank name for bank transfers

  @Prop()
  accountNumber?: string; // Account number used

  @Prop()
  ipAddress?: string; // Customer IP address
}

@Schema({
  timestamps: true,
  collection: 'payments',
})
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: [TicketPurchase], required: true })
  tickets: TicketPurchase[];

  @Prop({ required: true, min: 0 })
  amount: number; // Total amount paid (including fees)

  @Prop({ required: true, default: 'NGN' })
  currency: string;

  @Prop({ type: Fees, required: true })
  fees: Fees;

  @Prop({ type: PaystackDetails, required: true })
  paystack: PaystackDetails;

  @Prop({
    required: true,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  refundedAt?: Date;

  @Prop()
  refundAmount?: number;

  @Prop()
  refundReason?: string;

  // Additional metadata
  @Prop()
  customerEmail?: string;

  @Prop()
  customerName?: string;

  @Prop()
  customerPhone?: string;

  @Prop()
  failureReason?: string; // If payment failed

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// ==================== INDEXES ====================
// Compound indexes for common queries
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ eventId: 1, status: 1 });
PaymentSchema.index({ userId: 1, eventId: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ 'paystack.reference': 1 }, { unique: true });

// ==================== VIRTUAL FIELDS ====================
// Subtotal (amount before fees)
PaymentSchema.virtual('subtotal').get(function() {
  return this.amount - this.fees.platform - this.fees.paystack;
});

// Total tickets purchased
PaymentSchema.virtual('totalTickets').get(function() {
  return this.tickets.reduce((total, ticket) => total + ticket.quantity, 0);
});

// Check if payment is successful
PaymentSchema.virtual('isPaid').get(function() {
  return this.status === 'success';
});

// Check if payment is pending
PaymentSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

// ==================== METHODS ====================
PaymentSchema.methods.toJSON = function() {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

// Method to mark payment as successful
PaymentSchema.methods.markAsSuccessful = function(paystackResponse: any) {
  this.status = 'success';
  this.paidAt = new Date();
  
  // Update Paystack details
  if (paystackResponse.channel) {
    this.paystack.channel = paystackResponse.channel;
  }
  if (paystackResponse.authorization?.card_type) {
    this.paystack.cardType = paystackResponse.authorization.card_type;
  }
  if (paystackResponse.authorization?.last4) {
    this.paystack.last4 = paystackResponse.authorization.last4;
  }
  if (paystackResponse.authorization?.authorization_code) {
    this.paystack.authorizationCode = paystackResponse.authorization.authorization_code;
  }
  if (paystackResponse.ip_address) {
    this.paystack.ipAddress = paystackResponse.ip_address;
  }
  
  return this.save();
};

// Method to mark payment as failed
PaymentSchema.methods.markAsFailed = function(reason: string) {
  this.status = 'failed';
  this.failureReason = reason;
  
  return this.save();
};

// Method to refund payment
PaymentSchema.methods.refund = function(amount?: number, reason?: string) {
  if (this.status !== 'success') {
    throw new Error('Can only refund successful payments');
  }

  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundAmount = amount || this.amount;
  this.refundReason = reason;
  
  return this.save();
};

// ==================== STATIC METHODS ====================
// Calculate platform fee (e.g., 2.5% of subtotal)
PaymentSchema.statics.calculatePlatformFee = function(subtotal: number): number {
  const feePercentage = 0.025; // 2.5%
  return Math.round(subtotal * feePercentage * 100) / 100;
};

// Calculate Paystack fee (1.5% + 100 NGN, capped at 2000 NGN)
PaymentSchema.statics.calculatePaystackFee = function(amount: number): number {
  const percentage = 0.015; // 1.5%
  const fixedFee = 100; // 100 NGN
  const cap = 2000; // 2000 NGN cap
  
  const fee = (amount * percentage) + fixedFee;
  return Math.min(Math.round(fee * 100) / 100, cap);
};

// Calculate total amount including fees
// PaymentSchema.statics.calculateTotalAmount = function(subtotal: number): {
//   subtotal: number;
//   platformFee: number;
//   paystackFee: number;
//   total: number;
// } {
//   const platformFee = this.calculatePlatformFee(subtotal);
//   const amountWithPlatformFee = subtotal + platformFee;
//   const paystackFee = this.calculatePaystackFee(amountWithPlatformFee);
//   const total = amountWithPlatformFee + paystackFee;

//   return {
//     subtotal,
//     platformFee,
//     paystackFee,
//     total: Math.round(total * 100) / 100,
//   };
// };

// ==================== PRE-SAVE HOOKS ====================
PaymentSchema.pre('save', function(next) {
  // Validate that amount matches ticket prices + fees
  const ticketTotal = this.tickets.reduce(
    (total, ticket) => total + (ticket.quantity * ticket.unitPrice),
    0
  );

  const expectedTotal = ticketTotal + this.fees.platform + this.fees.paystack;
  const difference = Math.abs(this.amount - expectedTotal);

  // Allow small rounding differences (up to 1 NGN)
  if (difference > 1) {
      throw new Error('Payment amount does not match ticket prices plus fees');
  }
});

// ==================== POST-SAVE HOOKS ====================
PaymentSchema.post('save', function(doc, next) {
  // Trigger notifications or webhooks
  if (doc.status === 'success' && doc.paidAt) {
    // TODO: Send payment confirmation email
    // TODO: Trigger ticket generation
    console.log(`Payment ${doc._id} successful for user ${doc.userId}`);
  }
  
  if (doc.status === 'failed') {
    // TODO: Send payment failure notification
    console.log(`Payment ${doc._id} failed: ${doc.failureReason}`);
  }
  
  next();
});