import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Paystack transaction reference',
    example: 'EVT-1709212800000-ABC123X',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class QueryPaymentsDto {
  @ApiProperty({
    description: 'Filter by payment status',
    enum: ['pending', 'success', 'failed', 'refunded'],
    required: false,
  })
  @IsEnum(['pending', 'success', 'failed', 'refunded'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Filter payments for a specific event',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiProperty({
    description: 'Filter payments from this date',
    example: '2025-01-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Filter payments until this date',
    example: '2025-12-31T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

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
