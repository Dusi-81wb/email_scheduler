import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export interface EmailJobData {
  emailJobId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  userId: string;
}

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep in BullMQ for visibility & Bull-Board
    removeOnFail: false,
  },
});

class QueueService {
  /**
   * Enqueues a delayed email job into BullMQ (backed by Redis sorted sets).
   * Strictly avoids cron jobs.
   */
  public async scheduleEmailJob(data: EmailJobData, delayMs: number): Promise<string> {
    const jobId = `job_${data.emailJobId}`;

    const options: JobsOptions = {
      delay: Math.max(0, delayMs),
      jobId, // Enforces idempotency at queue level
    };

    const job = await emailQueue.add('send-email', data, options);
    console.log(`⏱ Scheduled BullMQ job ${job.id} for recipient ${data.recipientEmail} with delay ${Math.round(delayMs / 1000)}s`);

    return job.id || jobId;
  }

  /**
   * Get queue statistics for dashboard.
   */
  public async getQueueStats() {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return { waiting, active, delayed, completed, failed };
  }
}

export const queueService = new QueueService();
