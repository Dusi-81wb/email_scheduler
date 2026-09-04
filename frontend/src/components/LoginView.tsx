'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';

interface LoginViewProps {
  errorMessage?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ errorMessage }) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailLoginNotice, setEmailLoginNotice] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    // Redirect directly to real backend Google OAuth initiation route
    window.location.href = api.getGoogleLoginUrl();
  };

  const handleEmailLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoginNotice('Google OAuth Login is required by the project specification. Please click "Login with Google" above.');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Centered Login Card matching Figma Screenshot */}
      <div className="w-full max-w-[380px] p-8 bg-white border border-gray-150 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 text-center space-y-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Login
        </h1>

        {/* Error notification if returning from failed OAuth */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 text-left">
            {errorMessage}
          </div>
        )}

        {/* Notice if attempting email/password login */}
        {emailLoginNotice && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 text-left">
            {emailLoginNotice}
          </div>
        )}

        {/* 1. Login with Google Button (Matching Figma: soft mint pill/button with G logo) */}
        <div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 bg-[#E6F4EA] hover:bg-[#D8EFE0] active:bg-[#C9E8D3] text-gray-800 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Login with Google</span>
          </button>
        </div>

        {/* 2. Divider (or sign up through email) */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-gray-150 w-full" />
          <span className="bg-white px-3 text-[11px] text-gray-400 absolute">
            or sign up through email
          </span>
        </div>

        {/* 3. Email & Password Inputs */}
        <form onSubmit={handleEmailLoginSubmit} className="space-y-3 pt-2 text-left">
          <div>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email ID"
              className="w-full px-3.5 py-2.5 bg-[#F1F3F4] text-xs text-gray-800 placeholder-gray-400 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="w-full px-3.5 py-2.5 bg-[#F1F3F4] text-xs text-gray-800 placeholder-gray-400 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* 4. Solid Green Login Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#009E49] hover:bg-[#008A40] active:bg-[#007637] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
