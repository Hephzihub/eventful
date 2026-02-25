import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/user.schema';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email.toLowerCase(),
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = new this.userModel({
      email: createUserDto.email,
      password: createUserDto.password,
      role: createUserDto.role,
      profile: {
        fullName: createUserDto.profile.fullName,
        phone: createUserDto.profile.phone,
      },
    });

    await user.save();

    // Generate token before toJSON() since toJSON() strips _id
    const accessToken = this.generateAccessToken(user);

    return { message: 'User registered successfully', accessToken, user: user.toJSON() };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (user && (await user.comparePassword(password))) {
      const { password: _, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async validateUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  async login(user: any) {
    const accessToken = this.generateAccessToken(user);
    return { message: 'Login successful', accessToken };
  }

  private generateAccessToken(user: User): string {
    if (!user._id) {
      throw new InternalServerErrorException('Cannot generate token: user._id is missing');
    }
    const payload = { sub: user._id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.profile) {
      if (dto.profile.fullName !== undefined) {
        user.profile.fullName = dto.profile.fullName;
      }
      if (dto.profile.phone !== undefined) {
        user.profile.phone = dto.profile.phone;
      }
    }

    await user.save();
    return { message: 'Profile updated successfully', user: user.toJSON() };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.profile.avatar = avatarUrl;
    await user.save();

    return { message: 'Avatar updated successfully', avatarUrl };
  }
}