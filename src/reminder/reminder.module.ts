import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { Event, EventSchema } from '../event/event.schema';
import { Ticket, TicketSchema } from '../ticket/ticket.schema';
import { User, UserSchema } from 'src/users/user.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule, // For sending reminder emails
  ],
  controllers: [ReminderController],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
