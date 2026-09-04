export type JobStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'RESCHEDULED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface SenderAccount {
  id: string;
  email: string;
  host: string;
  port: number;
  isEthereal: boolean;
  hourlyLimit: number;
}

export interface EmailJob {
  id: string;
  scheduleId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: JobStatus;
  scheduledAt: string;
  sentAt?: string | null;
  etherealUrl?: string | null;
  rescheduleCount: number;
  errorMessage?: string | null;
  idempotencyKey: string;
  createdAt: string;
}

export interface EmailSchedule {
  id: string;
  userId: string;
  subject: string;
  body: string;
  totalRecipients: number;
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
  createdAt: string;
  jobs?: EmailJob[];
}

export interface SlackConfig {
  id: string;
  userId: string;
  webhookUrl?: string | null;
  channel?: string | null;
  connectedAt: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  startTime?: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

export interface PaginatedEmailJobsResponse {
  jobs: EmailJob[];
  total: number;
}

export interface ScheduleEmailResponse {
  message: string;
  scheduleId: string;
  totalRecipients: number;
}

export interface SendersResponse {
  senders: SenderAccount[];
}

export interface SlackStatusResponse {
  config: SlackConfig | null;
}

export interface SlackActionResponse {
  message: string;
}

export interface CurrentUserResponse {
  user: User;
}
