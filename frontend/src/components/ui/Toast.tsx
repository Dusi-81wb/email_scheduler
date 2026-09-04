'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-xs font-medium transition-all animate-in slide-in-from-bottom-2 fade-in duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-gray-900 border-gray-800 text-white'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
              {t.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {t.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {t.type === 'info' && (
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return safe fallback if not wrapped
    return {
      success: (msg: string) => console.log('[Toast Success]', msg),
      error: (msg: string) => console.error('[Toast Error]', msg),
      info: (msg: string) => console.log('[Toast Info]', msg),
    };
  }
  return context.toast;
};
