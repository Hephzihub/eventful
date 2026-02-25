import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { WebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { PaystackService } from './paystack.service';
import { Payment, PaymentSchema } from './payment.schema';
import { Event, EventSchema } from '../event/event.schema';
import { Ticket, TicketSchema } from '../ticket/ticket.schema';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
    TicketModule, // Import to use TicketsService
  ],
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, PaystackService],
  exports: [PaymentService, PaystackService],
})
export class PaymentModule {}
