import React, { useState } from 'react';
import { Clock, Star, ExternalLink, Mail } from 'lucide-react';
import { EmailJob } from '../types';
import { EmptyState, Badge, Spinner } from './ui';

interface EmailListProps {
  activeTab: 'scheduled' | 'sent';
  jobs: EmailJob[];
  loading: boolean;
  onSelectEmail: (job: EmailJob) => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  activeTab,
  jobs,
  loading,
  onSelectEmail,
}) => {
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatScheduledTime = (dateStr?: string | Date) => {
    if (!dateStr) return 'Pending';
    try {
      const d = new Date(dateStr);
      const weekday = d.toLocaleDateString([], { weekday: 'short' });
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      return `${weekday} ${time}`;
    } catch {
      return String(dateStr);
    }
  };

  const getRecipientDisplay = (email: string) => {
    const namePart = email.split('@')[0];
    if (namePart.includes('.')) {
      return namePart
        .split('.')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
    }
    return email;
  };

  const getSnippet = (body?: string) => {
    if (!body) return 'No preview available...';
    const plainText = body.replace(/<[^>]*>?/gm, '');
    return plainText.length > 85 ? plainText.slice(0, 85) + '...' : plainText;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex items-center space-x-2.5 text-xs text-gray-500 font-medium">
          <Spinner size="sm" color="emerald" />
          <span>Loading your emails...</span>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<Mail className="w-5 h-5 text-gray-400" />}
          title={`No ${activeTab} emails found`}
          description={
            activeTab === 'scheduled'
              ? 'Scheduled outreach batches will appear here with dynamic delivery countdowns.'
              : 'Sent emails and their live Ethereal webmail preview links will appear here.'
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white">
      {jobs.map((job) => {
        const isStarred = !!starredIds[job.id];
        const recipientName = getRecipientDisplay(job.recipientEmail);

        return (
          <div
            key={job.id}
            onClick={() => onSelectEmail(job)}
            className="group flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer text-xs"
          >
            {/* Left: Recipient Name + Badge + Subject + Snippet */}
            <div className="flex items-center space-x-4 min-w-0 flex-1 pr-4">
              {/* Recipient Label (e.g. "To: John Smith") */}
              <div className="w-44 shrink-0 truncate text-gray-900">
                <span className="font-bold">To: </span>
                <span className="font-semibold text-gray-800">{recipientName}</span>
              </div>

              {/* Status Badge */}
              {activeTab === 'scheduled' ? (
                <Badge
                  variant="warning"
                  icon={<Clock className="w-3 h-3 text-amber-600" />}
                  className="shrink-0"
                >
                  {formatScheduledTime(job.scheduledAt)}
                </Badge>
              ) : (
                <Badge variant="neutral" className="shrink-0">
                  Sent
                </Badge>
              )}

              {/* Subject & Snippet (e.g. "Meeting follow-up - Scheduled - Hi John...") */}
              <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                <span className="font-semibold text-gray-900 shrink-0">
                  {job.subject}
                </span>
                <span className="text-gray-400 shrink-0">-</span>
                <span className="text-gray-500 font-normal truncate">
                  {getSnippet(job.body)}
                </span>
              </div>
            </div>

            {/* Right: Actions (Ethereal Link if sent, and Star Icon) */}
            <div className="flex items-center space-x-3 shrink-0">
              {job.etherealUrl && (
                <a
                  href={job.etherealUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open live Ethereal webmail preview"
                  className="opacity-0 group-hover:opacity-100 text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-1 transition-opacity"
                >
                  <span>Preview</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={(e) => toggleStar(e, job.id)}
                title={isStarred ? 'Unstar' : 'Star'}
                className={`p-1 rounded transition-colors ${
                  isStarred
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-300 hover:text-gray-400'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
