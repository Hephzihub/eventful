import { PartialType } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiProperty({
    description: 'Override event status directly. Use POST /:id/publish for the standard publish flow.',
    enum: ['draft', 'published', 'cancelled', 'completed'],
    required: false,
  })
  @IsEnum(['draft', 'published', 'cancelled', 'completed'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Update the URL slug. Must be unique across all events.',
    example: 'burna-boy-lagos-2026-updated',
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
    description: 'Cannot be changed after tickets have been sold.',
    enum: ['physical', 'online', 'hybrid'],
    required: false,
  })
  @IsEnum(['physical', 'online', 'hybrid'])
  @IsOptional()
  eventType?: string;
}