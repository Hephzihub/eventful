import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  ValidateNested,
  ArrayMinSize,
  MinLength,
  MaxLength,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ApiProperty } from '@nestjs/swagger';

export class CoordinatesDto {
  @ApiProperty({ description: 'Latitude', example: 6.5244 })
  @IsNumber()
  @Min(-90)
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 3.3792 })
  @IsNumber()
  @Min(-180)
  lng: number;
}

// Venue DTO
export class VenueDto {
  @ApiProperty({ description: 'Venue name', example: 'Eko Hotel' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Venue address', example: 'Victoria Island, Lagos' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsOptional()
  country?: string = 'Nigeria';

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

// Schedule DTO
export class ScheduleDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  timezone?: string = 'Africa/Lagos';
}

// Ticket Tier DTO
export class TicketTierDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string = 'NGN';

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[] = [];

  @IsDateString()
  @IsNotEmpty()
  salesStart: string;

  @IsDateString()
  @IsNotEmpty()
  salesEnd: string;
}

// Reminders DTO
export class EventRemindersDto {
  @IsOptional()
  enabled?: boolean = true;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  intervals?: number[] = [24, 168]; // Default: 24 hours and 7 days
}

// Main Create Event DTO
export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(300)
  slug?: string; // Auto-generated if not provided

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @IsEnum(['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'])
  @IsNotEmpty()
  category: string;

  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[] = [];

  @IsEnum(['physical', 'online', 'hybrid'])
  @IsNotEmpty()
  eventType: string;

  // Venue is required for physical and hybrid events
  @ValidateIf((o) => o.eventType === 'physical' || o.eventType === 'hybrid')
  @ValidateNested()
  @Type(() => VenueDto)
  @IsNotEmpty({
    message: 'Venue is required for physical and hybrid events',
  })
  venue?: VenueDto;

  // Meeting link is required for online and hybrid events
  @ValidateIf((o) => o.eventType === 'online' || o.eventType === 'hybrid')
  @IsUrl({}, {
    message: 'Meeting link must be a valid URL',
  })
  @IsNotEmpty({
    message: 'Meeting link is required for online and hybrid events',
  })
  meetingLink?: string;

  @ValidateNested()
  @Type(() => ScheduleDto)
  @IsNotEmpty()
  schedule: ScheduleDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTierDto)
  @ArrayMinSize(1, { message: 'At least one ticket tier is required' })
  ticketTiers: TicketTierDto[];

  @IsNumber()
  @Min(1)
  capacity: number;

  @ValidateNested()
  @Type(() => EventRemindersDto)
  @IsOptional()
  reminders?: EventRemindersDto;

  @IsOptional()
  isFeatured?: boolean = false;
}