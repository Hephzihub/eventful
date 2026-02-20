import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEmail,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Individual attendee information (optional for each ticket)
export class AttendeeInfoDto {
  @ApiProperty({
    description: 'Full name of the attendee for this ticket',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Email address of the attendee',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Phone number in Nigerian format',
    example: '08012345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+?234\d{10}$|^0\d{10}$/, {
    message: 'Phone must be in Nigerian format (e.g., +2348012345678 or 08012345678)',
  })
  phone?: string;
}

export class PurchaseTicketDto {
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
    description: 'Number of tickets to purchase. Maximum 10 per transaction.',
    example: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Min(1, { message: 'Must purchase at least 1 ticket' })
  @Max(10, { message: 'Cannot purchase more than 10 tickets at once' })
  quantity: number;

  @ApiProperty({
    description:
      'Optional attendee information for each ticket. If provided, array length must match quantity. If purchasing for yourself only, you can omit this field.',
    type: [AttendeeInfoDto],
    required: false,
    example: [
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '08012345678',
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '08087654321',
      },
    ],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttendeeInfoDto)
  @ArrayMaxSize(10, { message: 'Cannot specify attendees for more than 10 tickets' })
  attendees?: AttendeeInfoDto[];
}
