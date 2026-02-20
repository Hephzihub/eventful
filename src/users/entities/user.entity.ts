import { ApiProperty } from '@nestjs/swagger';

class UserProfileEntity {
  @ApiProperty({ example: 'Oluwasegun Adedeji' })
  fullName: string;

  @ApiProperty({ example: '08132638235', required: false })
  phone?: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
  avatar?: string;
}

export class UserEntity {
  @ApiProperty({ example: 'oluwasheges@gmail.com' })
  email: string;

  @ApiProperty({ example: 'creator' })
  role: string;

  @ApiProperty({ type: UserProfileEntity })
  profile: UserProfileEntity;

  @ApiProperty({ example: false })
  isVerified: boolean;
}
