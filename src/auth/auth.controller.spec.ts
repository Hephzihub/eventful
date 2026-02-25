import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UploadService } from 'src/upload/upload.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getCurrentUser: jest.fn(),
  updateProfile: jest.fn(),
  updateAvatar: jest.fn(),
};

const mockUploadService = {
  uploadAvatarImage: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UploadService, useValue: mockUploadService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delegates to authService.register', async () => {
      const dto = { email: 'a@b.com', password: 'pw', role: 'eventee', profile: { fullName: 'A' } };
      const expected = { message: 'User registered successfully', accessToken: 'tok', user: {} };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto as any);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('login', () => {
    it('delegates to authService.login with req.user', async () => {
      const user = { _id: 'uid-1', email: 'a@b.com' };
      mockAuthService.login.mockResolvedValue({ message: 'Login successful', accessToken: 'tok' });

      const result = await controller.login(user);

      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(result.accessToken).toBe('tok');
    });
  });

  describe('getProfile', () => {
    it('returns the current user from request', async () => {
      const user = { _id: 'uid-1', email: 'a@b.com' };
      const result = await controller.getProfile(user);
      expect(result).toEqual(user);
    });
  });

  describe('getCurrentUser', () => {
    it('delegates to authService.getCurrentUser', async () => {
      const user = { _id: 'uid-1' };
      mockAuthService.getCurrentUser.mockResolvedValue({ _id: 'uid-1', email: 'a@b.com' });

      const result = await controller.getCurrentUser(user);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('uid-1');
      expect(result).toBeDefined();
    });
  });

  describe('updateProfile', () => {
    it('delegates to authService.updateProfile', async () => {
      const user = { _id: 'uid-1' };
      const dto = { profile: { fullName: 'Updated' } };
      const expected = { message: 'Profile updated successfully', user: {} };
      mockAuthService.updateProfile.mockResolvedValue(expected);

      const result = await controller.updateProfile(user, dto as any);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('uid-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('uploadAvatar', () => {
    it('uploads file and delegates to authService.updateAvatar', async () => {
      const user = { _id: 'uid-1' };
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('') } as any;
      const avatarUrl = 'https://res.cloudinary.com/demo/image/upload/v1/avatars/user.jpg';
      const expected = { message: 'Avatar updated successfully', avatarUrl };

      mockUploadService.uploadAvatarImage.mockResolvedValue(avatarUrl);
      mockAuthService.updateAvatar.mockResolvedValue(expected);

      const result = await controller.uploadAvatar(user, file);

      expect(mockUploadService.uploadAvatarImage).toHaveBeenCalledWith(file);
      expect(mockAuthService.updateAvatar).toHaveBeenCalledWith('uid-1', avatarUrl);
      expect(result).toEqual(expected);
    });

    it('throws BadRequestException when no file is provided', async () => {
      const user = { _id: 'uid-1' };
      await expect(controller.uploadAvatar(user, undefined as any)).rejects.toThrow(BadRequestException);
    });
  });
});