import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from './ticket.schema';
import { EventSchema } from 'src/event/event.schema';
import { QrCodeService } from './qr-code.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }, 
      { name: Event.name, schema: EventSchema}
    ])
  ],
  controllers: [TicketController],
  providers: [TicketService, QrCodeService],
  exports: [TicketService, QrCodeService],
})
export class TicketModule {}
