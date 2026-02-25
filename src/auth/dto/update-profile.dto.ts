import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class UpdateProfileDetailsDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '08012345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Profile fields to update (fullName and/or phone)',
    type: UpdateProfileDetailsDto,
    required: false,
  })
  @ValidateNested()
  @Type(() => UpdateProfileDetailsDto)
  @IsOptional()
  profile?: UpdateProfileDetailsDto;
}