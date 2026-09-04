import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { createBullBoardRouter } from './routes/admin.routes';

export const createApp = () => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Bull-Board Queue Dashboard
  app.use('/admin/queues', createBullBoardRouter());

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'email_scheduler',
      time: new Date().toISOString(),
    });
  });

  return app;
};
