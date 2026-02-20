import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryTicketsDto {
  @ApiProperty({
    description: 'Filter tickets by status',
    enum: ['valid', 'used', 'cancelled', 'refunded'],
    required: false,
  })
  @IsEnum(['valid', 'used', 'cancelled', 'refunded'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Filter tickets for a specific event',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiProperty({
    description: 'Show only tickets for upcoming events',
    example: true,
    required: false,
  })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  upcoming?: boolean;

  @ApiProperty({
    description: 'Show only tickets for past events',
    example: false,
    required: false,
  })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  past?: boolean;

  @ApiProperty({
    description: 'Pagination page number',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Results per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 20,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
