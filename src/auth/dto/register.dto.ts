import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  ValidateNested
} from 'class-validator';

class ProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?234\d{10}$|^0\d{10}$/, {
    message:
      'Phone must be in Nigerian format (e.g., +2348012345678 or 08012345678)',
  })
  phone?: string;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsEnum(['creator', 'eventee'])
  @IsNotEmpty()
  role: 'creator' | 'eventee';

  @ValidateNested()
  @Type(() => ProfileDto)
  @IsNotEmpty()
  profile: ProfileDto;
}
