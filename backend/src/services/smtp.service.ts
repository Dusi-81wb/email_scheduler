import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../config/db';

interface SendMailOptions {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface SendMailResult {
  messageId: string;
  etherealUrl: string | null;
}

class SmtpService {
  private transporters: Map<string, Transporter> = new Map();

  /**
   * Retrieves or creates a Nodemailer transporter for the given sender email.
   */
  private async getTransporter(senderEmail: string): Promise<{ transporter: Transporter; fromAddress: string }> {
    if (this.transporters.has(senderEmail)) {
      return { transporter: this.transporters.get(senderEmail)!, fromAddress: senderEmail };
    }

    // Lookup in database
    let sender = await prisma.senderAccount.findUnique({
      where: { email: senderEmail },
    });

    // If sender not found in DB, create on-the-fly Ethereal account
    if (!sender) {
      console.log(`Creating dynamic Ethereal account for sender: ${senderEmail}`);
      const testAccount = await nodemailer.createTestAccount();
      sender = await prisma.senderAccount.create({
        data: {
          email: senderEmail,
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          user: testAccount.user,
          pass: testAccount.pass,
          isEthereal: true,
          hourlyLimit: 100,
        },
      });
    }

    const transporter = nodemailer.createTransport({
      host: sender.host,
      port: sender.port,
      secure: sender.port === 465,
      auth: {
        user: sender.user,
        pass: sender.pass,
      },
    });

    this.transporters.set(senderEmail, transporter);
    return { transporter, fromAddress: sender.email };
  }

  /**
   * Sends an email via Ethereal SMTP and captures preview URL.
   */
  public async sendEmail(options: SendMailOptions): Promise<SendMailResult> {
    const { senderEmail, recipientEmail, subject, body } = options;
    const { transporter, fromAddress } = await this.getTransporter(senderEmail);

    const info = await transporter.sendMail({
      from: `"email_scheduler" <${fromAddress}>`,
      to: recipientEmail,
      subject: subject,
      html: body.includes('<') ? body : `<div style="font-family: sans-serif; line-height: 1.5;">${body.replace(/\n/g, '<br/>')}</div>`,
      text: body.replace(/<[^>]*>?/gm, ''),
    });

    const etherealUrl = nodemailer.getTestMessageUrl(info) || null;

    console.log(`✉️ Email dispatched to ${recipientEmail} from ${fromAddress}. Preview: ${etherealUrl || 'N/A'}`);

    return {
      messageId: info.messageId,
      etherealUrl: etherealUrl ? etherealUrl.toString() : null,
    };
  }
}

export const smtpService = new SmtpService();
