import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from 'src/users/user.schema';

const makeUserDoc = (overrides: any = {}) => ({
  _id: 'uid-1',
  email: 'test@example.com',
  role: 'eventee',
  profile: { fullName: 'Test User', phone: '08012345678', avatar: '' },
  comparePassword: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockReturnValue({ _id: 'uid-1', email: 'test@example.com' }),
  toObject: jest.fn().mockReturnValue({ _id: 'uid-1', email: 'test@example.com' }),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let userModelMock: any;

  const mockJwtService = { sign: jest.fn().mockReturnValue('jwt-token') };

  beforeEach(async () => {
    function UserModelCtor(this: any, data: any) {
      Object.assign(this, makeUserDoc(data));
    }
    UserModelCtor.findOne = jest.fn();
    UserModelCtor.findById = jest.fn();
    userModelMock = UserModelCtor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'Password1!',
      role: 'eventee',
      profile: { fullName: 'New User', phone: '080' },
    };

    it('returns token + user on success', async () => {
      userModelMock.findOne.mockResolvedValue(null);
      const result = await service.register(dto as any);
      expect(result.message).toBe('User registered successfully');
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user).toBeDefined();
    });

    it('throws ConflictException when email already exists', async () => {
      userModelMock.findOne.mockResolvedValue(makeUserDoc());
      await expect(service.register(dto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('strips password and returns user object on valid credentials', async () => {
      userModelMock.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(makeUserDoc()),
      });
      const result = await service.validateUser('test@example.com', 'correct');
      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
    });

    it('returns null when user not found', async () => {
      userModelMock.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const result = await service.validateUser('no@one.com', 'pw');
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      userModelMock.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(
          makeUserDoc({ comparePassword: jest.fn().mockResolvedValue(false) }),
        ),
      });
      const result = await service.validateUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns message and accessToken', async () => {
      const user = { _id: 'uid-1', email: 'test@example.com', role: 'eventee' };
      const result = await service.login(user);
      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('getCurrentUser', () => {
    it('returns user when found', async () => {
      userModelMock.findById.mockResolvedValue(makeUserDoc());
      const result = await service.getCurrentUser('uid-1');
      expect(result).toBeDefined();
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      userModelMock.findById.mockResolvedValue(null);
      await expect(service.getCurrentUser('bad-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('updates provided fields and returns success message', async () => {
      const doc = makeUserDoc();
      userModelMock.findById.mockResolvedValue(doc);
      const result = await service.updateProfile('uid-1', {
        profile: { fullName: 'Updated', phone: '090' },
      } as any);
      expect(doc.profile.fullName).toBe('Updated');
      expect(doc.save).toHaveBeenCalled();
      expect(result.message).toBe('Profile updated successfully');
    });

    it('throws NotFoundException when user does not exist', async () => {
      userModelMock.findById.mockResolvedValue(null);
      await expect(
        service.updateProfile('bad-id', { profile: {} } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAvatar', () => {
    it('saves the avatar URL and returns message + URL', async () => {
      const doc = makeUserDoc();
      userModelMock.findById.mockResolvedValue(doc);
      const url = 'https://res.cloudinary.com/demo/image/upload/v1/avatars/user.jpg';
      const result = await service.updateAvatar('uid-1', url);
      expect(doc.profile.avatar).toBe(url);
      expect(doc.save).toHaveBeenCalled();
      expect(result.message).toBe('Avatar updated successfully');
      expect(result.avatarUrl).toBe(url);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userModelMock.findById.mockResolvedValue(null);
      await expect(service.updateAvatar('bad-id', 'https://cdn.example.com/img.jpg')).rejects.toThrow(NotFoundException);
    });
  });
});
