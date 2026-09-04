'use client';

import React, { useState } from 'react';
import { ArrowLeft, Star, Archive, Trash2, ChevronDown, ExternalLink } from 'lucide-react';
import { EmailJob, User } from '../types';

interface EmailDetailViewProps {
  email: EmailJob;
  currentUser: User | null;
  onBack: () => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  currentUser,
  onBack,
}) => {
  const [isStarred, setIsStarred] = useState(false);

  const formatTimestamp = (dateStr?: string | Date) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return String(dateStr);
    }
  };

  const senderInitial = email.senderEmail.charAt(0).toUpperCase() || 'S';

  return (
    <div className="flex-1 flex flex-col h-screen bg-white overflow-y-auto">
      {/* Top Header Bar */}
      <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
        {/* Left: Back Arrow + Subject Title */}
        <div className="flex items-center space-x-3 flex-1 min-w-0 pr-4">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {email.subject}
          </h2>
        </div>

        {/* Right: Actions & User Profile */}
        <div className="flex items-center space-x-2 text-gray-400">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${
              isStarred ? 'text-amber-400 fill-amber-400' : 'hover:text-gray-600'
            }`}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-gray-100 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-gray-200 ml-1"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center ml-1">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
          )}
        </div>
      </div>

      {/* Email Body Container */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8 space-y-6 flex-1">
        {/* Sender Info Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            {/* Sender Initial Avatar */}
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              {senderInitial}
            </div>

            {/* Sender details */}
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-gray-900">
                  {email.senderEmail.split('@')[0]}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{email.senderEmail}&gt;
                </span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>to me</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-gray-400">
            {formatTimestamp(email.sentAt || email.scheduledAt)}
          </div>
        </div>

        {/* Live Ethereal Preview Banner (If sent) */}
        {email.etherealUrl && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">Live Ethereal Webmail Link Available</span>
            </div>
            <a
              href={email.etherealUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors shadow-sm"
            >
              <span>View in Ethereal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Formatted Message Content */}
        <div className="text-sm text-gray-800 leading-relaxed space-y-4 pt-2">
          {email.body.includes('<') ? (
            <div
              className="prose max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          ) : (
            <div className="whitespace-pre-wrap">{email.body}</div>
          )}

        </div>
      </div>
    </div>
  );
};
