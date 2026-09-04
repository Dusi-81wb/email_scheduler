import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/db';
import { queueService } from '../services/queue.service';
import { elasticService } from '../services/elastic.service';

const ScheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  senderEmail: z.string().email('Valid sender email required'),
  recipients: z.array(z.string().email()).min(1, 'At least 1 recipient is required'),
  startTime: z.string().optional(),
  delayBetweenMs: z.number().min(500).default(2000),
  hourlyLimit: z.number().min(1).default(100),
});

export class EmailController {
  /**
   * Returns available sender accounts (Ethereal test senders).
   */
  public static async getSenders(req: Request, res: Response) {
    try {
      let senders = await prisma.senderAccount.findMany({
        orderBy: { createdAt: 'asc' },
      });

      // If no senders in DB yet, trigger on-the-fly seeding
      if (senders.length === 0) {
        const { seedDatabase } = await import('../scripts/seed');
        await seedDatabase();
        senders = await prisma.senderAccount.findMany();
      }

      return res.json({ senders });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Accepts email send requests and schedules them using BullMQ delayed jobs.
   * No cron jobs used.
   */
  public static async scheduleEmails(req: Request, res: Response) {
    try {
      const parsed = ScheduleEmailSchema.parse(req.body);
      const { subject, body, senderEmail, recipients, startTime, delayBetweenMs, hourlyLimit } = parsed;

      // Identify user from authenticated session
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized: You must be logged in with Google to schedule emails.',
        });
      }

      const scheduleStartTime = startTime ? new Date(startTime) : new Date();
      const now = new Date();

      // 1. Create EmailSchedule record
      const schedule = await prisma.emailSchedule.create({
        data: {
          userId,
          subject,
          body,
          totalRecipients: recipients.length,
          startTime: scheduleStartTime,
          delayBetweenMs,
          hourlyLimit,
        },
      });

      // 2. Prepare individual email jobs and schedule them via BullMQ
      const initialDelayBase = Math.max(0, scheduleStartTime.getTime() - now.getTime());
      const scheduledJobs = [];

      for (let i = 0; i < recipients.length; i++) {
        const recipientEmail = recipients[i];
        // Calculate incremental delay between each email to mimic provider throttling
        const leadDelayMs = initialDelayBase + i * delayBetweenMs;
        const scheduledTime = new Date(now.getTime() + leadDelayMs);
        const idempotencyKey = `idem_${schedule.id}_${i}_${recipientEmail}`;

        // Create record in PostgreSQL
        const emailJob = await prisma.emailJob.create({
          data: {
            scheduleId: schedule.id,
            senderEmail,
            recipientEmail,
            subject,
            body,
            status: 'SCHEDULED',
            scheduledAt: scheduledTime,
            idempotencyKey,
          },
        });

        // Add to BullMQ delayed queue (backed by Redis sorted sets)
        await queueService.scheduleEmailJob(
          {
            emailJobId: emailJob.id,
            senderEmail,
            recipientEmail,
            subject,
            body,
            hourlyLimit,
            userId,
          },
          leadDelayMs
        );

        // Pre-index into Elasticsearch as SCHEDULED
        await elasticService.indexEmail({
          id: emailJob.id,
          scheduleId: schedule.id,
          senderEmail,
          recipientEmail,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: scheduledTime.toISOString(),
        });

        scheduledJobs.push(emailJob);
      }

      console.log(
        `📬 Successfully scheduled campaign "${subject}" for ${recipients.length} leads with start: ${scheduleStartTime.toISOString()}`
      );

      return res.status(201).json({
        success: true,
        scheduleId: schedule.id,
        totalScheduled: scheduledJobs.length,
        firstJobScheduledAt: scheduledJobs[0]?.scheduledAt,
      });
    } catch (error: any) {
      console.error('Error scheduling emails:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get scheduled and rescheduled emails.
   */
  public static async getScheduledEmails(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: {
            status: { in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'] },
          },
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.emailJob.count({
          where: {
            status: { in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'] },
          },
        }),
      ]);

      return res.json({ jobs, total, page, limit });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get sent and failed emails.
   */
  public static async getSentEmails(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: {
            status: { in: ['SENT', 'FAILED'] },
          },
          orderBy: { sentAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.emailJob.count({
          where: {
            status: { in: ['SENT', 'FAILED'] },
          },
        }),
      ]);

      return res.json({ jobs, total, page, limit });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Full-text search via Elasticsearch with database fallback.
   */
  public static async searchEmails(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const result = await elasticService.searchEmails(query, status, page, limit);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
