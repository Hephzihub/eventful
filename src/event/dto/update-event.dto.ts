import { PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  // Override status to allow updating
  @IsEnum(['draft', 'published', 'cancelled', 'completed'])
  @IsOptional()
  status?: string;

  // Slug can be updated but must be unique
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(300)
  slug?: string;

  // Can't change event type if tickets sold (enforced in service)
  @IsEnum(['physical', 'online', 'hybrid'])
  @IsOptional()
  eventType?: string;
}