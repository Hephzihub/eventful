import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorators';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';
import { version } from 'os';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  // @Version('1')
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60, limit: 3 } }) // Limit to 3 login attempts per minute
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
  @Throttle({ default: { ttl: 60, limit: 5 } }) // Limit to 5 login attempts per minute
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
    // LocalAuthGuard runs LocalStrategy first, which validates credentials
    // and attaches the user to req.user — we extract it via @CurrentUser()
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
    summary: 'Update current user profile',
    description: 'Update fullName, phone, or avatar. Email, password, and role cannot be changed here.',
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
            avatar: 'https://res.cloudinary.com/example/image/upload/v1/avatars/user.jpg',
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
}
