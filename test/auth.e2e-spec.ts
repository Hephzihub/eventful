import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dbConnection: Connection;
  let creatorToken: string;
  let eventeeToken: string;
  let creatorUser: any;
  let eventeeUser: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Enable validation (same as in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get database connection for cleanup
    dbConnection = moduleFixture.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    // Clean up test data
    if (dbConnection) {
      await dbConnection.collection('users').deleteMany({
        email: { $in: ['testcreator@test.com', 'testeventee@test.com'] },
      });
    }
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new creator', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'testcreator@test.com',
          password: 'Password@123',
          role: 'creator',
          profile: {
            fullName: 'Test Creator',
            phone: '08012345678',
          },
        })
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('testcreator@test.com');
      expect(response.body.user.role).toBe('creator');
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned

      creatorToken = response.body.accessToken;
      creatorUser = response.body.user;
    });

    it('should register a new eventee', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'testeventee@test.com',
          password: 'Password@123',
          role: 'eventee',
          profile: {
            fullName: 'Test Eventee',
            phone: '08087654321',
          },
        })
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.role).toBe('eventee');

      eventeeToken = response.body.accessToken;
      eventeeUser = response.body.user;
    });

    it('should reject registration with existing email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'testcreator@test.com', // Already registered
          password: 'Password@123',
          role: 'creator',
          profile: {
            fullName: 'Duplicate User',
          },
        })
        .expect(409);

      expect(response.body.message).toBe('User with this email already exists');
    });

    it('should reject registration with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password@123',
          role: 'creator',
          profile: {
            fullName: 'Invalid Email',
          },
        })
        .expect(400);
    });

    it('should reject registration with short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@test.com',
          password: '123', // Too short
          role: 'creator',
          profile: {
            fullName: 'Short Password',
          },
        })
        .expect(400);
    });

    it('should reject registration with invalid role', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Password@123',
          role: 'admin', // Invalid role
          profile: {
            fullName: 'Invalid Role',
          },
        })
        .expect(400);
    });

    it('should reject registration without required fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@test.com',
          // Missing password and profile
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login creator with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testcreator@test.com',
          password: 'Password@123',
        })
        .expect(201);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe('testcreator@test.com');
      expect(response.body.user.role).toBe('creator');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should login eventee with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testeventee@test.com',
          password: 'Password@123',
        })
        .expect(201);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.role).toBe('eventee');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testcreator@test.com',
          password: 'WrongPassword@123',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password@123',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Password@123',
        })
        .expect(400);
    });

    it('should reject login without credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('GET /auth/profile', () => {
    it('should get profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('testcreator@test.com');
      expect(response.body.user.role).toBe('creator');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });

    it('should reject request with malformed authorization header', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', creatorToken) // Missing "Bearer" prefix
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should get current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${eventeeToken}`)
        .expect(200);

      expect(response.body.email).toBe('testeventee@test.com');
      expect(response.body.role).toBe('eventee');
    });

    it('should reject without authentication', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  describe('Token Validation', () => {
    it('should accept requests with correct Bearer format', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });

    it('should reject expired/invalid tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Password Security', () => {
    it('should not return password hash in any response', async () => {
      // Register
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'securitytest@test.com',
          password: 'Password@123',
          role: 'eventee',
          profile: {
            fullName: 'Security Test',
          },
        })
        .expect(201);

      expect(registerResponse.body.user.password).toBeUndefined();
      expect(registerResponse.body.user.passwordHash).toBeUndefined();

      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'securitytest@test.com',
          password: 'Password@123',
        })
        .expect(201);

      expect(loginResponse.body.user.password).toBeUndefined();
      expect(loginResponse.body.user.passwordHash).toBeUndefined();

      // Profile
      const profileResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(profileResponse.body.user.password).toBeUndefined();
      expect(profileResponse.body.user.passwordHash).toBeUndefined();

      // Cleanup
      await dbConnection.collection('users').deleteOne({
        email: 'securitytest@test.com',
      });
    });
  });
});