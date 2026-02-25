const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Register custom helpers used in the reminder template
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('lt', (a, b) => a < b);
handlebars.registerHelper('math', (a, op, b) => {
  if (op === '/') return Math.round(a / b);
  if (op === '*') return a * b;
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return 0;
});

const templatesDir = path.join(__dirname, 'src', 'email', 'templates');
const TO = process.env.EMAIL_USER;
const FROM = process.env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
});

function loadTemplate(name) {
  const src = fs.readFileSync(path.join(templatesDir, `${name}.hbs`), 'utf-8');
  return handlebars.compile(src);
}

async function send(subject, html, attachments = []) {
  await transporter.sendMail({ from: FROM, to: TO, subject, html, attachments });
  console.log(`  ✅  Sent: ${subject}`);
}

async function main() {
  await transporter.verify();
  console.log('Connection OK — sending all 5 template emails to', TO, '\n');

  const year = new Date().getFullYear();
  const eventTitle = 'Burna Boy Live in Lagos';
  const userName = 'Segun Adedeji';
  const ticketNumber = 'TKT-2026-XY94781';
  const reference = 'EVT-1740000000-ABC123';

  // Generate real QR code images as buffers (CID attachments work in all email clients)
  async function makeQrAttachment(index, ticketId) {
    const buffer = await QRCode.toBuffer(
      JSON.stringify({ ticketId, eventId: '507f1f77bcf86cd799439012' }),
      { errorCorrectionLevel: 'H', type: 'png', width: 300 },
    );
    return { filename: `qr-${index}.png`, content: buffer, cid: `qr-${index}` };
  }

  const qrAttachment0 = await makeQrAttachment(0, '507f1f77bcf86cd799439016');
  const qrAttachment1 = await makeQrAttachment(1, '507f1f77bcf86cd799439017');

  // ── 1. Ticket Confirmation (with CID QR codes) ─────────────────────────────
  const ticketConfirmHtml = loadTemplate('ticket-confirmation')({
    userName,
    eventTitle,
    eventDate: 'Saturday, 15 August 2026',
    eventTime: '07:00 PM',
    venue: 'Eko Hotel & Suites, Victoria Island, Lagos',
    meetingLink: null,
    tickets: [
      { ticketNumber, tierName: 'VIP', attendeeName: userName, qrCid: 'qr-0' },
      { ticketNumber: 'TKT-2026-ZZ11222', tierName: 'VIP', attendeeName: 'Tolu Adedeji', qrCid: 'qr-1' },
    ],
    totalTickets: 2,
    year,
  });
  await send(`Your Tickets for ${eventTitle}`, ticketConfirmHtml, [qrAttachment0, qrAttachment1]);

  // ── 2. Payment Receipt ─────────────────────────────────────────────────────
  const paymentReceiptHtml = loadTemplate('payment-receipt')({
    userName,
    eventTitle,
    reference,
    amount: '94,500',
    currency: 'NGN',
    subtotal: '90,000',
    platformFee: '4,500',
    paidAt: new Date().toLocaleString('en-NG'),
    paymentMethod: 'card',
    tickets: [
      { tierName: 'VIP', quantity: 2, unitPrice: '45,000', total: '90,000', currency: 'NGN' },
    ],
    year,
  });
  await send(`Payment Receipt - ${reference}`, paymentReceiptHtml);

  // ── 3. Event Reminder (7 days out) ────────────────────────────────────────
  const reminderHtml = loadTemplate('event-reminder')({
    userName,
    eventTitle,
    eventDate: 'Saturday, 15 August 2026',
    eventTime: '07:00 PM',
    venue: 'Eko Hotel & Suites, Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos',
    meetingLink: null,
    hoursUntilEvent: 168, // 7 days
    ticketNumbers: `${ticketNumber}, TKT-2026-ZZ11222`,
    totalTickets: 2,
    year,
  });
  await send(`Reminder: ${eventTitle} in 7 days`, reminderHtml);

  // ── 4. Cancellation Confirmation ──────────────────────────────────────────
  const cancellationHtml = loadTemplate('cancellation')({
    userName,
    eventTitle,
    ticketNumber,
    refundAmount: '45,000',
    currency: 'NGN',
    refundTimeline: '5-10 business days',
    year,
  });
  await send(`Ticket Cancelled - ${ticketNumber}`, cancellationHtml);

  // ── 5. Payment Failed ─────────────────────────────────────────────────────
  const paymentFailedHtml = loadTemplate('payment-failed')({
    userName,
    eventTitle,
    reference,
    reason: 'Insufficient funds',
    retryLink: `http://localhost:3000/events/507f1f77bcf86cd799439012`,
    year,
  });
  await send('Payment Failed - Please Try Again', paymentFailedHtml);

  console.log('\nAll 5 emails sent! Check your inbox.');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});