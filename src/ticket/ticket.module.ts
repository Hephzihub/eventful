import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from './ticket.schema';
import { EventSchema, Event } from 'src/event/event.schema';
import { QrCodeService } from './qr-code.service';
import { EmailModule } from 'src/email/email.module';
import { User, UserSchema } from 'src/users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema }, 
      { name: Event.name, schema: EventSchema},
      { name: User.name, schema: UserSchema }
    ]),
    EmailModule,
  ],
  controllers: [TicketController],
  providers: [TicketService, QrCodeService],
  exports: [TicketService, QrCodeService],
})
export class TicketModule {}
