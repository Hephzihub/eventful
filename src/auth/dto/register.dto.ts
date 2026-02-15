import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?234\d{10}$|^0\d{10}$/, {
    message:
      'Phone must be in Nigerian format (e.g., +2348012345678 or 08012345678)',
  })
  @ApiProperty({
    description: 'Phone number of the user in Nigerian format',
    example: '+2348012345678',
  })
  phone?: string;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @ApiProperty({
    description: 'Email address of the user',
    example: 'oluwasheges@gmail.com'
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @ApiProperty({
    description: 'Password for the user account',
    example: 'P@ssw0rd123'
  })
  password: string;

  @IsEnum(['creator', 'eventee'])
  @IsNotEmpty()
  @ApiProperty({
    description: 'Role of the user (creator or eventee)',
    example: 'creator',
    enum: ['creator', 'eventee']
  })
  role: 'creator' | 'eventee';

  @ValidateNested()
  @Type(() => ProfileDto)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Profile information of the user',
    type: ProfileDto,
  })
  profile: ProfileDto;
}
