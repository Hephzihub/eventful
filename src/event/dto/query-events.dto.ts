import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryEventsDto {
  @ApiProperty({
    description: 'Filter by event category',
    enum: ['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'],
    required: false,
  })
  @IsEnum(['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'])
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Filter by event format', enum: ['physical', 'online', 'hybrid'], required: false })
  @IsEnum(['physical', 'online', 'hybrid'])
  @IsOptional()
  eventType?: string;

  @ApiProperty({
    description: 'Filter by status. Leave as default for public browsing.',
    enum: ['draft', 'published', 'cancelled', 'completed'],
    required: false,
    default: 'published',
  })
  @IsEnum(['draft', 'published', 'cancelled', 'completed'])
  @IsOptional()
  status?: string = 'published';

  @ApiProperty({ description: 'Filter by venue city. Case-insensitive partial match.', example: 'Lagos', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'Filter by venue state. Case-insensitive partial match.', example: 'Lagos', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Minimum ticket price filter', example: 5000, minimum: 0, required: false })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minPrice?: number;

  @ApiProperty({ description: 'Maximum ticket price filter', example: 50000, minimum: 0, required: false })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxPrice?: number;

  @ApiProperty({ description: 'Return events starting on or after this date', example: '2026-01-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'Return events starting on or before this date', example: '2026-12-31T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Full-text search across title and description', example: 'Burna Boy', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Pagination page number', example: 1, minimum: 1, required: false, default: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Results per page', example: 20, minimum: 1, maximum: 100, required: false, default: 20 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({ description: 'Sort field', enum: ['date', 'price', 'popular', 'newest'], required: false, default: 'date' })
  @IsEnum(['date', 'price', 'popular', 'newest'])
  @IsOptional()
  sort?: string = 'date';

  @ApiProperty({ description: 'Sort direction', enum: ['asc', 'desc'], required: false, default: 'asc' })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  order?: string = 'asc';

  @ApiProperty({ description: 'Return only featured events', required: false })
  @IsOptional()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiProperty({ description: 'Return only currently live events', required: false })
  @IsOptional()
  @Type(() => Boolean)
  isLive?: boolean;

  @ApiProperty({ description: 'Exclude fully sold out events', required: false })
  @IsOptional()
  @Type(() => Boolean)
  excludeSoldOut?: boolean;
}