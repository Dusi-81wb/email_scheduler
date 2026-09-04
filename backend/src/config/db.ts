import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback

import { PrismaClient } from '@prisma/client';

console.log('Database URL configured:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL via Prisma');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};
