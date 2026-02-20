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
  @ApiProperty({ description: 'Latitude in decimal degrees', example: 6.4281 })
  @IsNumber()
  @Min(-90)
  lat: number;

  @ApiProperty({ description: 'Longitude in decimal degrees', example: 3.4219 })
  @IsNumber()
  @Min(-180)
  lng: number;
}

export class VenueDto {
  @ApiProperty({ description: 'Venue display name', example: 'Eko Hotel & Suites' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Street address', example: 'Plot 1415, Adetokunbo Ademola Street' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  address: string;

  @ApiProperty({ description: 'City name', example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State or region', example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Country name', example: 'Nigeria', required: false, default: 'Nigeria' })
  @IsString()
  @IsOptional()
  country?: string = 'Nigeria';

  @ApiProperty({ description: 'GPS coordinates for map pins', required: false, type: () => CoordinatesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

export class ScheduleDto {
  @ApiProperty({ description: 'Event start datetime. Must be in the future.', example: '2026-08-15T19:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Event end datetime. Must be after startDate.', example: '2026-08-15T23:59:00Z' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'IANA timezone string', example: 'Africa/Lagos', required: false, default: 'Africa/Lagos' })
  @IsString()
  @IsOptional()
  timezone?: string = 'Africa/Lagos';
}

export class TicketTierDto {
  @ApiProperty({ description: 'Tier display name', example: 'VIP', minLength: 2, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Price per ticket. Use 0 for free tickets.', example: 45000, minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'ISO currency code', example: 'NGN', required: false, default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string = 'NGN';

  @ApiProperty({ description: 'Total tickets available for this tier', example: 150, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Perks included with this tier',
    example: ['Reserved seating', 'Complimentary drinks', 'VIP lounge access'],
    required: false,
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[] = [];

  @ApiProperty({ description: 'When ticket sales open for this tier', example: '2026-06-01T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  salesStart: string;

  @ApiProperty({
    description: 'When ticket sales close. Must be strictly before event startDate.',
    example: '2026-08-14T23:59:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  salesEnd: string;
}

export class EventRemindersDto {
  @ApiProperty({ description: 'Whether reminders are sent to ticket holders', example: true, required: false, default: true })
  @IsOptional()
  enabled?: boolean = true;

  @ApiProperty({
    description: 'Hours before event to send each reminder. e.g. [168, 24, 2] = 7 days, 1 day, 2 hours before.',
    example: [168, 24, 2],
    required: false,
    default: [24, 168],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  intervals?: number[] = [24, 168];
}

export class CreateEventDto {
  @ApiProperty({ description: 'Human-readable event title', example: 'Burna Boy Live in Lagos', minLength: 3, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'URL-friendly identifier. Auto-generated from title if omitted. Must be unique.',
    example: 'burna-boy-live-lagos',
    required: false,
    minLength: 3,
    maxLength: 300,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(300)
  slug?: string;

  @ApiProperty({
    description: 'Full event description',
    example: 'Experience the African Giant live at the iconic Eko Hotel grounds.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Event category',
    enum: ['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'],
    example: 'Concerts',
  })
  @IsEnum(['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'])
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Array of image URLs. Populate via POST /events/:id/images after creation.',
    example: [],
    required: false,
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[] = [];

  @ApiProperty({
    description: 'Event format. Determines which location fields are required.',
    enum: ['physical', 'online', 'hybrid'],
    example: 'physical',
  })
  @IsEnum(['physical', 'online', 'hybrid'])
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    description: 'Physical location details. Required when eventType is "physical" or "hybrid".',
    required: false,
    type: () => VenueDto,
  })
  @ValidateIf((o) => o.eventType === 'physical' || o.eventType === 'hybrid')
  @ValidateNested()
  @Type(() => VenueDto)
  @IsNotEmpty({ message: 'Venue is required for physical and hybrid events' })
  venue?: VenueDto;

  @ApiProperty({
    description: 'Zoom, Google Meet, Teams or similar link. Required when eventType is "online" or "hybrid".',
    example: 'https://zoom.us/j/123456789',
    required: false,
  })
  @ValidateIf((o) => o.eventType === 'online' || o.eventType === 'hybrid')
  @IsUrl({}, { message: 'Meeting link must be a valid URL' })
  @IsNotEmpty({ message: 'Meeting link is required for online and hybrid events' })
  meetingLink?: string;

  @ApiProperty({ description: 'Event start and end times', type: () => ScheduleDto })
  @ValidateNested()
  @Type(() => ScheduleDto)
  @IsNotEmpty()
  schedule: ScheduleDto;

  @ApiProperty({
    description: 'At least one tier required. Total quantity across all tiers must not exceed capacity.',
    type: () => [TicketTierDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTierDto)
  @ArrayMinSize(1, { message: 'At least one ticket tier is required' })
  ticketTiers: TicketTierDto[];

  @ApiProperty({ description: 'Maximum total attendees. Must be >= sum of all tier quantities.', example: 700, minimum: 1 })
  @IsNumber()
  @Min(1)
  capacity: number;

  @ApiProperty({ description: 'Notification schedule for ticket holders', required: false, type: () => EventRemindersDto })
  @ValidateNested()
  @Type(() => EventRemindersDto)
  @IsOptional()
  reminders?: EventRemindersDto;

  @ApiProperty({ description: 'Pin event to the featured list', example: false, required: false, default: false })
  @IsOptional()
  isFeatured?: boolean = false;
}