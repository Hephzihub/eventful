import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter() {
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

    if (!emailHost || !emailUser || !emailPassword) {
      this.logger.warn(
        'Email configuration incomplete. Email sending disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.logger.log('Email transporter initialized');
  }

  private loadTemplates() {
    // Use process.cwd() to get project root, then point to src or dist
    let templatesDir: string;

    // Check if running from dist (production) or src (development)
    const distPath = path.join(process.cwd(), 'dist', 'email', 'templates');
    const srcPath = path.join(process.cwd(), 'src', 'email', 'templates');

    if (fs.existsSync(distPath)) {
      templatesDir = distPath;
    } else if (fs.existsSync(srcPath)) {
      templatesDir = srcPath;
    } else {
      this.logger.error('Email templates directory not found in dist or src');
      this.logger.error(`Tried: ${distPath}`);
      this.logger.error(`Tried: ${srcPath}`);
      return;
    }

    this.logger.log(`Loading templates from: ${templatesDir}`);

    const templateFiles = [
      'ticket-confirmation.hbs',
      'payment-receipt.hbs',
      'event-reminder.hbs',
      'cancellation.hbs',
      'payment-failed.hbs',
    ];

    templateFiles.forEach((file) => {
      const templatePath = path.join(templatesDir, file);
      if (fs.existsSync(templatePath)) {
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        const template = handlebars.compile(templateSource);
        const templateName = file.replace('.hbs', '');
        this.templates.set(templateName, template);
        this.logger.log(`✅ Template loaded: ${templateName}`);
      } else {
        this.logger.warn(`❌ Template not found: ${file}`);
      }
    });
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: any[],
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not configured. Skipping email.');
      return;
    }

    try {
      const from = this.configService.get<string>(
        'EMAIL_FROM',
        'Eventful <noreply@eventful.com>',
      );

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  // ==================== TICKET CONFIRMATION EMAIL ====================
  async sendTicketConfirmation(
    userEmail: string,
    userName: string,
    event: any,
    tickets: any[],
    qrCodes: Array<{ ticketNumber: string; qrCodeImage: string }>,
  ): Promise<void> {
    const template = this.templates.get('ticket-confirmation');

    if (!template) {
      this.logger.warn('Ticket confirmation template not found');
      return;
    }

    const html = template({
      userName,
      eventTitle: event.title,
      eventDate: new Date(event.schedule.startDate).toLocaleDateString(
        'en-NG',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      ),
      eventTime: new Date(event.schedule.startDate).toLocaleTimeString(
        'en-NG',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      ),
      venue:
        event.eventType === 'physical' || event.eventType === 'hybrid'
          ? `${event.venue.name}, ${event.venue.city}`
          : 'Online Event',
      meetingLink: event.meetingLink,
      tickets: tickets.map((ticket, index) => ({
        ticketNumber: ticket.ticketNumber,
        tierName: ticket.tierName,
        attendeeName: ticket.attendeeName,
        qrCodeImage: qrCodes[index]?.qrCodeImage,
      })),
      totalTickets: tickets.length,
      year: new Date().getFullYear(),
    });

    await this.sendEmail(userEmail, `Your Tickets for ${event.title}`, html);
  }

  // ==================== PAYMENT RECEIPT EMAIL ====================
  async sendPaymentReceipt(
    userEmail: string,
    userName: string,
    payment: any,
    event: any,
  ): Promise<void> {
    const template = this.templates.get('payment-receipt');

    if (!template) {
      this.logger.warn('Payment receipt template not found');
      return;
    }

    const html = template({
      userName,
      eventTitle: event.title,
      reference: payment.paystack.reference,
      amount: payment.amount.toLocaleString('en-NG'),
      currency: payment.currency,
      subtotal: (payment.amount - payment.fees.platform).toLocaleString(
        'en-NG',
      ),
      platformFee: payment.fees.platform.toLocaleString('en-NG'),
      paidAt: new Date(payment.paidAt).toLocaleString('en-NG'),
      paymentMethod: payment.paystack.channel,
      tickets: payment.tickets.map((t: any) => ({
        tierName: t.tierName,
        quantity: t.quantity,
        unitPrice: t.unitPrice.toLocaleString('en-NG'),
        total: (t.quantity * t.unitPrice).toLocaleString('en-NG'),
      })),
      year: new Date().getFullYear(),
    });

    await this.sendEmail(
      userEmail,
      `Payment Receipt - ${payment.paystack.reference}`,
      html,
    );
  }

  // ==================== EVENT REMINDER EMAIL ====================
  async sendEventReminder(
    userEmail: string,
    userName: string,
    event: any,
    tickets: any[],
    hoursUntilEvent: number,
  ): Promise<void> {
    const template = this.templates.get('event-reminder');

    if (!template) {
      this.logger.warn('Event reminder template not found');
      return;
    }

    const html = template({
      userName,
      eventTitle: event.title,
      eventDate: new Date(event.schedule.startDate).toLocaleDateString(
        'en-NG',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      ),
      eventTime: new Date(event.schedule.startDate).toLocaleTimeString(
        'en-NG',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      ),
      venue:
        event.eventType === 'physical' || event.eventType === 'hybrid'
          ? `${event.venue.name}, ${event.venue.address}, ${event.venue.city}`
          : 'Online Event',
      meetingLink: event.meetingLink,
      hoursUntilEvent,
      ticketNumbers: tickets.map((t) => t.ticketNumber).join(', '),
      totalTickets: tickets.length,
      year: new Date().getFullYear(),
    });

    const subject =
      hoursUntilEvent <= 24
        ? `Reminder: ${event.title} is tomorrow!`
        : `Reminder: ${event.title} in ${Math.round(hoursUntilEvent / 24)} days`;

    await this.sendEmail(userEmail, subject, html);
  }

  // ==================== CANCELLATION CONFIRMATION EMAIL ====================
  async sendCancellationConfirmation(
    userEmail: string,
    userName: string,
    event: any,
    ticket: any,
    refundAmount: number,
  ): Promise<void> {
    const template = this.templates.get('cancellation');

    if (!template) {
      this.logger.warn('Cancellation template not found');
      return;
    }

    const html = template({
      userName,
      eventTitle: event.title,
      ticketNumber: ticket.ticketNumber,
      refundAmount: refundAmount.toLocaleString('en-NG'),
      currency: 'NGN',
      refundTimeline: '5-10 business days',
      year: new Date().getFullYear(),
    });

    await this.sendEmail(
      userEmail,
      `Ticket Cancelled - ${ticket.ticketNumber}`,
      html,
    );
  }

  // ==================== PAYMENT FAILED EMAIL ====================
  async sendPaymentFailed(
    userEmail: string,
    userName: string,
    event: any,
    reference: string,
    reason: string,
  ): Promise<void> {
    const template = this.templates.get('payment-failed');

    if (!template) {
      this.logger.warn('Payment failed template not found');
      return;
    }

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const html = template({
      userName,
      eventTitle: event.title,
      reference,
      reason,
      retryLink: `${frontendUrl}/events/${event._id}`,
      year: new Date().getFullYear(),
    });

    await this.sendEmail(userEmail, `Payment Failed - Please Try Again`, html);
  }

  // ==================== TEST EMAIL CONNECTION ====================
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Email connection verified');
      return true;
    } catch (error) {
      this.logger.error('Email connection failed', error);
      return false;
    }
  }
}
