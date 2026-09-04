'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (token && userParam) {
      try {
        const decodedUser = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('outbox_token', token);
        localStorage.setItem('outbox_user', JSON.stringify(decodedUser));
        
        // Redirect to main dashboard
        router.replace('/');
      } catch (err: any) {
        console.error('Failed to parse user session:', err);
        setError('Failed to establish user session. Please try again.');
      }
    } else {
      setError('Invalid authentication response from Google OAuth.');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Authentication Failed</h2>
          <p className="text-xs text-zinc-400">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
        <h2 className="text-sm font-semibold text-zinc-200">Verifying Google Authentication...</h2>
        <p className="text-xs text-zinc-500">Establishing session and redirecting to email_scheduler dashboard.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
