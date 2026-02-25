import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Reuse AttendeeInfoDto from tickets
export class AttendeeInfoDto {
  @ApiProperty({
    description: 'Full name of the attendee',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '08012345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the event',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    description: 'MongoDB ObjectId of the ticket tier',
    example: '507f191e810c19729de860ea',
  })
  @IsString()
  @IsNotEmpty()
  tierId: string;

  @ApiProperty({
    description: 'Number of tickets to purchase (1-10)',
    example: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  quantity: number;

  @ApiProperty({
    description: 'Customer email address for payment',
    example: 'customer@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Optional attendee information for each ticket',
    type: [AttendeeInfoDto],
    required: false,
    example: [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith' },
    ],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttendeeInfoDto)
  @ArrayMaxSize(10)
  attendees?: AttendeeInfoDto[];

  @ApiProperty({
    description: 'Additional metadata (optional)',
    required: false,
    example: { source: 'mobile_app', campaign: 'early_bird' },
  })
  @IsOptional()
  metadata?: any;
}
