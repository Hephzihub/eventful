import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
	@ApiProperty({ description: 'Event ID', example: 'eventId123' })
	eventId: string;

	@ApiProperty({ description: 'User ID', example: 'userId123' })
	userId: string;

	@ApiProperty({ description: 'Ticket tier', example: 'VIP' })
	tier: string;

	@ApiProperty({ description: 'Quantity', example: 2 })
	quantity: number;
}
