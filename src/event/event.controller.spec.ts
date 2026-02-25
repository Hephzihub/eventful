import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { UploadService } from 'src/upload/upload.service';

const mockEventService = {
  getAllEvents: jest.fn(),
  getFeaturedEvents: jest.fn(),
  getUpcomingEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  publishEvent: jest.fn(),
  deleteEvent: jest.fn(),
  getEventById: jest.fn(),
  getEventBySlug: jest.fn(),
  getCreatorEvents: jest.fn(),
  addTicketTier: jest.fn(),
  updateTicketTier: jest.fn(),
  removeTicketTier: jest.fn(),
  checkTicketAvailability: jest.fn(),
  addEventImage: jest.fn(),
  getSharableLinks: jest.fn(),
};

const mockUploadService = { uploadEventImage: jest.fn() };

describe('EventController', () => {
  let controller: EventController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        { provide: EventService, useValue: mockEventService },
        { provide: UploadService, useValue: mockUploadService },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<EventController>(EventController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllEvents', () => {
    it('delegates to eventService.getAllEvents', async () => {
      const expected = { events: [], pagination: {} };
      mockEventService.getAllEvents.mockResolvedValue(expected);
      const result = await controller.getAllEvents({} as any);
      expect(mockEventService.getAllEvents).toHaveBeenCalledWith({});
      expect(result).toEqual(expected);
    });
  });

  describe('createEvent', () => {
    it('passes userId from current user to service', async () => {
      const user = { _id: 'uid-1' };
      const dto = { title: 'Concert' };
      const expected = { message: 'Event created successfully', event: {} };
      mockEventService.createEvent.mockResolvedValue(expected);
      const result = await controller.createEvent(user, dto as any);
      expect(mockEventService.createEvent).toHaveBeenCalledWith('uid-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('publishEvent', () => {
    it('delegates to eventService.publishEvent', async () => {
      const user = { _id: 'uid-1' };
      const expected = { message: 'Event published successfully', event: {} };
      mockEventService.publishEvent.mockResolvedValue(expected);
      const result = await controller.publishEvent('event-id-1', user);
      expect(mockEventService.publishEvent).toHaveBeenCalledWith('event-id-1', 'uid-1');
      expect(result).toEqual(expected);
    });
  });

  describe('deleteEvent', () => {
    it('delegates to eventService.deleteEvent', async () => {
      const user = { _id: 'uid-1' };
      mockEventService.deleteEvent.mockResolvedValue({ message: 'Event deleted' });
      await controller.deleteEvent('event-id-1', user);
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith('event-id-1', 'uid-1');
    });
  });

  describe('getEventShareLink', () => {
    it('delegates to eventService.getSharableLinks', async () => {
      const expected = { shareUrl: 'http://localhost/events/slug', platforms: {} };
      mockEventService.getSharableLinks.mockResolvedValue(expected);
      const result = await controller.getEventShareLink('event-id-1');
      expect(mockEventService.getSharableLinks).toHaveBeenCalledWith('event-id-1');
      expect(result).toEqual(expected);
    });
  });

  describe('checkTicketAvailability', () => {
    it('delegates to eventService.checkTicketAvailability', async () => {
      mockEventService.checkTicketAvailability.mockResolvedValue({ available: true, remaining: 50 });
      const result = await controller.checkTicketAvailability('event-id-1', 'tier-id-1', 1);
      expect(mockEventService.checkTicketAvailability).toHaveBeenCalledWith('event-id-1', 'tier-id-1', 1);
      expect(result.available).toBe(true);
    });
  });
});
