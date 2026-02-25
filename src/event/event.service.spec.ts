import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventService } from './event.service';
import { Event } from './event.schema';

const CREATOR_ID = '507f1f77bcf86cd799439011';
const EVENT_ID = '507f1f77bcf86cd799439012';

const makeTier = (overrides: any = {}) => ({
  _id: { toString: () => 'tier-id-1' },
  name: 'General',
  price: 5000,
  quantity: 100,
  sold: 0,
  currency: 'NGN',
  salesStart: new Date(Date.now() - 3600 * 1000),
  salesEnd: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  ...overrides,
});

const makeEventDoc = (overrides: any = {}) => ({
  _id: EVENT_ID,
  title: 'Test Concert',
  description: 'Test description',
  category: 'music',
  slug: 'test-concert',
  status: 'draft',
  creatorId: { toString: () => CREATOR_ID },
  ticketTiers: [makeTier()],
  capacity: 200,
  eventType: 'in-person',
  schedule: {
    startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
  },
  reminders: { enabled: true, intervals: [24, 168] },
  images: [],
  toJSON: jest.fn().mockReturnValue({ _id: EVENT_ID, title: 'Test Concert' }),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('EventService', () => {
  let service: EventService;
  let eventModelMock: any;

  beforeEach(async () => {
    function EventModelCtor(this: any, data: any) {
      Object.assign(this, makeEventDoc(data));
    }
    EventModelCtor.findOne = jest.fn();
    EventModelCtor.findById = jest.fn();
    EventModelCtor.find = jest.fn();
    EventModelCtor.aggregate = jest.fn();
    EventModelCtor.updateMany = jest.fn();
    eventModelMock = EventModelCtor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getModelToken(Event.name), useValue: eventModelMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') },
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createEvent ────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const dto: any = {
      title: 'New Event',
      slug: 'new-event',
      capacity: 100,
      eventType: 'in-person',
      schedule: {
        startDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString(),
      },
      ticketTiers: [],
    };

    it('creates event and returns message + event', async () => {
      eventModelMock.findOne.mockResolvedValue(null);
      const result = await service.createEvent(CREATOR_ID, dto);
      expect(result.message).toBe('Event created successfully');
      expect(result.event).toBeDefined();
    });

    it('throws ConflictException when slug already exists', async () => {
      eventModelMock.findOne.mockResolvedValue(makeEventDoc());
      await expect(service.createEvent(CREATOR_ID, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── updateEvent ────────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.updateEvent(EVENT_ID, CREATOR_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      await expect(service.updateEvent(EVENT_ID, 'other-user', {})).rejects.toThrow(ForbiddenException);
    });

    it('updates event when caller is creator', async () => {
      const doc = makeEventDoc();
      eventModelMock.findById.mockResolvedValue(doc);
      const result = await service.updateEvent(EVENT_ID, CREATOR_ID, { title: 'New Title' } as any);
      expect(doc.save).toHaveBeenCalled();
      expect(result.message).toBe('Event updated successfully');
    });
  });

  // ─── publishEvent ────────────────────────────────────────────────────────

  describe('publishEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.publishEvent(EVENT_ID, CREATOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc());
      await expect(service.publishEvent(EVENT_ID, 'other')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when event is already published', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc({ status: 'published' }));
      await expect(service.publishEvent(EVENT_ID, CREATOR_ID)).rejects.toThrow(BadRequestException);
    });

    it('publishes a draft event', async () => {
      const doc = makeEventDoc({ ticketTiers: [makeTier()] });
      eventModelMock.findById.mockResolvedValue(doc);
      const result = await service.publishEvent(EVENT_ID, CREATOR_ID);
      expect(doc.status).toBe('published');
      expect(doc.save).toHaveBeenCalled();
      expect(result.message).toBe('Event published successfully');
    });
  });

  // ─── getEventById ────────────────────────────────────────────────────────

  describe('getEventById', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getEventById(EVENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns published event to anonymous caller', async () => {
      const doc = makeEventDoc({ status: 'published' });
      eventModelMock.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(doc),
      });
      const result = await service.getEventById(EVENT_ID);
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when draft accessed by non-owner', async () => {
      const doc = makeEventDoc({ status: 'draft' });
      eventModelMock.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(doc),
      });
      await expect(service.getEventById(EVENT_ID, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('returns draft event to its creator', async () => {
      const doc = makeEventDoc({ status: 'draft' });
      eventModelMock.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(doc),
      });
      const result = await service.getEventById(EVENT_ID, CREATOR_ID);
      expect(result).toBeDefined();
    });
  });

  // ─── checkTicketAvailability ─────────────────────────────────────────────

  describe('checkTicketAvailability', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.checkTicketAvailability(EVENT_ID, 'tier-id-1', 1)).rejects.toThrow(NotFoundException);
    });

    it('returns available:true when enough tickets remain', async () => {
      eventModelMock.findById.mockResolvedValue(makeEventDoc({ status: 'published' }));
      const result = await service.checkTicketAvailability(EVENT_ID, 'tier-id-1', 1);
      expect(result.available).toBe(true);
    });

    it('returns available:false when all tickets are sold', async () => {
      eventModelMock.findById.mockResolvedValue(
        makeEventDoc({ status: 'published', ticketTiers: [makeTier({ quantity: 5, sold: 5 })] }),
      );
      const result = await service.checkTicketAvailability(EVENT_ID, 'tier-id-1', 1);
      expect(result.available).toBe(false);
    });
  });

  // ─── getSharableLinks ────────────────────────────────────────────────────

  describe('getSharableLinks', () => {
    it('throws NotFoundException when event does not exist', async () => {
      eventModelMock.findById.mockResolvedValue(null);
      await expect(service.getSharableLinks(EVENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns shareUrl and platform links', async () => {
      const doc = makeEventDoc({ status: 'published', slug: 'test-concert' });
      eventModelMock.findById.mockResolvedValue(doc);
      const result = await service.getSharableLinks(EVENT_ID);
      expect(result.shareUrl).toContain('test-concert');
      expect(result.platforms.twitter).toBeDefined();
      expect(result.platforms.facebook).toBeDefined();
      expect(result.platforms.whatsapp).toBeDefined();
    });
  });

  // ─── getFeaturedEvents ───────────────────────────────────────────────────

  describe('getFeaturedEvents', () => {
    it('returns an array of featured events', async () => {
      eventModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([makeEventDoc({ status: 'published' })]),
      });
      const result = await service.getFeaturedEvents(5);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
