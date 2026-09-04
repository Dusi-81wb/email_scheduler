import { Worker, Job } from 'bullmq';
import { redisConnectionOptions, redisClient } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobData } from './queue.service';
import { smtpService } from './smtp.service';
import { slackService } from './slack.service';
import { elasticService } from './elastic.service';
import { prisma } from '../config/db';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10);

/**
 * Returns formatted hour key: YYYY-MM-DD-HH
 */
export const getHourWindowKey = (date: Date = new Date()): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  return `${yyyy}-${mm}-${dd}-${hh}`;
};

/**
 * Returns timestamp for the exact beginning of the next hour
 */
export const getNextHourStart = (date: Date = new Date()): Date => {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
};

export class EmailWorkerService {
  private worker: Worker<EmailJobData> | null = null;

  public start() {
    console.log(`🚀 Initializing BullMQ Worker with concurrency = ${CONCURRENCY}, min delay = ${MIN_DELAY_MS}ms`);

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        return this.processJob(job);
      },
      {
        connection: redisConnectionOptions,
        concurrency: CONCURRENCY,
        limiter: {
          max: 1,
          duration: MIN_DELAY_MS, // Ensures minimum spacing between consecutive dispatch attempts
        },
      }
    );

    this.worker.on('completed', (job: Job) => {
      console.log(`✅ BullMQ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ BullMQ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err: Error) => {
      console.warn('⚠️ BullMQ Worker internal warning:', err.message);
    });
  }

  /**
   * Core job processing logic with rate limiting, next-hour rescheduling, and Slack alerts.
   */
  public async processJob(job: Job<EmailJobData>): Promise<any> {
    const { emailJobId, senderEmail, recipientEmail, subject, body, hourlyLimit, userId } = job.data;
    const now = new Date();
    const hourKey = getHourWindowKey(now);
    const redisRateLimitKey = `ratelimit:${senderEmail}:${hourKey}`;

    // 1. Idempotency Check in Database
    const existingDbJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
    });

    if (!existingDbJob) {
      console.warn(`Job ${emailJobId} not found in database. Skipping.`);
      return { skipped: true, reason: 'not_found' };
    }

    if (existingDbJob.status === 'SENT' || existingDbJob.status === 'PROCESSING') {
      console.log(`ℹ️ Job ${emailJobId} already ${existingDbJob.status}. Skipping duplicate send.`);
      return { skipped: true, reason: 'already_sent' };
    }

    // 2. Multi-Sender Hourly Rate Limiting Check
    const currentSentCountStr = await redisClient.get(redisRateLimitKey);
    const currentSentCount = currentSentCountStr ? parseInt(currentSentCountStr, 10) : 0;

    if (currentSentCount >= hourlyLimit) {
      // RATE LIMIT HIT!
      const nextHourStart = getNextHourStart(now);
      const delayUntilNextHour = Math.max(1000, nextHourStart.getTime() - now.getTime());

      console.warn(
        `🚨 Hourly rate limit (${hourlyLimit}) reached for sender ${senderEmail} (${currentSentCount}/${hourlyLimit}). Rescheduling job ${emailJobId} to ${nextHourStart.toISOString()} (delay: ${Math.round(delayUntilNextHour / 1000)}s).`
      );

      // Update DB status to RESCHEDULED
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'RESCHEDULED',
          scheduledAt: nextHourStart,
          rescheduleCount: { increment: 1 },
        },
      });

      // Send live Slack Notification
      await slackService.sendRateLimitAlert({
        userId,
        senderEmail,
        hourlyLimit,
        currentCount: currentSentCount,
        rescheduledCount: 1,
        nextAvailableTime: nextHourStart,
      });

      // Move job to delayed set in BullMQ without failing or dropping
      if (job.token) {
        await job.moveToDelayed(Date.now() + delayUntilNextHour, job.token);
      }

      return { rescheduled: true, nextSlot: nextHourStart };
    }

    // 3. Increment Redis Hourly Rate Counter
    const multi = redisClient.multi();
    multi.incr(redisRateLimitKey);
    multi.expire(redisRateLimitKey, 3600); // 1 hour TTL
    await multi.exec();

    // 4. Update status to PROCESSING
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'PROCESSING' },
    });

    // 5. Send Email via Ethereal SMTP
    try {
      const sendResult = await smtpService.sendEmail({
        senderEmail,
        recipientEmail,
        subject,
        body,
      });

      const sentAt = new Date();

      // 6. Update DB record to SENT
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt,
          etherealUrl: sendResult.etherealUrl,
        },
      });

      // 7. Index in Elasticsearch (with automatic DB fallback)
      await elasticService.indexEmail({
        id: updatedJob.id,
        scheduleId: updatedJob.scheduleId,
        senderEmail: updatedJob.senderEmail,
        recipientEmail: updatedJob.recipientEmail,
        subject: updatedJob.subject,
        body: updatedJob.body,
        status: updatedJob.status,
        scheduledAt: updatedJob.scheduledAt.toISOString(),
        sentAt: sentAt.toISOString(),
        etherealUrl: updatedJob.etherealUrl,
      });

      return { success: true, etherealUrl: sendResult.etherealUrl };
    } catch (sendError: any) {
      console.error(`❌ Error dispatching email ${emailJobId} to ${recipientEmail}:`, sendError.message);
      
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          errorMessage: sendError.message,
        },
      });

      throw sendError;
    }
  }

  public async close() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

export const emailWorkerService = new EmailWorkerService();
