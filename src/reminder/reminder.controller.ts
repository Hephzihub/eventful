import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReminderService } from './reminder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reminders')
@Controller('reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  /**
   * Send manual reminder to all ticket holders
   * Only event creator can do this
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Post('event/:eventId/send')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Send manual reminder to all ticket holders',
    description:
      'Immediately send a reminder email to all valid ticket holders for the event. Only the event creator can send manual reminders.',
  })
  @ApiParam({ name: 'eventId', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({
    status: 201,
    description: 'Reminder sent successfully',
    schema: {
      example: {
        message: 'Reminder sent successfully',
        recipientCount: 150,
        hoursUntilEvent: 48,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot send reminders for past events' })
  @ApiResponse({ status: 403, description: 'Only event creator can send reminders' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async sendManualReminder(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.reminderService.sendManualReminder(eventId, user._id);
  }

  /**
   * Get reminder statistics for an event
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @Get('event/:eventId/stats')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get reminder statistics for an event',
    description:
      'View reminder settings and recipient count for an event. Only the event creator can access this.',
  })
  @ApiParam({ name: 'eventId', description: 'MongoDB ObjectId of the event' })
  @ApiResponse({
    status: 200,
    description: 'Reminder statistics',
    schema: {
      example: {
        event: {
          id: '507f1f77bcf86cd799439011',
          title: 'Lagos Music Festival',
          startDate: '2025-12-20T18:00:00Z',
          hoursUntilEvent: 168,
          isPast: false,
        },
        reminders: {
          enabled: true,
          intervals: [24, 168],
        },
        recipients: {
          total: 250,
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only event creator can view statistics' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getReminderStats(
    @Param('eventId') eventId: string,
    @CurrentUser() user: any,
  ) {
    return this.reminderService.getReminderStats(eventId, user._id);
  }
}
