# email_scheduler: Production-Grade Cold Email Dispatcher & Scheduler

> A robust, crash-resilient cold email scheduling and dispatching platform featuring **BullMQ delayed queues** (zero cron jobs), **multi-sender sliding-window rate limiting**, **dynamic next-hour job rescheduling**, **PostgreSQL & Redis AOF persistence**, **Google OAuth 2.0 authentication**, **Ethereal fake SMTP preview links**, **Elasticsearch full-text search with database fallback**, and a modern **Next.js 14 dashboard** with an **interactive rich text editor**.

---

## 📑 Table of Contents

1. [Demo Video & Walkthrough](#-demo-video-4m-36s)
2. [Architecture Overview](#-architecture-overview)
   - [How Scheduling Works](#1-how-scheduling-works)
   - [How Persistence on Restart is Handled](#2-how-persistence-on-restart-is-handled)
   - [How Rate Limiting & Concurrency are Implemented](#3-how-rate-limiting--concurrency-are-implemented)
3. [System Architecture Diagram](#-system-architecture-diagram)
4. [Features Implemented](#-features-implemented)
   - [Backend Features](#backend-features)
   - [Frontend Features](#frontend-features)
5. [Ethereal Email & Environment Configuration](#-ethereal-email--environment-configuration)
   - [How Ethereal Email is Configured](#how-ethereal-email-is-configured)
   - [Backend Environment Variables (`.env`)](#backend-environment-variables-env)
   - [Frontend Environment Variables (`.env.local`)](#frontend-environment-variables-envlocal)
   - [Google OAuth 2.0 Setup](#google-oauth-20-setup)
6. [How to Run Backend](#-how-to-run-backend)
7. [How to Run Frontend](#-how-to-run-frontend)
8. [Automated Verification & Testing](#-automated-verification--testing)

---

## 🎥 Demo Video (4m 36s)

> **Full Operations & Crash Resilience Demo**: Watch the end-to-end walkthrough showing email scheduling, real-time BullMQ job queuing, server restart persistence, and sliding-window rate limiting under load.

https://github.com/user-attachments/assets/35b7fbbe-60b0-4290-aa1f-1c0dab06c3d3

### ⏱️ Video Chapters & Key Scenarios

| Timestamp | Scenario / Feature Demonstrated | Technical Details |
| :--- | :--- | :--- |
| **0:00 - 0:45** | **Authentication & Dashboard Overview** | Strict Google OAuth 2.0 login, Scheduled vs. Sent counters, system metrics |
| **0:45 - 1:40** | **Email Composition & Scheduling** | CSV leads upload, rich text editor, schedule start time, throttle delay configuration |
| **1:40 - 2:30** | **Queue Inspection & Live Dispatch** | BullMQ queue board (`/admin/queues`), live Redis job timers & status tracking |
| **2:30 - 3:40** | **Server Restart & Crash Resilience Scenario** | Backend process terminated (`SIGINT`), server rebooted, future jobs survive & send on schedule |
| **3:40 - 4:36** | **Rate Limiting & Ethereal SMTP Delivery** | Hourly limit throttling, next-hour reschedule, Ethereal preview URLs, Slack alerts |

---

## 🏛 Architecture Overview

### 1. How Scheduling Works
- **Zero Cron Jobs**: Traditional `node-cron`, `agenda`, or OS `crontab` pollers poll the database every minute or second, introducing race conditions, CPU polling spikes, and synchronization bottlenecks across worker clusters. `email_scheduler` uses **BullMQ delayed jobs** backed by **Redis sorted sets (`zset`)**.
- **Batch Decomposition**: When a user submits an email schedule with $N$ recipients, the backend creates an `EmailSchedule` record in PostgreSQL and decomposes it into $N$ individual `EmailJob` rows, each with a unique `idempotencyKey` (`job_${emailJob.id}`).
- **Precision Delay Calculation**:
  - The base dispatch time is determined by `max(0, scheduledStartTime - now)`.
  - To prevent sudden burst throttling and simulate natural human sending patterns, each recipient in the batch is spaced apart using the configured throttle delay:
    $$\text{Job Delay} = \max(0, \text{scheduledStartTime} - \text{now}) + (\text{recipientIndex} \times \text{delayBetweenMs})$$
  - Each job is added to the BullMQ `email-queue` with `{ delay: jobDelay, jobId: emailJob.idempotencyKey }`.
- **Redis Timers**: Redis stores the job with its target timestamp as the score in a sorted set (`zset`). BullMQ's internal timer evaluates the earliest score; when the timestamp matches wall-clock time, Redis atomically transitions the job from `delayed` to `waiting`, and available worker threads immediately process it.

### 2. How Persistence on Restart is Handled
- **Two-Tier Persistence Layer**:
  1. **Relational Database (PostgreSQL)**: Stores all persistent relational models (`User`, `SenderAccount`, `EmailSchedule`, `EmailJob`, `SlackConfig`) with exact status tracking (`SCHEDULED`, `PROCESSING`, `SENT`, `RESCHEDULED`, `FAILED`).
  2. **In-Memory Store with Append-Only File (Redis AOF)**: The Redis container runs with `--appendonly yes` (`appendfsync everysec`). Every delayed job, payload, and schedule score is continuously written to disk.
- **Restart & Crash Resilience**:
  - If the server, worker process, or database container crashes mid-cycle, Redis recovers the entire queue state from its AOF file upon reboot.
  - When the BullMQ worker boots back up, it automatically reconnects to Redis and resumes countdown based on **real wall-clock time (`Date.now()`)**.
  - **Future Scheduled Emails**: Emails scheduled for future dates remain in the Redis delayed set and fire at their exact intended timestamp.
  - **Overdue Emails**: Any jobs whose target dispatch timestamp elapsed while the server was offline are moved to `waiting` immediately upon startup and dispatched without being lost or dropped.
- **Strict Idempotency (Zero Duplicate Sends)**:
  - Every job in BullMQ is registered with a deterministic custom `jobId` matching `EmailJob.idempotencyKey`. BullMQ strictly disallows duplicate job insertions with identical IDs.
  - When a worker picks up a job from Redis, it queries PostgreSQL before calling SMTP:
    ```typescript
    const emailJob = await prisma.emailJob.findUnique({ where: { id: jobId } });
    if (!emailJob || emailJob.status === 'SENT' || emailJob.status === 'PROCESSING') {
      console.warn(`Job ${jobId} already processed or active. Skipping duplicate send.`);
      return;
    }
    ```
  - If an email was already sent prior to a crash, the worker detects `status === 'SENT'` and discards the duplicate job.

### 3. How Rate Limiting & Concurrency are Implemented
- **Worker Concurrency**:
  - The BullMQ worker is instantiated with configurable concurrency (`WORKER_CONCURRENCY=5` in `.env`).
  - This allows the worker to process up to 5 emails in parallel while keeping thread utilization predictable.
- **Throttle Spacing**:
  - Sequential pacing between emails is governed by `MIN_DELAY_BETWEEN_EMAILS_MS` (default `2000` ms / 2 seconds) and customizable directly in the Compose UI (with dedicated seconds input and unit toggle).
- **Hourly Sliding-Window Rate Limiting**:
  - Senders have an hourly sending cap (e.g. 100 emails/hour or custom limit per sender).
  - Rate tracking is managed in Redis using atomic sliding-hour keys:
    $$\text{Key} = \text{ratelimit:}\{\text{senderEmail}\}:\{YYYY\text{-}MM\text{-}DD\text{-}HH\}$$
  - Keys have an automatic 3600-second TTL set at creation.
  - Before dispatching, the worker checks the atomic counter:
    ```typescript
    const currentCount = await redis.get(rateLimitKey);
    if (parseInt(currentCount || '0') >= senderHourlyLimit) {
      // Limit exceeded -> Reschedule to next hour window
    }
    ```
- **Zero Job Dropping (Dynamic Next-Hour Rescheduling)**:
  - When a sender exceeds their hourly limit, pending emails are **not failed and not deleted**.
  - The worker calculates the exact millisecond offset remaining until the top of the next hour:
    ```typescript
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const delayUntilNextHour = nextHour.getTime() - Date.now();
    ```
  - The worker updates the job status in PostgreSQL to `RESCHEDULED`, increments `rescheduleCount`, and calls BullMQ's native:
    ```typescript
    await job.moveToDelayed(Date.now() + delayUntilNextHour, token);
    ```
- **Live Slack Alerting**:
  - When a sender reaches their hourly limit, a rich notification is posted to Slack detailing the sender email, current dispatch volume, and the number of rescheduled jobs.

---

## 🏗 System Architecture Diagram

```
                                    +-----------------------------------------+
                                    |        Next.js Dashboard (Port 3000)   |
                                    |  (Interactive Rich Editor, Lead Parser) |
                                    +--------------------+--------------------+
                                                         |  REST API / JWT Bearer
                                                         v
                                    +-----------------------------------------+
                                    |        Express API (Port 5000)          |
                                    |         Bull-Board (/admin/queues)      |
                                    +---------+-------------------+-----------+
                                              |                   |
                     +------------------------+                   +-----------------------+
                     v                                                                    v
+------------------------------------+                             +------------------------------------+
|            PostgreSQL              |                             |          Redis (AOF Mode)          |
|  - Users & SenderAccounts          |                             |  - BullMQ Delayed Job Queue        |
|  - EmailSchedules                  |                             |  - Hourly Rate Limit Windows       |
|  - EmailJobs (with idempotencyKey) |                             |  - Distributed Locks               |
+------------------------------------+                             +-----------------+------------------+
                                                                                     |
                                                                                     v
                                                                   +------------------------------------+
                                                                   |         BullMQ Worker              |
                                                                   |  (Concurrency = 5, Min Delay = 2s) |
                                                                   +----+------------+------------+-----+
                                                                        |            |            |
                                      +---------------------------------+            |            +------------------+
                                      v                                              v                               v
                       +-------------------------------+              +-------------------------------+  +---------------------+
                       |         Ethereal SMTP         |              |       Elasticsearch           |  |     Slack Alerts    |
                       | (Real webmail preview links)  |              | (Search with DB fallback)     |  | (Rate-limit alerts) |
                       +-------------------------------+              +-------------------------------+  +---------------------+
```

---

## ✨ Features Implemented

### Backend Features
| Feature Area | Implementation Details |
|---|---|
| **BullMQ Scheduler** | Distributed job queue with millisecond-precision delays; zero cron jobs; per-recipient throttle spacing. |
| **Crash Persistence** | Redis AOF (`appendonly yes`) combined with PostgreSQL transactional state preserves all future jobs across restarts. |
| **Strict Idempotency** | Unique database constraints on `idempotencyKey`; workers check job status before invoking SMTP to guarantee zero duplicate sends. |
| **Sliding Rate Limiter** | Atomic Redis counters `ratelimit:{sender}:{date-hour}` with 1-hour TTL. |
| **Dynamic Rescheduler** | Over-limit jobs are deferred to the top of the next hour using BullMQ `moveToDelayed()`; zero dropped jobs. |
| **Worker Concurrency** | Configurable thread pool (`WORKER_CONCURRENCY=5`) for parallel, thread-safe job execution. |
| **Ethereal Fake SMTP** | Multi-sender Nodemailer integration; automated test account provisioning; captures real message preview URLs. |
| **Full-Text Search** | Elasticsearch 8 indexing across subject, body, sender, and recipient; transparent PostgreSQL `ILIKE` pattern fallback. |
| **Slack Integration** | Real-time webhooks and OAuth integration; alerts administrators upon hitting sender hourly limits. |
| **Queue Inspection** | Bull-Board UI mounted at `/admin/queues` for inspecting active, waiting, delayed, and completed jobs. |
| **Google OAuth 2.0** | Real Google OAuth flow with cryptographic JWT session generation; fail-fast startup validator ensures zero missing credentials. |

### Frontend Features
| Feature Area | Implementation Details |
|---|---|
| **Google Login View** | Clean authentication screen with "Sign In with Google", OAuth error handling, and JWT session persistence. |
| **App Shell & Navigation** | Minimalist sidebar with `email_scheduler` branding, Google user profile avatar card, Core navigation (`Scheduled` and `Sent`) with live badge counters. |
| **Scheduled View** | Figma-matched table with peach pill badges (`🕒 Tue 9:15:12 AM`), recipient chips, bold subject + snippet, and star toggles. |
| **Sent View** | Figma-matched table with gray pill badges (`Sent`), recipient chips, bold subject + snippet, and direct clickable "View in Ethereal" links. |
| **Email Detail View** | Thread view displaying sender initial avatar, timestamp, message headers, formatted body, and live Ethereal preview banner. |
| **Compose View** | Initial clean state (0 hardcoded emails, 0 fake attachments); recipient chip input; CSV / TXT lead file parser with deduplication; throttle delay selector (seconds input, sec/ms switch, live `⏱ X seconds (Y ms)` badge, 1s/2s/5s/10s presets); hourly limit input; floating Send Later popover card with presets (`Tomorrow`, `Tomorrow, 10:00 AM`, etc.). |
| **Rich Text Editor** | Full 12-button interactive formatting toolbar (**Undo**, **Redo**, **Tt** Heading 3, **Bold**, **Italic**, **Underline**, **Strikethrough**, **Align Left**, **Numbered List**, **Bullet List**, **Quote**, **Code Block**) with `contentEditable` editor, `onMouseDown` preventDefault selection preservation, active button highlighting, and end-to-end HTML persistence. |
| **Real File Attachments** | Dynamic file upload input with size badges and instant file removal actions. |
| **Top Bar & Search** | Rounded pill search bar with real-time query filtering, filter and refresh buttons. |

---

## 📬 Ethereal Email & Environment Configuration

### How Ethereal Email is Configured
[Ethereal Email](https://ethereal.email) is a fake SMTP service provided by Nodemailer for testing. Safe for development: emails are never delivered to real people, but generate genuine webmail inbox preview links.

1. **Automated Seeding**:
   - Running `npm run seed` in `OutBox/backend` calls `nodemailer.createTestAccount()` and automatically registers disposable sender credentials in the `sender_accounts` table.
2. **On-the-Fly Sender Creation**:
   - If an email is scheduled using a new sender email, `smtp.service.ts` detects that the sender is not in the database, automatically provisions an Ethereal test account on the fly, saves it to PostgreSQL, and reuses it for subsequent emails.
3. **Live Webmail Preview Links**:
   - For every dispatched email, `smtp.service.ts` extracts the preview URL using `nodemailer.getTestMessageUrl(info)`.
   - The URL is saved in `EmailJob.etherealUrl` (e.g. `https://ethereal.email/message/...`) and rendered as a direct clickable "View in Ethereal" button in the frontend table and detail view.
4. **Manual Custom Account (Optional)**:
   - You can also manually create an account at [https://ethereal.email/create](https://ethereal.email/create) and insert your credentials into the `SenderAccount` database table.

---

### Backend Environment Variables (`.env`)
Create a file at `OutBox/backend/.env` with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL="postgresql://outbox_user:outbox_password@127.0.0.1:5432/outbox_db?schema=public"

# Redis (Queue & Rate Limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch (Full-Text Search)
ELASTICSEARCH_NODE=http://localhost:9200

# Concurrency & Rate Limiting Defaults
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
DEFAULT_HOURLY_LIMIT=100

# Slack Integration (Optional webhook for rate limit alerts)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
SLACK_WEBHOOK_URL=

# Google OAuth 2.0 (Strictly required)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"

# JWT Secret for authenticating sessions
JWT_SECRET="outbox_super_secure_jwt_secret_key_2026"

# Frontend URL (for CORS and OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

---

### Frontend Environment Variables (`.env.local`)
Create a file at `OutBox/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_BULL_BOARD_URL=http://localhost:5000/admin/queues
```

---

### Google OAuth 2.0 Setup
1. Visit the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Application type: *Web application*).
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
4. Copy the **Client ID** and **Client Secret** into `OutBox/backend/.env`.

---

## 🚀 How to Run Backend

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose (or local PostgreSQL and Redis servers)

### Step 1: Start Redis and PostgreSQL
Using Docker Compose from the `OutBox` directory:
```bash
cd OutBox
docker-compose up -d
```
*(Or if running natively or via WSL: ensure PostgreSQL is running on port `5432` and Redis is running on port `6379`)*.

### Step 2: Install Dependencies & Setup Database
```bash
cd OutBox/backend
npm install
npx prisma generate
npx prisma db push
npm run seed
```
> `npm run seed` provisions the initial Ethereal SMTP accounts in PostgreSQL.

### Step 3: Start the Backend & Worker
```bash
npm run dev
```
This starts:
- The **Express REST API** on `http://localhost:5000`.
- The **BullMQ Worker** in the background processing delayed and waiting queues.
- The **Bull-Board Dashboard** at `http://localhost:5000/admin/queues`.

---

## 💻 How to Run Frontend

### Step 1: Install Dependencies
```bash
cd OutBox/frontend
npm install
```

### Step 2: Start Next.js Dev Server
```bash
npm run dev
```
The application will be accessible at [http://localhost:3000](http://localhost:3000).

### Step 3: Production Build (Optional)
```bash
npm run build
npm start
```

---

## 🧪 Automated Verification & Testing

The backend includes test scripts to verify idempotency, crash resilience, rate limiting, and OAuth flows:

### 1. Persistence, Crash & Idempotency Audit
```bash
cd OutBox/backend
npm run test:persistence
```
Verifies:
- **Duplicate Enqueue Rejection**: Re-enqueueing identical jobs does not duplicate tasks in BullMQ.
- **Double-Send Worker Guard**: An already-sent email is skipped by workers without calling SMTP.
- **Server Crash & Recovery**: Simulates a server shutdown; confirms Redis AOF preserves future jobs and resumes dispatch accurately based on wall-clock time.

### 2. Rate Limiting & Next-Hour Rescheduling Test
```bash
cd OutBox/backend
npm run test:load
```
Schedules 12 emails with a sender limit of 4 emails/hour:
- First 4 emails are dispatched immediately via Ethereal SMTP.
- The remaining 8 emails exceed the hourly limit, are transitioned to `RESCHEDULED`, and delayed to the next hour window in BullMQ.
- An alert is sent to Slack. Zero emails are dropped.

### 3. Google OAuth Flow Test
```bash
cd OutBox/backend
npm run test:oauth
```
Verifies fail-fast configuration validation, OAuth authorization URL construction, PostgreSQL user upsert, and cryptographic JWT verification.
