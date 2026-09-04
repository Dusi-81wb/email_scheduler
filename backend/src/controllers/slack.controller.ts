import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { slackService } from '../services/slack.service';

export class SlackController {
  /**
   * Redirects user to Slack OAuth authorization page.
   */
  public static async authorize(req: Request, res: Response) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback';

    if (!clientId) {
      // In dev mode without configured Slack app, instruct frontend to use direct Webhook input
      return res.status(400).json({
        error: 'SLACK_CLIENT_ID is not configured in .env. Please use direct Webhook URL setup.',
      });
    }

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=incoming-webhook,chat:write&redirect_uri=${encodeURIComponent(
      redirectUri
    )}`;

    return res.redirect(slackAuthUrl);
  }

  /**
   * Handles OAuth callback from Slack and stores tokens/webhook URL.
   */
  public static async callback(req: Request, res: Response) {
    const { code } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      // For real OAuth exchange:
      // const tokenRes = await axios.post('https://slack.com/api/oauth.v2.access', ...);
      console.log('Received Slack OAuth callback with code:', code);

      return res.redirect(`${frontendUrl}?slack=connected`);
    } catch (error: any) {
      return res.redirect(`${frontendUrl}?slack=error&msg=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Directly save a Slack Webhook URL (ideal for instant testing and local demos).
   */
  public static async saveWebhook(req: Request, res: Response) {
    try {
      const { webhookUrl, channel = '#cold-outreach-alerts' } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({ error: 'Please provide a valid Slack webhook URL (https://hooks.slack.com/...)' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: You must be logged in with Google.' });
      }

      const config = await prisma.slackConfig.upsert({
        where: { userId },
        update: { webhookUrl, channel, connectedAt: new Date() },
        create: { userId, webhookUrl, channel },
      });

      console.log(`✅ Saved Slack webhook for user ${userId}: channel ${channel}`);
      return res.json({ success: true, config });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Returns current Slack connection status.
   */
  public static async getStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const config = await slackService.getSlackConfig(userId);
      return res.json({
        connected: !!(config && config.webhookUrl),
        config,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Dispatches a live test alert to Slack.
   */
  public static async testAlert(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const config = await slackService.getSlackConfig(userId);

      if (!config || !config.webhookUrl) {
        return res.status(400).json({ error: 'No Slack integration connected. Please connect Slack first.' });
      }

      const sent = await slackService.sendTestNotification(config.webhookUrl);
      return res.json({ success: sent });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Disconnects Slack.
   */
  public static async disconnect(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      await prisma.slackConfig.deleteMany({
        where: { userId },
      });

      return res.json({ success: true, message: 'Slack disconnected' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
