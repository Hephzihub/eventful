import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
	@ApiProperty({ description: 'Amount paid', example: 10000 })
	amount: number;

	@ApiProperty({ description: 'User ID', example: 'userId123' })
	userId: string;

	@ApiProperty({ description: 'Event ID', example: 'eventId123' })
	eventId: string;

	@ApiProperty({ description: 'Payment method', example: 'card' })
	method: string;
}
