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
  @ApiProperty({ description: 'Category filter', enum: ['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'], required: false })
  @IsEnum(['Concerts', 'Theater', 'Sports', 'Culture', 'Comedy', 'Festival'])
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Event type filter', enum: ['physical', 'online', 'hybrid'], required: false })
  @IsEnum(['physical', 'online', 'hybrid'])
  @IsOptional()
  eventType?: string;

  @ApiProperty({ description: 'Status filter', enum: ['draft', 'published', 'cancelled', 'completed'], required: false, default: 'published' })
  @IsEnum(['draft', 'published', 'cancelled', 'completed'])
  @IsOptional()
  status?: string = 'published';

  @ApiProperty({ description: 'City filter', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'State filter', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Minimum price', required: false })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxPrice?: number;

  // Date range filters
  @IsDateString()
  @IsOptional()
  startDate?: string; // Events starting after this date

  @IsDateString()
  @IsOptional()
  endDate?: string; // Events starting before this date

  // Search query
  @IsString()
  @IsOptional()
  search?: string; // Search in title and description

  // Pagination
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  // Sorting
  @IsEnum(['date', 'price', 'popular', 'newest'])
  @IsOptional()
  sort?: string = 'date'; // Default sort by date

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  order?: string = 'asc'; // Default ascending

  // Feature filters
  @IsOptional()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  isLive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  excludeSoldOut?: boolean; // Exclude sold out events
}