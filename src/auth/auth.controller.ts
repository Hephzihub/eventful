import { Body, Controller, Get, Post, UseGuards, Version } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/register.dto';
import { Public } from './decorators/public.decorators';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from 'src/users/entities/user.entity';
import { version } from 'os';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  // @Version('1')
  constructor(private readonly authService: AuthService) {}
  
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: LoginResponseDto,
  })
  async login(@CurrentUser() user: any) {
    // LocalAuthGuard runs LocalStrategy first, which validates credentials
    // and attaches the user to req.user — we extract it via @CurrentUser()
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserEntity })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user (by id)' })
  @ApiResponse({ status: 200, description: 'Current user details', type: UserEntity })
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser(user._id);
  }
}