import { ApiProperty } from '@nestjs/swagger';

class UserProfileDto {
  @ApiProperty({ example: 'Oluwasegun Adedeji' })
  fullName: string;

  @ApiProperty({ example: '08132638235' })
  phone: string;
}

class UserDto {
  @ApiProperty({ example: 'oluwasheges@gmail.com' })
  email: string;

  @ApiProperty({ example: 'creator' })
  role: string;

  @ApiProperty({ type: UserProfileDto })
  profile: UserProfileDto;

  @ApiProperty({ example: false })
  isVerified: boolean;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'User registered successfully' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
