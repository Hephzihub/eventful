import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { UploadService } from 'src/upload/upload.service';
import { CreateUserDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorators';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly uploadService: UploadService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60, limit: 3 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error (missing fields, invalid email, etc.)' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@CurrentUser() user: any) {
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile (from JWT token)' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserEntity,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user details (fetched fresh from DB)' })
  @ApiResponse({
    status: 200,
    description: 'Current user details',
    type: UserEntity,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser(user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Update profile (fullName / phone)',
    description:
      'Update fullName and/or phone number. To change your avatar use POST /auth/profile/avatar.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        message: 'Profile updated successfully',
        user: {
          email: 'john@example.com',
          role: 'eventee',
          profile: {
            fullName: 'John Doe',
            phone: '08012345678',
            avatar: 'https://res.cloudinary.com/demo/image/upload/v1/avatars/user.jpg',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user._id, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Upload a new avatar',
    description:
      "Uploads a JPEG, PNG, or WebP image (max 2 MB) to Cloudinary and saves the returned URL as the user's avatar.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image — JPEG, PNG, or WebP. Max 2 MB.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Avatar uploaded and saved',
    schema: {
      example: {
        message: 'Avatar updated successfully',
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/avatars/user.jpg',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file provided or invalid file type / size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const avatarUrl = await this.uploadService.uploadAvatarImage(file);
    return this.authService.updateAvatar(user._id, avatarUrl);
  }
}