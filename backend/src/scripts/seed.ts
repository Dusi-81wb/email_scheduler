import { prisma } from '../config/db';
import nodemailer from 'nodemailer';

export const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...');

  try {
    // Create Ethereal Senders if fewer than 2 exist
    const existingSenders = await prisma.senderAccount.count();
    if (existingSenders < 2) {
      console.log('Generating additional Ethereal SMTP test accounts...');
      
      const account1 = await nodemailer.createTestAccount();
      await prisma.senderAccount.upsert({
        where: { email: account1.user },
        update: {},
        create: {
          email: account1.user,
          host: account1.smtp.host,
          port: account1.smtp.port,
          user: account1.user,
          pass: account1.pass,
          isEthereal: true,
          hourlyLimit: 100,
        },
      });
      console.log(`✅ Seeded Sender 1: ${account1.user}`);

      const account2 = await nodemailer.createTestAccount();
      await prisma.senderAccount.upsert({
        where: { email: account2.user },
        update: {},
        create: {
          email: account2.user,
          host: account2.smtp.host,
          port: account2.smtp.port,
          user: account2.user,
          pass: account2.pass,
          isEthereal: true,
          hourlyLimit: 50,
        },
      });
      console.log(`✅ Seeded Sender 2: ${account2.user}`);
    } else {
      console.log(`ℹ️ Senders already exist (${existingSenders} found).`);
    }

    console.log('🎉 Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
