import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '../components/ui/Toast';

export const metadata: Metadata = {
  title: 'email_scheduler | Cold Email Scheduler & Dispatcher',
  description: 'Production-grade cold email dispatcher with BullMQ persistent queue, rate-limiting, and live analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 min-h-screen selection:bg-emerald-600 selection:text-white antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
