import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { Event, EventSchema } from './event.schema';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
    ]),
    UploadModule,
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}