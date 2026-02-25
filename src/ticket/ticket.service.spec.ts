import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { Ticket } from './ticket.schema';
import { Event } from '../event/event.schema';
import { User } from '../users/user.schema';
import { QrCodeService } from './qr-code.service';
import { EmailService } from '../email/email.service';

const TICKET_ID = '507f1f77bcf86cd799439016';
const EVENT_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439014';
const CREATOR_ID = '507f1f77bcf86cd799439011';
const TIER_ID = '507f1f77bcf86cd799439015';

const makeTier = (overrides: any = {}) => ({
  _id: { toString: () => TIER_ID },
  name: 'General',
  price: 5000,
  quantity: 100,
  sold: 0,
  currency: 'NGN',
  salesStart: new Date(Date.now() - 3600 * 1000),
  salesEnd: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  ...overrides,
});

const makeUserDoc = () => ({
  email: 'test@example.com',
  profile: { fullName: 'Test User' },
});

const makeEventDoc = (overrides: any = {}) => ({
  _id: EVENT_ID,
  status: 'published',
  creatorId: { toString: () => CREATOR_ID },
  ticketTiers: [makeTier()],
  schedule: { startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeTicketDoc = (overrides: any = {}) => ({
  _id: TICKET_ID,
  userId: {
    _id: { toString: () => USER_ID },
    toString: () => USER_ID,
  },
  eventId: {
    _id: { toString: () => EVENT_ID },
    toString: () => EVENT_ID,
    schedule: { startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
    status: 'published',
    creatorId: { toString: () => CREATOR_ID },
  },
  tierId: { toString: () => TIER_ID },
  status: 'valid',
  scannedAt: null,
  userReminderIntervals: [],
  toJSON: jest.fn().mockReturnValue({ _id: TICKET_ID, status: 'valid' }),
  save: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(undefined),
  markAsScanned: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('TicketService', () => {
  let service: TicketService;
  let ticketModelMock: any;
  let eventModelMock: any;
  let userModelMock: any;
  let qrCodeService: any;
  let emailService: any;

  beforeEach(async () => {
    function TicketModelCtor(this: any, data: any) {
      Object.assign(this, makeTicketDoc(data));
    }
    TicketModelCtor.findById = jest.fn();
    TicketModelCtor.find = jest.fn();
    TicketModelCtor.aggregate = jest.fn();
    TicketModelCtor.countDocuments = jest.fn();
    ticketModelMock = TicketModelCtor;

    function EventModelCtor(this: any, data: any) {
      Object.assign(this, makeEventDoc(data));
    }
    EventModelCtor.findById = jest.fn();
    EventModelCtor.find = jest.fn();
    eventModelMock = EventModelCtor;

    function UserModelCtor(this: any) {}
    UserModelCtor.findById = jest.fn();
    userModelMock = UserModelCtor;

    qrCodeService = {
      generateQRCodeData: jest.fn().mockReturnValue('encrypted-qr'),
      decryptQRCode: jest.fn().mockReturnValue({
        ticketId: TICKET_ID,
        eventId: EVENT_ID,
        timestamp: Date.now() - 1000,
      }),
      verifyQRCode: jest.fn().mockReturnValue(true),
      generateQRCodeImage: jest.fn().mockResolvedValue('data:image/png;base64,abc'),
    };

    emailService = {
      sendTicketConfirmation: jest.fn().mockResolvedValue(undefined),
      sendCancellationConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: getModelToken(Ticket.name), useValue: ticketModelMock },
        { provide: getModelToken(Event.name), useValue: eventModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: QrCodeService, useValue: qrCodeService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── validateTicketPurchase ──────────────────────────────────────────────

  describe('validateTicketPurchase', () => {
    const dto = { eventId: EVENT_ID, tierId: TIER_ID, quantity: 2, attendees: undefined };

    it('returns validation result on success', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      const result = await service.validateTicketPurchase(USER_ID, dto as any);
      expect(result.event).toBeDefined();
      expect(result.subtotal).toBe(10000); // 5000 * 2
    });

    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.validateTicketPurchase(USER_ID, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when event is not published', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc({ status: 'draft' }));
      await expect(service.validateTicketPurchase(USER_ID, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when not enough tickets available', async () => {
      eventModelMock.findById.mockResolvedValue(
        makeEventDoc({ ticketTiers: [makeTier({ quantity: 1, sold: 1 })] }),
      );
      await expect(
        service.validateTicketPurchase(USER_ID, { ...dto, quantity: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when attendees count does not match quantity', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      await expect(
        service.validateTicketPurchase(USER_ID, {
          ...dto,
          quantity: 2,
          attendees: [{ name: 'Only One' }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getTicketById ──────────────────────────────────────────────────────

  describe('getTicketById', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getTicketById(TICKET_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the ticket', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc()),
      });
      await expect(service.getTicketById(TICKET_ID, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('returns ticket JSON when owner requests it', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc()),
      });
      const result = await service.getTicketById(TICKET_ID, USER_ID);
      expect(result).toBeDefined();
    });
  });

  // ─── scanTicket ─────────────────────────────────────────────────────────

  describe('scanTicket', () => {
    it('throws BadRequestException on invalid QR code', async () => {
      qrCodeService.verifyQRCode.mockReturnValue(false);
      await expect(service.scanTicket('bad-qr', CREATOR_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when scanner is not the event creator', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc()),
      });
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      await expect(service.scanTicket('valid-qr', 'not-creator')).rejects.toThrow(ForbiddenException);
    });

    it('returns success:false when ticket is already scanned', async () => {
      const scannedAt = new Date();
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc({ scannedAt })),
      });
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      const result = await service.scanTicket('valid-qr', CREATOR_ID);
      expect(result.success).toBe(false);
      expect(result.message).toContain('already been scanned');
    });

    it('marks ticket as scanned and returns success on first scan', async () => {
      const doc = makeTicketDoc();
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      const result = await service.scanTicket('valid-qr', CREATOR_ID);
      expect(doc.markAsScanned).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // ─── cancelTicket ────────────────────────────────────────────────────────

  describe('cancelTicket', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.cancelTicket(TICKET_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the ticket', async () => {
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc()),
      });
      await expect(service.cancelTicket(TICKET_ID, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when cancelling within 24h of event', async () => {
      const soonEvent = {
        _id: EVENT_ID,
        schedule: { startDate: new Date(Date.now() + 1 * 3600 * 1000) },
        status: 'published',
        creatorId: { toString: () => CREATOR_ID },
      };
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makeTicketDoc({ eventId: soonEvent })),
      });
      eventModelMock.findById.mockResolvedValue(
        makeEventDoc({ schedule: { startDate: new Date(Date.now() + 1 * 3600 * 1000) } }),
      );
      await expect(service.cancelTicket(TICKET_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('successfully cancels valid ticket outside 24h window', async () => {
      const doc = makeTicketDoc();
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      const eventDoc = makeEventDoc({ ticketTiers: [makeTier({ sold: 1 })] });
      eventModelMock.findById.mockResolvedValue(eventDoc);
      userModelMock.findById.mockResolvedValue(makeUserDoc());
      const result = await service.cancelTicket(TICKET_ID, USER_ID);
      expect(doc.cancel).toHaveBeenCalled();
      expect(result.message).toContain('cancelled successfully');
    });
  });

  // ─── setUserReminders ────────────────────────────────────────────────────

  describe('setUserReminders', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      ticketModelMock.findById.mockResolvedValue(null);
      await expect(service.setUserReminders(TICKET_ID, USER_ID, [24])).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the ticket', async () => {
      ticketModelMock.findById.mockResolvedValue(makeTicketDoc());
      await expect(service.setUserReminders(TICKET_ID, 'other-user', [24])).rejects.toThrow(ForbiddenException);
    });

    it('saves deduplicated descending-sorted intervals', async () => {
      const doc = makeTicketDoc();
      ticketModelMock.findById.mockResolvedValue(doc);
      const result = await service.setUserReminders(TICKET_ID, USER_ID, [24, 168, 24, 1]);
      expect(doc.save).toHaveBeenCalled();
      expect(result.intervals).toEqual([168, 24, 1]);
    });
  });

  // ─── clearUserReminders ──────────────────────────────────────────────────

  describe('clearUserReminders', () => {
    it('clears intervals and returns ticketId', async () => {
      const doc = makeTicketDoc({ userReminderIntervals: [24, 168] });
      ticketModelMock.findById.mockResolvedValue(doc);
      const result = await service.clearUserReminders(TICKET_ID, USER_ID);
      expect(doc.userReminderIntervals).toEqual([]);
      expect(doc.save).toHaveBeenCalled();
      expect(result.ticketId).toBe(TICKET_ID);
    });
  });

  // ─── getUserReminders ────────────────────────────────────────────────────

  describe('getUserReminders', () => {
    it('returns intervals for owned ticket', async () => {
      const doc = makeTicketDoc({ userReminderIntervals: [168, 24] });
      ticketModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      const result = await service.getUserReminders(TICKET_ID, USER_ID);
      expect(result.intervals).toEqual([168, 24]);
    });
  });
});