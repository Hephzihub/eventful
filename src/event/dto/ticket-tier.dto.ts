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
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddTicketTierDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ description: 'Ticket tier name', example: 'VIP' })
  name: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Price of the ticket tier', example: 5000 })
  price: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Currency of the ticket price', example: 'NGN', required: false, default: 'NGN' })
  currency?: string = 'NGN';

  @IsNumber()
  @Min(1)
  @ApiProperty({ description: 'Quantity of tickets available for this tier', example: 100 })
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({ description: 'Benefits included in this ticket tier', example: ['Access to VIP lounge', 'Free drinks'], required: false })
  benefits?: string[] = [];

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Start date for ticket sales', example: '2024-07-01T10:00:00Z' })
  salesStart: string;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({ description: 'End date for ticket sales', example: '2024-07-15T23:59:59Z' })
  salesEnd: string;
}

export class UpdateTicketTierDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ description: 'Ticket tier name', example: 'VIP', required: false })
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({ description: 'Price of the ticket tier', example: 5000, required: false }) 
  price?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @ApiProperty({ description: 'Quantity of tickets available for this tier', example: 100, required: false })
  quantity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({ description: 'Benefits included in this ticket tier', example: ['Access to VIP lounge', 'Free drinks'], required: false })
  benefits?: string[];

  @IsDateString()
  @IsOptional()
  @ApiProperty({ description: 'Start date for ticket sales', example: '2024-07-01T10:00:00Z', required: false })
  salesStart?: string;

  @IsDateString()
  @IsOptional()
  @ApiProperty({ description: 'End date for ticket sales', example: '2024-07-15T23:59:59Z', required: false })
  salesEnd?: string;
}