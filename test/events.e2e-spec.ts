import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let dbConnection: Connection;
  let creatorToken: string;
  let eventeeToken: string;
  let physicalEventId: string;
  let onlineEventId: string;
  let hybridEventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    dbConnection = moduleFixture.get<Connection>(getConnectionToken());

    // Register test users
    const creatorResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'eventscreator@test.com',
        password: 'Password@123',
        role: 'creator',
        profile: {
          fullName: 'Events Creator',
        },
      });

    creatorToken = creatorResponse.body.accessToken;

    const eventeeResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'eventseventee@test.com',
        password: 'Password@123',
        role: 'eventee',
        profile: {
          fullName: 'Events Eventee',
        },
      });

    eventeeToken = eventeeResponse.body.accessToken;
  });

  afterAll(async () => {
    if (dbConnection) {
      await dbConnection.collection('users').deleteMany({
        email: { $in: ['eventscreator@test.com', 'eventseventee@test.com'] },
      });
      await dbConnection.collection('events').deleteMany({
        _id: { $in: [physicalEventId, onlineEventId, hybridEventId] },
      });
    }
    await app.close();
  });

  describe('Event Creation', () => {
    it('should create a physical event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Physical Concert Event',
          description: 'Amazing live concert in Lagos',
          category: 'Concerts',
          eventType: 'physical',
          venue: {
            name: 'Eko Hotel',
            address: '1415 Adetokunbo Ademola St',
            city: 'Lagos',
            state: 'Lagos',
            coordinates: {
              lat: 6.4474,
              lng: 3.4205,
            },
          },
          schedule: {
            startDate: '2025-12-20T18:00:00Z',
            endDate: '2025-12-20T23:00:00Z',
            timezone: 'Africa/Lagos',
          },
          capacity: 500,
          ticketTiers: [
            {
              name: 'Regular',
              price: 5000,
              quantity: 300,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-12-19T23:59:59Z',
            },
            {
              name: 'VIP',
              price: 15000,
              quantity: 200,
              benefits: ['VIP lounge', 'Free drinks'],
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-12-19T23:59:59Z',
            },
          ],
        })
        .expect(201);

      expect(response.body.message).toBe('Event created successfully');
      expect(response.body.event.eventType).toBe('physical');
      expect(response.body.event.venue).toBeDefined();
      expect(response.body.event.status).toBe('draft');
      expect(response.body.event.slug).toBeDefined();
      
      physicalEventId = response.body.event._id;
    });

    it('should create an online event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Online Workshop',
          description: 'Tech career development workshop',
          category: 'Culture',
          eventType: 'online',
          meetingLink: 'https://zoom.us/j/123456789',
          schedule: {
            startDate: '2025-11-15T14:00:00Z',
            endDate: '2025-11-15T17:00:00Z',
          },
          capacity: 1000,
          ticketTiers: [
            {
              name: 'Standard Access',
              price: 2000,
              quantity: 1000,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-11-14T23:59:59Z',
            },
          ],
        })
        .expect(201);

      expect(response.body.event.eventType).toBe('online');
      expect(response.body.event.meetingLink).toBe('https://zoom.us/j/123456789');
      expect(response.body.event.venue).toBeUndefined();
      
      onlineEventId = response.body.event._id;
    });

    it('should create a hybrid event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Hybrid Conference',
          description: 'Tech conference with in-person and virtual attendance',
          category: 'Culture',
          eventType: 'hybrid',
          venue: {
            name: 'Landmark Centre',
            address: 'Water Corporation Drive',
            city: 'Lagos',
            state: 'Lagos',
          },
          meetingLink: 'https://meet.google.com/abc-defg-hij',
          schedule: {
            startDate: '2025-11-01T09:00:00Z',
            endDate: '2025-11-01T17:00:00Z',
          },
          capacity: 800,
          ticketTiers: [
            {
              name: 'In-Person',
              price: 25000,
              quantity: 300,
              benefits: ['Lunch', 'Networking', 'Swag'],
              salesStart: '2025-09-01T00:00:00Z',
              salesEnd: '2025-10-30T23:59:59Z',
            },
            {
              name: 'Virtual',
              price: 5000,
              quantity: 500,
              benefits: ['Live stream', 'Chat access'],
              salesStart: '2025-09-01T00:00:00Z',
              salesEnd: '2025-10-31T23:59:59Z',
            },
          ],
        })
        .expect(201);

      expect(response.body.event.eventType).toBe('hybrid');
      expect(response.body.event.venue).toBeDefined();
      expect(response.body.event.meetingLink).toBeDefined();
      
      hybridEventId = response.body.event._id;
    });

    it('should reject physical event without venue', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Invalid Physical Event',
          description: 'Missing venue',
          category: 'Concerts',
          eventType: 'physical',
          // Missing venue
          schedule: {
            startDate: '2025-12-20T18:00:00Z',
            endDate: '2025-12-20T23:00:00Z',
          },
          capacity: 100,
          ticketTiers: [
            {
              name: 'Regular',
              price: 5000,
              quantity: 100,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-12-19T23:59:59Z',
            },
          ],
        })
        .expect(400);
    });

    it('should reject online event without meeting link', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Invalid Online Event',
          description: 'Missing meeting link',
          category: 'Culture',
          eventType: 'online',
          // Missing meetingLink
          schedule: {
            startDate: '2025-11-15T14:00:00Z',
            endDate: '2025-11-15T17:00:00Z',
          },
          capacity: 100,
          ticketTiers: [
            {
              name: 'Standard',
              price: 2000,
              quantity: 100,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-11-14T23:59:59Z',
            },
          ],
        })
        .expect(400);
    });
  });

  describe('Event Publishing', () => {
    it('should publish a draft event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/${physicalEventId}/publish`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(201);

      expect(response.body.message).toBe('Event published successfully');
      expect(response.body.event.status).toBe('published');
    });

    it('should show published event in public listings', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .expect(200);

      const publishedEvent = response.body.events.find(
        (e: any) => e._id === physicalEventId
      );

      expect(publishedEvent).toBeDefined();
    });
  });

  describe('Event Browsing and Filtering', () => {
    beforeAll(async () => {
      // Publish other events for testing
      await request(app.getHttpServer())
        .post(`/events/${onlineEventId}/publish`)
        .set('Authorization', `Bearer ${creatorToken}`);

      await request(app.getHttpServer())
        .post(`/events/${hybridEventId}/publish`)
        .set('Authorization', `Bearer ${creatorToken}`);
    });

    it('should filter events by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/events?category=Concerts')
        .expect(200);

      expect(response.body.events.every((e: any) => e.category === 'Concerts')).toBe(true);
    });

    it('should filter events by eventType', async () => {
      const response = await request(app.getHttpServer())
        .get('/events?eventType=online')
        .expect(200);

      expect(response.body.events.every((e: any) => e.eventType === 'online')).toBe(true);
    });

    it('should filter events by city', async () => {
      const response = await request(app.getHttpServer())
        .get('/events?city=Lagos')
        .expect(200);

      expect(response.body.events.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/events?page=1&limit=2')
        .expect(200);

      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should get featured events', async () => {
      await request(app.getHttpServer())
        .get('/events/featured')
        .expect(200);
    });

    it('should get upcoming events', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/upcoming')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Event Updates', () => {
    it('should update event description', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${physicalEventId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          description: 'Updated event description',
        })
        .expect(200);

      expect(response.body.event.description).toBe('Updated event description');
    });

    it('should update event images', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${physicalEventId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        })
        .expect(200);

      expect(response.body.event.images).toHaveLength(2);
    });
  });

  describe('Ticket Tier Management', () => {
    it('should add a new ticket tier', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/${physicalEventId}/tiers`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          name: 'Early Bird',
          price: 3000,
          quantity: 50,
          benefits: ['Early access'],
          salesStart: '2025-09-01T00:00:00Z',
          salesEnd: '2025-10-01T00:00:00Z',
        })
        .expect(201);

      expect(response.body.message).toBe('Ticket tier added successfully');
      expect(response.body.event.ticketTiers.length).toBeGreaterThan(2);
    });

    it('should update ticket tier', async () => {
      const event = await request(app.getHttpServer())
        .get(`/events/${physicalEventId}`)
        .expect(200);

      const tierId = event.body.ticketTiers[0]._id;

      const response = await request(app.getHttpServer())
        .patch(`/events/${physicalEventId}/tiers/${tierId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          price: 5500,
        })
        .expect(200);

      expect(response.body.message).toBe('Ticket tier updated successfully');
    });

    it('should check ticket availability', async () => {
      const event = await request(app.getHttpServer())
        .get(`/events/${physicalEventId}`)
        .expect(200);

      const tierId = event.body.ticketTiers[0]._id;

      const response = await request(app.getHttpServer())
        .get(`/events/${physicalEventId}/tiers/${tierId}/availability?quantity=5`)
        .expect(200);

      expect(response.body.available).toBeDefined();
    });
  });

  describe('Creator Dashboard', () => {
    it('should get creator\'s events', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/creator/my')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter creator\'s events by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/creator/my?status=published')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(response.body.every((e: any) => e.status === 'published')).toBe(true);
    });
  });

  describe('Event Deletion', () => {
    it('should delete event without tickets sold', async () => {
      // Create new event to delete
      const createResponse = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Event to Delete',
          description: 'Will be deleted',
          category: 'Comedy',
          eventType: 'online',
          meetingLink: 'https://zoom.us/j/987654321',
          schedule: {
            startDate: '2025-12-01T20:00:00Z',
            endDate: '2025-12-01T22:00:00Z',
          },
          capacity: 100,
          ticketTiers: [
            {
              name: 'Regular',
              price: 3000,
              quantity: 100,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-11-30T23:59:59Z',
            },
          ],
        });

      const eventToDeleteId = createResponse.body.event._id;

      const response = await request(app.getHttpServer())
        .delete(`/events/${eventToDeleteId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(response.body.message).toBe('Event deleted successfully');
    });
  });
});
