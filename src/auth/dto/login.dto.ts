import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @IsEmail({}, {message: 'Please provide a valid email address'})
  @IsNotEmpty()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'oluwashsges@gmail.com'
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The password of the user',
    example: 'P@ssw0rd123'
  })
  password: string;
}