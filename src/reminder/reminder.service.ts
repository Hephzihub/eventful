import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../event/event.schema';
import { Ticket, TicketDocument } from '../ticket/ticket.schema';
import { User, UserDocument } from 'src/users/user.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailService: EmailService,
  ) {}

  /**
   * Check for events that need reminders and send them
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendEventReminders() {
    this.logger.log('🔔 Starting event reminder check...');

    try {
      // Find upcoming events with reminders enabled
      const upcomingEvents = await this.eventModel
        .find({
          status: 'published',
          'schedule.startDate': {
            $gte: new Date(), // Future events only
            $lte: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // Within next 8 days
          },
          'reminders.enabled': true,
        })
        .exec();

      this.logger.log(`📧 Found ${upcomingEvents.length} upcoming events with reminders enabled`);

      for (const event of upcomingEvents) {
        await this.checkAndSendReminders(event);
      }

      this.logger.log('✅ Event reminder check completed');

      // Process user-set reminder intervals
      await this.sendUserSetReminders();
    } catch (error) {
      this.logger.error(`❌ Error in sendEventReminders: ${error.message}`, error.stack);
    }
  }

  /**
   * Process eventee-configured reminder intervals
   */
  private async sendUserSetReminders() {
    try {
      const ticketsWithReminders = await this.ticketModel
        .find({
          status: 'valid',
          'userReminderIntervals.0': { $exists: true },
        })
        .populate('eventId')
        .populate('userId')
        .exec();

      for (const ticket of ticketsWithReminders) {
        const event = ticket.eventId as any;
        if (!event || event.status !== 'published') continue;

        const hoursUntil =
          (new Date(event.schedule.startDate).getTime() - Date.now()) / 3_600_000;

        for (const interval of ticket.userReminderIntervals) {
          if (hoursUntil >= interval - 1 && hoursUntil < interval) {
            const user = ticket.userId as any;
            await this.sendReminderEmail(user, event, [ticket], Math.round(hoursUntil));
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in sendUserSetReminders: ${error.message}`, error.stack);
    }
  }

  /**
   * Check if an event needs reminders sent for any interval
   */
  private async checkAndSendReminders(event: EventDocument) {
    const eventStartTime = new Date(event.schedule.startDate).getTime();
    const now = Date.now();
    const hoursUntilEvent = (eventStartTime - now) / (1000 * 60 * 60);

    // Get reminder intervals (default: 24 and 168 hours before event)
    const intervals = event.reminders?.intervals || [24, 168];

    for (const interval of intervals) {
      // Check if we're in the window to send this reminder
      // Send when hoursUntilEvent is between interval-1 and interval
      const lowerBound = interval - 1;
      const upperBound = interval;

      if (hoursUntilEvent >= lowerBound && hoursUntilEvent < upperBound) {
        this.logger.log(
          `⏰ Sending ${interval}h reminder for: ${event.title} (ID: ${event._id})`,
        );
        await this.sendRemindersForEvent(event, Math.round(hoursUntilEvent));
        break; // Only send one reminder per check
      }
    }
  }

  /**
   * Send reminder emails to all ticket holders for an event
   */
  private async sendRemindersForEvent(event: EventDocument, hoursUntilEvent: number) {
    try {
      // Find all valid tickets for this event
      const tickets = await this.ticketModel
        .find({
          eventId: event._id,
          status: 'valid', // Only remind valid ticket holders
        })
        .populate('userId')
        .exec();

      if (tickets.length === 0) {
        this.logger.log(`No valid tickets found for event: ${event.title}`);
        return;
      }

      this.logger.log(`📬 Sending reminders to ${tickets.length} ticket holders`);

      // Group tickets by user (one email per user with all their tickets)
      const ticketsByUser = new Map<string, TicketDocument[]>();

      for (const ticket of tickets) {
        const userId = (ticket.userId as any)._id.toString();
        if (!ticketsByUser.has(userId)) {
          ticketsByUser.set(userId, []);
        }
        const userTicketsList = ticketsByUser.get(userId);
        if (userTicketsList) {
          userTicketsList.push(ticket);
        }
      }

      // Send emails concurrently
      const emailPromises: Promise<void>[] = [];

      for (const [userId, userTickets] of ticketsByUser) {
        const user = userTickets[0].userId as any;
        emailPromises.push(
          this.sendReminderEmail(user, event, userTickets, hoursUntilEvent),
        );
      }

      await Promise.allSettled(emailPromises);

      this.logger.log(
        `✅ Successfully processed ${emailPromises.length} reminder emails for: ${event.title}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error sending reminders for event ${event._id}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send individual reminder email to a user
   */
  private async sendReminderEmail(
    user: any,
    event: EventDocument,
    tickets: TicketDocument[],
    hoursUntilEvent: number,
  ): Promise<void> {
    try {
      const userEmail = user.email;
      const userName = user.profile?.fullName || user.email.split('@')[0];

      await this.emailService.sendEventReminder(
        userEmail,
        userName,
        event,
        tickets,
        hoursUntilEvent,
      );

      this.logger.log(`✉️ Reminder sent to ${userEmail} for: ${event.title}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send reminder to ${user.email}: ${error.message}`,
      );
      // Don't throw - continue with other emails
    }
  }

  /**
   * Mark past events as completed
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markEventsAsCompleted() {
    this.logger.log('🕐 Checking for completed events...');

    try {
      const result = await this.eventModel.updateMany(
        {
          status: 'published',
          'schedule.endDate': { $lt: new Date() },
        },
        {
          $set: { status: 'completed' },
        },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`✅ Marked ${result.modifiedCount} events as completed`);
      } else {
        this.logger.log('No events to mark as completed');
      }
    } catch (error) {
      this.logger.error(`❌ Error marking events as completed: ${error.message}`);
    }
  }

  /**
   * Update live event status
   * Mark events as live when happening now
   * Runs every 15 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateLiveEventStatus() {
    this.logger.log('🔴 Updating live event status...');

    try {
      const now = new Date();

      // Mark events as live if happening right now
      const liveResult = await this.eventModel.updateMany(
        {
          status: 'published',
          isLive: false,
          'schedule.startDate': { $lte: now },
          'schedule.endDate': { $gte: now },
        },
        {
          $set: { isLive: true },
        },
      );

      // Mark events as not live if they've ended
      const notLiveResult = await this.eventModel.updateMany(
        {
          isLive: true,
          'schedule.endDate': { $lt: now },
        },
        {
          $set: { isLive: false },
        },
      );

      if (liveResult.modifiedCount > 0 || notLiveResult.modifiedCount > 0) {
        this.logger.log(
          `✅ Updated: ${liveResult.modifiedCount} now live, ${notLiveResult.modifiedCount} no longer live`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error updating live event status: ${error.message}`);
    }
  }

  /**
   * Send manual reminder for an event
   * Can be called by event creators
   */
  async sendManualReminder(eventId: string, creatorId: string) {
    this.logger.log(`📤 Manual reminder requested for event: ${eventId}`);

    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    // Verify creator owns the event
    if (event.creatorId.toString() !== creatorId) {
      throw new Error('Only the event creator can send reminders');
    }

    // Check event is in the future
    if (new Date(event.schedule.startDate) < new Date()) {
      throw new Error('Cannot send reminders for past events');
    }

    const eventStartTime = new Date(event.schedule.startDate).getTime();
    const now = Date.now();
    const hoursUntilEvent = Math.round((eventStartTime - now) / (1000 * 60 * 60));

    // Send reminders
    await this.sendRemindersForEvent(event, hoursUntilEvent);

    // Count recipients
    const recipientCount = await this.ticketModel.countDocuments({
      eventId: event._id,
      status: 'valid',
    });

    this.logger.log(
      `✅ Manual reminder sent for event: ${event.title} to ${recipientCount} recipients`,
    );

    return {
      message: 'Reminder sent successfully',
      recipientCount,
      hoursUntilEvent,
    };
  }

  /**
   * Get reminder statistics for an event
   */
  async getReminderStats(eventId: string, creatorId: string) {
    const event = await this.eventModel.findById(eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.creatorId.toString() !== creatorId) {
      throw new Error('Only the event creator can view statistics');
    }

    const validTickets = await this.ticketModel.countDocuments({
      eventId: event._id,
      status: 'valid',
    });

    const eventStartTime = new Date(event.schedule.startDate).getTime();
    const now = Date.now();
    const hoursUntilEvent = Math.round((eventStartTime - now) / (1000 * 60 * 60));

    return {
      event: {
        id: event._id,
        title: event.title,
        startDate: event.schedule.startDate,
        hoursUntilEvent: hoursUntilEvent > 0 ? hoursUntilEvent : 0,
        isPast: hoursUntilEvent < 0,
      },
      reminders: {
        enabled: event.reminders?.enabled || false,
        intervals: event.reminders?.intervals || [24, 168],
      },
      recipients: {
        total: validTickets,
      },
    };
  }
}
