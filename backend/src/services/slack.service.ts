import axios from 'axios';
import { prisma } from '../config/db';

interface RateLimitAlertParams {
  userId?: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  rescheduledCount?: number;
  nextAvailableTime?: Date;
}

class SlackService {
  /**
   * Retrieves active Slack configuration for a user, or the global default webhook.
   */
  public async getSlackConfig(userId?: string) {
    if (userId) {
      const config = await prisma.slackConfig.findUnique({
        where: { userId },
      });
      if (config && config.webhookUrl) return config;
    }

    // Fallback to first available config or environment variable
    const firstConfig = await prisma.slackConfig.findFirst({
      where: { webhookUrl: { not: null } },
    });
    if (firstConfig && firstConfig.webhookUrl) return firstConfig;

    const envWebhook = process.env.SLACK_WEBHOOK_URL;
    if (envWebhook) {
      return { webhookUrl: envWebhook, channel: '#alerts', userId: 'env' };
    }

    return null;
  }

  /**
   * Dispatches a live Slack notification when a sender hits the hourly rate limit.
   */
  public async sendRateLimitAlert(params: RateLimitAlertParams): Promise<boolean> {
    const { userId, senderEmail, hourlyLimit, currentCount, rescheduledCount = 1, nextAvailableTime } = params;

    try {
      const config = await this.getSlackConfig(userId);
      if (!config || !config.webhookUrl) {
        console.log(`ℹ️ Slack not connected for rate-limit alert (sender: ${senderEmail}). Skipping without error.`);
        return false;
      }

      const nextSlotText = nextAvailableTime 
        ? nextAvailableTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'the next hour window';

      const payload = {
        text: `🚨 *email_scheduler Alert*: Rate limit exceeded for sender \`${senderEmail}\``,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Hourly Rate Limit Exceeded',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender Account:*\n\`${senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${hourlyLimit} emails/hour`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Status:*\nLimit reached (${currentCount}/${hourlyLimit})`,
              },
              {
                type: 'mrkdwn',
                text: `*Rescheduled Jobs:*\n${rescheduledCount} email(s) moved to ${nextSlotText}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⏱ Sent from *email_scheduler* at ${new Date().toISOString()} | No emails were dropped.`,
              },
            ],
          },
        ],
      };

      const response = await axios.post(config.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      console.log(`📣 Live Slack notification dispatched to ${config.channel || 'webhook'}. Status: ${response.status}`);
      return true;
    } catch (error: any) {
      console.warn(`⚠️ Failed to send Slack rate-limit alert:`, error.message);
      return false;
    }
  }

  /**
   * Sends a quick test notification to verify Slack connection.
   */
  public async sendTestNotification(webhookUrl: string): Promise<boolean> {
    const payload = {
      text: `✅ *email_scheduler Test*: Slack alert connection verified successfully!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *email_scheduler Slack Integration Active*\nYou will now receive live alerts here whenever an email sender hits their hourly dispatch limit.`,
          },
        },
      ],
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    return response.status === 200;
  }
}

export const slackService = new SlackService();
