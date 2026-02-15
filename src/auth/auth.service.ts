import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/user.schema';
import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(CreateUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      email: CreateUserDto.email.toLowerCase(),
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate all required fields
    if (
      !CreateUserDto.email ||
      !CreateUserDto.password ||
      !CreateUserDto.role ||
      !CreateUserDto.profile ||
      !CreateUserDto.profile.fullName ||
      !CreateUserDto.profile.phone
    ) {
      throw new ConflictException('All fields are required');
    }

    const user = new this.userModel({
      email: CreateUserDto.email,
      password: CreateUserDto.password,
      role: CreateUserDto.role,
      profile: {
        fullName: CreateUserDto.profile.fullName,
        phone: CreateUserDto.profile.phone,
      },
    });

    await user.save();

    const accessToken = this.generateAccessToken(user);

    return { message: 'User registered successfully', accessToken, user: user.toJSON() };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (user && (await user.comparePassword(password))) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async validateUserById(userId: string): Promise<User | null> {
    const user = await this.userModel.findById(userId);

    if (user) {
      return user;
    }

    return null;
  }

  async login(user: any) {

    const accessToken = this.generateAccessToken(user);
    return { message: 'Login successful', accessToken, user };
  }

  private generateAccessToken(user: User): string {
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
}
