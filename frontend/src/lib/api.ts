import axios from 'axios';
import {
  EmailJob,
  SenderAccount,
  User,
  SlackConfig,
  ScheduleEmailPayload,
  SendersResponse,
  PaginatedEmailJobsResponse,
  ScheduleEmailResponse,
  SlackStatusResponse,
  SlackActionResponse,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach authenticated session JWT token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('outbox_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle unauthorized responses by clearing session
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('outbox_token');
      localStorage.removeItem('outbox_user');
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Google OAuth URL
  getGoogleLoginUrl: () => {
    return `${API_BASE_URL}/auth/google`;
  },

  // Auth
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const res = await apiClient.get('/auth/me');
      return res.data.user;
    } catch {
      return null;
    }
  },
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('outbox_token');
        localStorage.removeItem('outbox_user');
      }
    }
  },

  // Senders
  getSenders: async (): Promise<SenderAccount[]> => {
    const res = await apiClient.get<SendersResponse>('/emails/senders');
    return res.data.senders;
  },

  // Scheduling
  scheduleEmails: async (payload: ScheduleEmailPayload): Promise<ScheduleEmailResponse> => {
    const res = await apiClient.post<ScheduleEmailResponse>('/emails/schedule', payload);
    return res.data;
  },

  // Lists
  getScheduledEmails: async (page = 1, limit = 20): Promise<PaginatedEmailJobsResponse> => {
    const res = await apiClient.get<PaginatedEmailJobsResponse>(`/emails/scheduled?page=${page}&limit=${limit}`);
    return res.data;
  },
  getSentEmails: async (page = 1, limit = 20): Promise<PaginatedEmailJobsResponse> => {
    const res = await apiClient.get<PaginatedEmailJobsResponse>(`/emails/sent?page=${page}&limit=${limit}`);
    return res.data;
  },

  // Search (Elasticsearch with DB fallback)
  searchEmails: async (query: string, status?: string): Promise<PaginatedEmailJobsResponse> => {
    const res = await apiClient.get<PaginatedEmailJobsResponse>(`/emails/search`, {
      params: { q: query, status },
    });
    return res.data;
  },

  // Slack
  getSlackConfig: async (): Promise<SlackConfig | null> => {
    try {
      const res = await apiClient.get<SlackStatusResponse>('/slack/status');
      return res.data.config;
    } catch {
      return null;
    }
  },
  saveSlackWebhook: async (webhookUrl: string, channel?: string): Promise<SlackActionResponse> => {
    const res = await apiClient.post<SlackActionResponse>('/slack/webhook', { webhookUrl, channel });
    return res.data;
  },
  testSlackAlert: async (): Promise<SlackActionResponse> => {
    const res = await apiClient.post<SlackActionResponse>('/slack/test-alert');
    return res.data;
  },
  testAlert: async (): Promise<SlackActionResponse> => {
    const res = await apiClient.post<SlackActionResponse>('/slack/test-alert');
    return res.data;
  },
  disconnectSlack: async (): Promise<SlackActionResponse> => {
    const res = await apiClient.post<SlackActionResponse>('/slack/disconnect');
    return res.data;
  },
};
