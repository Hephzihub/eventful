import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTicketTierDto {
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

  @ApiProperty({ description: 'Total tickets available for this tier', example: 100, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Perks included with this tier',
    example: ['Access to VIP lounge', 'Free drinks'],
    required: false,
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[] = [];

  @ApiProperty({ description: 'When ticket sales open for this tier', example: '2026-07-01T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  salesStart: string;

  @ApiProperty({ description: 'When ticket sales close. Must be strictly before event startDate.', example: '2026-08-14T23:59:00Z' })
  @IsDateString()
  @IsNotEmpty()
  salesEnd: string;
}

export class UpdateTicketTierDto {
  @ApiProperty({ description: 'Rename the tier', example: 'VIP', required: false, minLength: 2, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiProperty({ description: 'Update price. Existing purchases are not affected.', example: 5000, required: false, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Adjust available quantity. Cannot be reduced below tickets already sold.', example: 100, required: false, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Full replacement of benefits array — not a merge. Send the complete desired list.',
    example: ['Access to VIP lounge', 'Free drinks'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[];

  @ApiProperty({ description: 'Adjust when sales open. Must be before salesEnd.', example: '2026-07-01T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  salesStart?: string;

  @ApiProperty({ description: 'Adjust when sales close. Must be strictly before event startDate.', example: '2026-08-14T23:59:00Z', required: false })
  @IsDateString()
  @IsOptional()
  salesEnd?: string;
}