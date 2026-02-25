import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './payment.schema';
import { Event } from '../event/event.schema';
import { Ticket } from '../ticket/ticket.schema';
import { PaystackService } from './paystack.service';
import { TicketService } from '../ticket/ticket.service';

const USER_ID = '507f1f77bcf86cd799439014';
const EVENT_ID = '507f1f77bcf86cd799439012';
const PAYMENT_ID = '507f1f77bcf86cd799439013';
const CREATOR_ID = '507f1f77bcf86cd799439011';
const TIER_ID = '507f1f77bcf86cd799439015';
const REF = 'EVT-123-ABC';

const makePaymentDoc = (overrides: any = {}) => ({
  _id: { toString: () => PAYMENT_ID },
  userId: { toString: () => USER_ID },
  eventId: { toString: () => EVENT_ID },
  status: 'pending',
  amount: 10250,
  isWebhookProcessed: false,
  tickets: [{ tierId: { toString: () => TIER_ID }, quantity: 2, unitPrice: 5000 }],
  paystack: { reference: REF },
  toJSON: jest.fn().mockReturnValue({ _id: PAYMENT_ID, status: 'pending' }),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeEventDoc = (overrides: any = {}) => ({
  _id: EVENT_ID,
  status: 'published',
  creatorId: { toString: () => CREATOR_ID },
  ticketTiers: [],
  ...overrides,
});

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentModelMock: any;
  let eventModelMock: any;
  let ticketModelMock: any;
  let paystackService: any;
  let ticketService: any;

  beforeEach(async () => {
    function PaymentModelCtor(this: any, data: any) {
      Object.assign(this, makePaymentDoc(data));
    }
    PaymentModelCtor.findOne = jest.fn();
    PaymentModelCtor.findById = jest.fn();
    PaymentModelCtor.find = jest.fn();
    PaymentModelCtor.aggregate = jest.fn();
    PaymentModelCtor.countDocuments = jest.fn();
    paymentModelMock = PaymentModelCtor;

    function EventModelCtor(this: any) {}
    EventModelCtor.findById = jest.fn();
    EventModelCtor.find = jest.fn();
    eventModelMock = EventModelCtor;

    function TicketModelCtor(this: any) {}
    TicketModelCtor.aggregate = jest.fn();
    ticketModelMock = TicketModelCtor;

    paystackService = {
      initializeTransaction: jest.fn().mockResolvedValue({
        authorization_url: 'https://checkout.paystack.com/abc',
        access_code: 'access-code-1',
        reference: REF,
      }),
      verifyTransaction: jest.fn().mockResolvedValue({
        status: 'success',
        amount: 1025000,
        paid_at: new Date().toISOString(),
        channel: 'card',
        authorization: { authorization_code: 'auth-code', card_type: 'visa', last4: '4242' },
      }),
      processRefund: jest.fn().mockResolvedValue({ id: 'refund-id' }),
    };

    ticketService = {
      validateTicketPurchase: jest.fn().mockResolvedValue({
        event: makeEventDoc(),
        tier: { price: 5000, currency: 'NGN', _id: { toString: () => TIER_ID } },
        subtotal: 10000,
        currency: 'NGN',
        quantity: 2,
      }),
      createTicketsAfterPayment: jest.fn().mockResolvedValue([{}, {}]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: paymentModelMock },
        { provide: getModelToken(Event.name), useValue: eventModelMock },
        { provide: getModelToken(Ticket.name), useValue: ticketModelMock },
        { provide: PaystackService, useValue: paystackService },
        { provide: TicketService, useValue: ticketService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: any) => {
              if (key === 'PLATFORM_FEE_PERCENTAGE') return '0.025';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── initiatePayment ────────────────────────────────────────────────────

  describe('initiatePayment', () => {
    const dto = { eventId: EVENT_ID, tierId: TIER_ID, quantity: 2, email: 'buyer@example.com' };

    it('returns paymentUrl, reference and breakdown on success', async () => {
      const result = await service.initiatePayment(USER_ID, dto as any);
      expect(result.paymentUrl).toBe('https://checkout.paystack.com/abc');
      expect(result.reference).toBeDefined();
      expect(result.breakdown.subtotal).toBe(10000);
      expect(paystackService.initializeTransaction).toHaveBeenCalled();
    });

    it('marks payment as failed when Paystack throws', async () => {
      paystackService.initializeTransaction.mockRejectedValue(new Error('Paystack error'));
      await expect(service.initiatePayment(USER_ID, dto as any)).rejects.toThrow();
    });
  });

  // ─── handleWebhook charge.success ───────────────────────────────────────

  describe('handleWebhook (charge.success)', () => {
    it('processes successful payment and creates tickets', async () => {
      const payment = makePaymentDoc();
      paymentModelMock.findOne.mockResolvedValue(payment);
      await service.handleWebhook('charge.success', { reference: REF });
      expect(payment.status).toBe('success');
      expect(payment.isWebhookProcessed).toBe(true);
      expect(payment.save).toHaveBeenCalled();
      expect(ticketService.createTicketsAfterPayment).toHaveBeenCalled();
    });

    it('is idempotent: skips already-processed webhooks', async () => {
      const payment = makePaymentDoc({ isWebhookProcessed: true });
      paymentModelMock.findOne.mockResolvedValue(payment);
      await service.handleWebhook('charge.success', { reference: REF });
      expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
    });

    it('does nothing when payment not found', async () => {
      paymentModelMock.findOne.mockResolvedValue(null);
      await service.handleWebhook('charge.success', { reference: 'BAD-REF' });
      expect(ticketService.createTicketsAfterPayment).not.toHaveBeenCalled();
    });
  });

  // ─── handleWebhook charge.failed ────────────────────────────────────────

  describe('handleWebhook (charge.failed)', () => {
    it('marks payment as failed', async () => {
      const payment = makePaymentDoc();
      paymentModelMock.findOne.mockResolvedValue(payment);
      await service.handleWebhook('charge.failed', { reference: REF, message: 'Insufficient funds' });
      expect(payment.status).toBe('failed');
      expect(payment.save).toHaveBeenCalled();
    });
  });

  // ─── verifyPayment ──────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('throws NotFoundException when payment not found', async () => {
      paymentModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.verifyPayment(REF, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own payment', async () => {
      paymentModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makePaymentDoc()),
      });
      await expect(service.verifyPayment(REF, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('returns payment JSON when already succeeded without re-verifying', async () => {
      const payment = makePaymentDoc({ status: 'success' });
      paymentModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(payment),
      });
      const result = await service.verifyPayment(REF, USER_ID);
      expect(result).toBeDefined();
      expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
    });

    it('calls Paystack to verify a pending payment and updates status', async () => {
      const payment = makePaymentDoc({ status: 'pending' });
      paymentModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(payment),
      });
      await service.verifyPayment(REF, USER_ID);
      expect(paystackService.verifyTransaction).toHaveBeenCalledWith(REF);
      expect(payment.status).toBe('success');
    });
  });

  // ─── getEventRevenue ────────────────────────────────────────────────────

  describe('getEventRevenue', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.getEventRevenue(EVENT_ID, CREATOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      await expect(service.getEventRevenue(EVENT_ID, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('returns aggregated revenue stats', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      paymentModelMock.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 100000, totalPayments: 10, totalTickets: 20 }])
        .mockResolvedValueOnce([]);
      const result = await service.getEventRevenue(EVENT_ID, CREATOR_ID);
      expect(result.overall).toBeDefined();
    });
  });

  // ─── processRefund ──────────────────────────────────────────────────────

  describe('processRefund', () => {
    it('throws NotFoundException when payment not found', async () => {
      paymentModelMock.findById.mockResolvedValue(null);
      await expect(service.processRefund(PAYMENT_ID, 'reason')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment is not successful', async () => {
      paymentModelMock.findById.mockResolvedValue(makePaymentDoc({ status: 'pending' }));
      await expect(service.processRefund(PAYMENT_ID, 'reason')).rejects.toThrow(BadRequestException);
    });

    it('processes refund and marks payment as refunded', async () => {
      const payment = makePaymentDoc({ status: 'success' });
      paymentModelMock.findById.mockResolvedValue(payment);
      const result = await service.processRefund(PAYMENT_ID, 'User requested');
      expect(payment.status).toBe('refunded');
      expect(payment.save).toHaveBeenCalled();
      expect(result.message).toBe('Refund processed successfully');
    });
  });

  // ─── getCreatorAnalytics ─────────────────────────────────────────────────

  describe('getCreatorAnalytics', () => {
    it('returns zeros when creator has no events', async () => {
      eventModelMock.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      const result = await service.getCreatorAnalytics(CREATOR_ID);
      expect(result.totals.revenue).toBe(0);
      expect(result.eventCount).toBe(0);
    });

    it('returns aggregated totals across all creator events', async () => {
      const events = [{ _id: EVENT_ID, title: 'Concert', status: 'published' }];
      eventModelMock.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(events),
      });
      paymentModelMock.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 50000, totalPayments: 5 }])
        .mockResolvedValueOnce([{ _id: EVENT_ID, revenue: 50000, payments: 5 }]);
      ticketModelMock.aggregate.mockResolvedValue([
        { totalTickets: 10, totalScanned: 8, uniqueAttendees: ['uid-1', 'uid-2'] },
      ]);
      const result = await service.getCreatorAnalytics(CREATOR_ID);
      expect(result.totals.revenue).toBe(50000);
      expect(result.totals.tickets).toBe(10);
      expect(result.totals.uniqueAttendees).toBe(2);
      expect(result.eventCount).toBe(1);
    });
  });
});
