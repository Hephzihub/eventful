import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanTicketDto {
  @ApiProperty({
    description: 'Encrypted QR code data from the ticket',
    example: 'U2FsdGVkX1+5h3j2k4l6m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5',
  })
  @IsString()
  @IsNotEmpty()
  qrCodeData: string;
}
