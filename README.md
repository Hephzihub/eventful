# Eventful API

A RESTful event management backend built with **NestJS**, **MongoDB**, and **Paystack**. It supports two user roles — **creators** who organize events and **eventees** who discover and attend them.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Documentation](#api-documentation)
- [Feature Guide](#feature-guide)
  - [Authentication](#authentication)
  - [Events](#events)
  - [Tickets](#tickets)
  - [Payments](#payments)
  - [Reminders](#reminders)
  - [Webhooks](#webhooks)
- [Roles & Access Control](#roles--access-control)
- [Testing](#testing)

---

## Features

- JWT-based authentication with role-based access control (`creator` / `eventee`)
- Avatar upload via Cloudinary
- Full event lifecycle: draft → publish → cancel / complete
- Multi-tier ticketing (Regular, VIP, VVIP) with per-tier sales windows
- QR code generation and scanning for event entry
- Paystack payment integration with webhook processing
- Automated and manual email reminders via Nodemailer + Handlebars templates
- Response caching on public endpoints
- Rate limiting on auth endpoints
- Swagger / OpenAPI documentation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | MongoDB via Mongoose |
| Auth | Passport.js — Local + JWT strategies |
| Payments | Paystack |
| File uploads | Cloudinary (`nestjs-cloudinary`) |
| Email | Nodemailer + Handlebars templates |
| Validation | `class-validator` / `class-transformer` |
| Caching | `@nestjs/cache-manager` |
| Rate limiting | `@nestjs/throttler` |
| Documentation | Swagger (`@nestjs/swagger`) |
| Testing | Jest + `ts-jest` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A running MongoDB instance (local or Atlas)
- Paystack account (for payments)
- Cloudinary account (for image uploads)
- SMTP credentials (for emails — optional in development)

### Installation

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/eventful

# JWT
JWT_SECRET=your_jwt_secret_here

# Paystack
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (optional — app runs without it)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=Eventful <noreply@eventful.com>

# Frontend (used in email links)
FRONTEND_URL=http://localhost:3000
```

---

## Running the App

```bash
# Development (with file watch)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server starts on `http://localhost:3000` (or the `PORT` you set).

---

## API Documentation

Interactive Swagger docs are available at:

```
http://localhost:3000/api
```

All protected endpoints require a **Bearer JWT token**. Click the **Authorize** button in Swagger and paste your token (obtained from `POST /api/auth/login` or `POST /api/auth/register`) to authenticate all subsequent requests.

---

## Feature Guide

### Authentication

**Base path:** `/api/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Create a new account (`role`: `creator` or `eventee`) |
| `POST` | `/login` | Public | Login and receive a JWT access token |
| `GET` | `/profile` | JWT | Get current user from the token payload |
| `GET` | `/me` | JWT | Get fresh user data fetched from the database |
| `PATCH` | `/profile` | JWT | Update `fullName` and/or `phone` |
| `POST` | `/profile/avatar` | JWT | Upload a new avatar image (JPEG / PNG / WebP, max 2 MB) |

**Registration roles:**
- `creator` — can create and manage events
- `eventee` — can browse events and purchase tickets

**Avatar upload** accepts a `multipart/form-data` request with a field named `avatar`. The image is automatically resized to 400×400 px (face-crop) and stored in Cloudinary. The returned URL is saved to the user's profile.

**Rate limits:**
- Register: 3 requests per 60 seconds
- Login: 5 requests per 60 seconds

---

### Events

**Base path:** `/api/events`

#### Public Endpoints (no token required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List published events (filters: title, category, city, eventType, date range, text search, pagination) |
| `GET` | `/featured` | List featured events |
| `GET` | `/upcoming` | Upcoming events, optionally filtered by city and category |
| `GET` | `/slug/:slug` | Get event by URL-friendly slug |
| `GET` | `/:id` | Get event by MongoDB ObjectId |
| `GET` | `/:id/share` | Get shareable links (Twitter, Facebook, WhatsApp, LinkedIn) |
| `GET` | `/:id/tiers/:tierId/availability` | Check ticket availability for a specific tier |

Public event listings are **cached for 2 minutes** to reduce database load.

#### Creator Endpoints (JWT + `creator` role required)

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new event (starts as `draft`) |
| `GET` | `/creator/my` | List all events you created (filterable by status) |
| `PATCH` | `/:id` | Update event details |
| `POST` | `/:id/publish` | Publish a draft event |
| `DELETE` | `/:id` | Delete event (or cancel if tickets have been sold) |
| `POST` | `/:id/images` | Upload an event image (JPEG / PNG / WebP, max 5 MB, up to 10 images per event) |
| `POST` | `/:id/tiers` | Add a ticket tier to an event |
| `PATCH` | `/:id/tiers/:tierId` | Update a ticket tier |
| `DELETE` | `/:id/tiers/:tierId` | Remove a ticket tier (blocked if tickets already sold for that tier) |

**Event lifecycle:** `draft` → `published` → `cancelled` / `completed`

**Event types:** `physical`, `online`, `hybrid`
- Physical and hybrid events require a `venue` (name, address, city, state)
- Online and hybrid events require a `meetingLink`

**Categories:** `Concerts`, `Theater`, `Sports`, `Culture`, `Comedy`, `Festival`

**Ticket tiers** are embedded within the event document. Each tier has its own price, capacity, currency, benefits list, and independent sales window (`salesStart` / `salesEnd`). Sales must close before the event starts.

---

### Tickets

**Base path:** `/api/tickets`

All ticket endpoints require authentication.

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/validate-purchase` | JWT | Step 1: Validate availability and calculate price before payment |
| `GET` | `/` | JWT | List all tickets you own (paginated) |
| `GET` | `/:id` | JWT | Get ticket details including QR code data |
| `GET` | `/:id/qr-code` | JWT | Get QR code as a base64 PNG image for printing |
| `DELETE` | `/:id` | JWT | Cancel ticket (allowed at least 24 hours before event) |
| `GET` | `/:id/reminders` | JWT | View your reminder intervals for a ticket |
| `PUT` | `/:id/reminders` | JWT | Set reminder hours before the event (e.g. `[168, 24, 1]`) |
| `DELETE` | `/:id/reminders` | JWT | Clear all reminders for a ticket |
| `POST` | `/scan` | JWT + `creator` | Scan a QR code to verify and admit an attendee |
| `GET` | `/event/:eventId` | JWT + `creator` | Get all tickets sold for your event |
| `GET` | `/event/:eventId/stats` | JWT + `creator` | Aggregated ticket statistics (total, used, cancelled, by tier) |

**Purchase flow:**
1. Call `POST /tickets/validate-purchase` with `eventId`, `tierId`, and `quantity`
2. Use the returned price to call `POST /payments/initiate`
3. Redirect the user to the Paystack checkout URL
4. On successful payment, tickets are automatically created and a confirmation email with QR codes is sent to the buyer

**Ticket statuses:** `valid` → `used` (after scan) → `cancelled` / `refunded`

**QR code:** Each ticket has a unique QR code. The creator scans it at the venue using `POST /tickets/scan`, which marks the ticket as `used`.

---

### Payments

**Base path:** `/api/payments`

All payment endpoints require authentication.

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/initiate` | JWT | Initiate payment — validates purchase, adds platform fee, returns a Paystack checkout URL |
| `GET` | `/verify/:reference` | JWT | Verify payment status after redirect from Paystack |
| `GET` | `/` | JWT | Payment history with filters (status, eventId, date range, pagination) |
| `GET` | `/:id` | JWT | Full payment details including fee breakdown |
| `GET` | `/event/:eventId/revenue` | JWT + `creator` | Revenue statistics for a specific event (by tier) |
| `GET` | `/creator/analytics` | JWT + `creator` | All-time aggregated analytics across all your events |

**Payment flow:**
1. `POST /payments/initiate` creates a pending payment record and returns a `paymentUrl`
2. User completes payment on Paystack's hosted checkout page
3. Paystack sends a webhook to `POST /webhooks/paystack`
4. The webhook handler verifies the signature, marks the payment as `success`, and creates the tickets
5. A confirmation email with QR codes is sent to the buyer

**Fee structure:** A 2.5% platform fee is added on top of the ticket subtotal.

**Refunds:** Triggered when a ticket is cancelled. The refund is processed via the Paystack Refunds API.

**Creator analytics** include: total revenue, payment count, tickets sold, QR scans, and unique attendees — aggregated across all events, with a per-event breakdown.

---

### Reminders

**Base path:** `/api/reminders`

Automated reminders run as scheduled cron jobs. Creators can also send them manually at any time.

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/event/:eventId/send` | JWT + `creator` | Send a manual reminder email to all valid ticket holders now |
| `GET` | `/event/:eventId/stats` | JWT + `creator` | View reminder configuration and recipient count |

**Automated reminders** are sent to each attendee based on their personal `intervals` setting on the ticket. The default intervals are `[168, 24]` — 7 days and 24 hours before the event.

Attendees can customise their own schedule per ticket via `PUT /tickets/:id/reminders` (e.g. `[168, 24, 1]` = 1 week, 1 day, 1 hour before).

**Email templates:**

| Template | Trigger |
|---|---|
| `ticket-confirmation` | After successful payment |
| `payment-receipt` | After successful payment |
| `event-reminder` | Automated / manual reminder |
| `cancellation` | Ticket cancellation |
| `payment-failed` | Payment failure notification |

---

### Webhooks

**Base path:** `/api/webhooks`

| Method | Path | Description |
|---|---|---|
| `POST` | `/paystack` | Receives payment events from Paystack |

The webhook endpoint:
1. Reads the `x-paystack-signature` header and verifies it using HMAC-SHA512
2. Processes `charge.success`, `charge.failed`, and `refund.processed` events
3. Always returns HTTP 200 to prevent Paystack from retrying

Register this URL in your Paystack dashboard under **Settings → API Keys & Webhooks**:

```
https://your-domain.com/api/webhooks/paystack
```

---

## Roles & Access Control

| Feature | `eventee` | `creator` |
|---|---|---|
| Browse and search events | Yes | Yes |
| Purchase tickets | Yes | Yes |
| View own tickets and QR codes | Yes | Yes |
| Cancel tickets | Yes | Yes |
| Set personal reminders | Yes | Yes |
| Create and manage events | No | Yes |
| Upload event images | No | Yes |
| Scan tickets at the entrance | No | Yes |
| View event revenue and analytics | No | Yes |
| Send manual reminders | No | Yes |

---

## Testing

The project uses Jest with `ts-jest` for unit tests.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate a coverage report
npm run test:cov
```

Test suites cover:

| Suite | What is tested |
|---|---|
| `AuthService` | register, login, validateUser, getCurrentUser, updateProfile, updateAvatar |
| `AuthController` | all endpoints including avatar upload |
| `EventService` | CRUD, publish, tier management, availability checks, share links |
| `EventController` | all endpoints with mocked cache manager |
| `TicketService` | purchase validation, QR scanning, cancellation, reminders, statistics |
| `TicketController` | all endpoints |
| `PaymentService` | initiate, verify, webhook handling, revenue and creator analytics |
| `PaymentController` | all endpoints |
| `PaystackService` | initialize transaction, verify transaction, webhook signature verification |
| `QrCodeService` | QR code generation and parsing |