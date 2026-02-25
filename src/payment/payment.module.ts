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
import { EmailModule } from 'src/email/email.module';
import { User, UserSchema } from 'src/users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: User.name, schema: UserSchema }
    ]),
    TicketModule, // Import to use TicketsService
    EmailModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, PaystackService],
  exports: [PaymentService, PaystackService],
})
export class PaymentModule {}
