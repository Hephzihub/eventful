import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let dbConnection: Connection;
  let creatorToken: string;
  let eventeeToken: string;
  let creatorUserId: string;
  let eventeeUserId: string;
  let testEventId: string;

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
        email: 'authcreator@test.com',
        password: 'Password@123',
        role: 'creator',
        profile: {
          fullName: 'Auth Creator',
          phone: '08012345678',
        },
      });

    creatorToken = creatorResponse.body.accessToken;
    creatorUserId = creatorResponse.body.user._id;

    const eventeeResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'autheventee@test.com',
        password: 'Password@123',
        role: 'eventee',
        profile: {
          fullName: 'Auth Eventee',
          phone: '08087654321',
        },
      });

    eventeeToken = eventeeResponse.body.accessToken;
    eventeeUserId = eventeeResponse.body.user._id;
  });

  afterAll(async () => {
    // Clean up test data
    if (dbConnection) {
      await dbConnection.collection('users').deleteMany({
        email: { $in: ['authcreator@test.com', 'autheventee@test.com'] },
      });
      
      if (testEventId) {
        await dbConnection.collection('events').deleteOne({
          _id: testEventId,
        });
      }
    }
    await app.close();
  });

  describe('Public Routes (No Authentication Required)', () => {
    it('should allow access to GET /events without token', async () => {
      await request(app.getHttpServer())
        .get('/events')
        .expect(200);
    });

    it('should allow access to GET /events/featured without token', async () => {
      await request(app.getHttpServer())
        .get('/events/featured')
        .expect(200);
    });

    it('should allow access to GET /events/upcoming without token', async () => {
      await request(app.getHttpServer())
        .get('/events/upcoming')
        .expect(200);
    });
  });

  describe('Protected Routes (Authentication Required)', () => {
    it('should deny access to GET /auth/profile without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should allow access to GET /auth/profile with valid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });

    it('should deny access to GET /events/user/my-events without token', async () => {
      await request(app.getHttpServer())
        .get('/events/user/my-events')
        .expect(401);
    });

    it('should allow eventee access to GET /events/user/my-events', async () => {
      await request(app.getHttpServer())
        .get('/events/user/my-events')
        .set('Authorization', `Bearer ${eventeeToken}`)
        .expect(200);
    });

    it('should allow creator access to GET /events/user/my-events', async () => {
      await request(app.getHttpServer())
        .get('/events/user/my-events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });
  });

  describe('Creator-Only Routes', () => {
    describe('POST /events (Create Event)', () => {
      it('should deny access without authentication', async () => {
        await request(app.getHttpServer())
          .post('/events')
          .send({
            title: 'Test Event',
            description: 'Test description',
            category: 'Concerts',
            eventType: 'physical',
          })
          .expect(401);
      });

      it('should deny access for eventee role', async () => {
        const response = await request(app.getHttpServer())
          .post('/events')
          .set('Authorization', `Bearer ${eventeeToken}`)
          .send({
            title: 'Test Event',
            description: 'Test description for concert event',
            category: 'Concerts',
            eventType: 'physical',
            venue: {
              name: 'Test Venue',
              address: '123 Main St',
              city: 'Lagos',
              state: 'Lagos',
            },
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
          .expect(403);

        expect(response.body.message).toContain('creator');
      });

      it('should allow access for creator role', async () => {
        const response = await request(app.getHttpServer())
          .post('/events')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            title: 'Creator Test Event',
            description: 'Test description for creator event',
            category: 'Concerts',
            eventType: 'physical',
            venue: {
              name: 'Test Venue',
              address: '123 Main St',
              city: 'Lagos',
              state: 'Lagos',
            },
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
          .expect(201);

        expect(response.body.message).toBe('Event created successfully');
        expect(response.body.event).toBeDefined();
        testEventId = response.body.event._id;
      });
    });

    describe('GET /events/creator/my', () => {
      it('should deny access without authentication', async () => {
        await request(app.getHttpServer())
          .get('/events/creator/my')
          .expect(401);
      });

      it('should deny access for eventee', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/creator/my')
          .set('Authorization', `Bearer ${eventeeToken}`)
          .expect(403);

        expect(response.body.message).toContain('creator');
      });

      it('should allow access for creator', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/creator/my')
          .set('Authorization', `Bearer ${creatorToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('PATCH /events/:id (Update Event)', () => {
      it('should deny access without authentication', async () => {
        await request(app.getHttpServer())
          .patch(`/events/${testEventId}`)
          .send({ description: 'Updated description' })
          .expect(401);
      });

      it('should deny access for eventee', async () => {
        await request(app.getHttpServer())
          .patch(`/events/${testEventId}`)
          .set('Authorization', `Bearer ${eventeeToken}`)
          .send({ description: 'Updated description' })
          .expect(403);
      });

      it('should allow creator to update their own event', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/events/${testEventId}`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({ description: 'Updated by creator' })
          .expect(200);

        expect(response.body.message).toBe('Event updated successfully');
      });
    });

    describe('POST /events/:id/publish', () => {
      it('should deny access without authentication', async () => {
        await request(app.getHttpServer())
          .post(`/events/${testEventId}/publish`)
          .expect(401);
      });

      it('should deny access for eventee', async () => {
        await request(app.getHttpServer())
          .post(`/events/${testEventId}/publish`)
          .set('Authorization', `Bearer ${eventeeToken}`)
          .expect(403);
      });

      it('should allow creator to publish their own event', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${testEventId}/publish`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .expect(201);

        expect(response.body.message).toBe('Event published successfully');
        expect(response.body.event.status).toBe('published');
      });
    });

    describe('DELETE /events/:id', () => {
      it('should deny access without authentication', async () => {
        await request(app.getHttpServer())
          .delete(`/events/${testEventId}`)
          .expect(401);
      });

      it('should deny access for eventee', async () => {
        await request(app.getHttpServer())
          .delete(`/events/${testEventId}`)
          .set('Authorization', `Bearer ${eventeeToken}`)
          .expect(403);
      });

      it('should allow creator to delete their own event', async () => {
        // Create a new event to delete
        const createResponse = await request(app.getHttpServer())
          .post('/events')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            title: 'Event to Delete',
            description: 'Will be deleted',
            category: 'Comedy',
            eventType: 'online',
            meetingLink: 'https://zoom.us/j/123456789',
            schedule: {
              startDate: '2025-11-15T14:00:00Z',
              endDate: '2025-11-15T17:00:00Z',
            },
            capacity: 50,
            ticketTiers: [
              {
                name: 'Regular',
                price: 2000,
                quantity: 50,
                salesStart: '2025-10-01T00:00:00Z',
                salesEnd: '2025-11-14T23:59:59Z',
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

  describe('Event Ownership', () => {
    let secondCreatorToken: string;
    let secondCreatorEventId: string;

    beforeAll(async () => {
      // Register second creator
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'creator2@test.com',
          password: 'Password@123',
          role: 'creator',
          profile: {
            fullName: 'Second Creator',
          },
        });

      secondCreatorToken = response.body.accessToken;

      // Create event by second creator
      const eventResponse = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${secondCreatorToken}`)
        .send({
          title: 'Second Creator Event',
          description: 'Event by second creator',
          category: 'Theater',
          eventType: 'physical',
          venue: {
            name: 'Theater Venue',
            address: '456 Theater St',
            city: 'Lagos',
            state: 'Lagos',
          },
          schedule: {
            startDate: '2025-12-25T19:00:00Z',
            endDate: '2025-12-25T22:00:00Z',
          },
          capacity: 200,
          ticketTiers: [
            {
              name: 'Regular',
              price: 3000,
              quantity: 200,
              salesStart: '2025-10-01T00:00:00Z',
              salesEnd: '2025-12-24T23:59:59Z',
            },
          ],
        });

      secondCreatorEventId = eventResponse.body.event._id;
    });

    afterAll(async () => {
      await dbConnection.collection('users').deleteOne({
        email: 'creator2@test.com',
      });
      if (secondCreatorEventId) {
        await dbConnection.collection('events').deleteOne({
          _id: secondCreatorEventId,
        });
      }
    });

    it('should prevent creator from updating another creator\'s event', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${secondCreatorEventId}`)
        .set('Authorization', `Bearer ${creatorToken}`) // First creator's token
        .send({ description: 'Trying to update' })
        .expect(403);

      expect(response.body.message).toBe('You can only update your own events');
    });

    it('should prevent creator from deleting another creator\'s event', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/events/${secondCreatorEventId}`)
        .set('Authorization', `Bearer ${creatorToken}`) // First creator's token
        .expect(403);

      expect(response.body.message).toBe('You can only delete your own events');
    });

    it('should prevent creator from publishing another creator\'s event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/${secondCreatorEventId}/publish`)
        .set('Authorization', `Bearer ${creatorToken}`) // First creator's token
        .expect(403);

      expect(response.body.message).toBe('You can only publish your own events');
    });

    it('should allow creator to update their own event', async () => {
      await request(app.getHttpServer())
        .patch(`/events/${secondCreatorEventId}`)
        .set('Authorization', `Bearer ${secondCreatorToken}`) // Correct owner
        .send({ description: 'Updated by owner' })
        .expect(200);
    });
  });

  describe('Mixed Role Access', () => {
    it('should allow both creators and eventees to view published events', async () => {
      // Creator
      const creatorResponse = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(creatorResponse.body.events).toBeDefined();

      // Eventee
      const eventeeResponse = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${eventeeToken}`)
        .expect(200);

      expect(eventeeResponse.body.events).toBeDefined();

      // Public (no token)
      const publicResponse = await request(app.getHttpServer())
        .get('/events')
        .expect(200);

      expect(publicResponse.body.events).toBeDefined();
    });

    it('should allow both roles to check ticket availability', async () => {
      if (!testEventId) return;

      // Get event to find tier ID
      const event = await request(app.getHttpServer())
        .get(`/events/${testEventId}`)
        .expect(200);

      const tierId = event.body.ticketTiers[0]._id;

      // Creator can check
      await request(app.getHttpServer())
        .get(`/events/${testEventId}/tiers/${tierId}/availability?quantity=2`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      // Eventee can check
      await request(app.getHttpServer())
        .get(`/events/${testEventId}/tiers/${tierId}/availability?quantity=2`)
        .set('Authorization', `Bearer ${eventeeToken}`)
        .expect(200);

      // Public can check
      await request(app.getHttpServer())
        .get(`/events/${testEventId}/tiers/${tierId}/availability?quantity=2`)
        .expect(200);
    });
  });

  describe('Token Expiry and Invalid Tokens', () => {
    it('should reject requests with expired tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0MhfecJvT98SYXyMN7F64Kpp1Zi46fV0R6uWmE';

      await request(app.getHttpServer())
        .get('/events/creator/my')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject requests with malformed tokens', async () => {
      await request(app.getHttpServer())
        .get('/events/creator/my')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .expect(401);
    });

    it('should reject requests with missing Bearer prefix', async () => {
      await request(app.getHttpServer())
        .get('/events/creator/my')
        .set('Authorization', creatorToken) // Missing "Bearer"
        .expect(401);
    });
  });
});
