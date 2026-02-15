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

export class AddTicketTierDto {
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

export class UpdateTicketTierDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[];

  @IsDateString()
  @IsOptional()
  salesStart?: string;

  @IsDateString()
  @IsOptional()
  salesEnd?: string;
}