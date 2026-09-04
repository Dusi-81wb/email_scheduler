import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from './config/db';
import { emailWorkerService } from './services/worker.service';
import { elasticService } from './services/elastic.service';
import { seedDatabase } from './scripts/seed';
import { validateStartupEnv } from './config/validateEnv';

const PORT = parseInt(process.env.PORT || '5000', 10);

const bootstrap = async () => {
  console.log('🚀 Starting email_scheduler Service...');

  // 0. Validate Required Google OAuth Environment Variables
  validateStartupEnv();

  // 1. Connect Database
  try {
    await connectDatabase();
  } catch (err: any) {
    console.error('Fatal: Failed to connect to database:', err.message);
    process.exit(1);
  }

  // 2. Seed initial demo user and test Ethereal senders if empty
  try {
    await seedDatabase();
  } catch (err: any) {
    console.warn('⚠️ Seeding note:', err.message);
  }

  // 3. Connect & Verify Elasticsearch
  await elasticService.verifyConnection();

  // 4. Start BullMQ Worker
  emailWorkerService.start();

  // 5. Start Express HTTP Server
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`📡 email_scheduler Backend API running at http://localhost:${PORT}`);
    console.log(`📊 Bull-Board Queue Dashboard live at http://localhost:${PORT}/admin/queues`);
  });
};

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
});
