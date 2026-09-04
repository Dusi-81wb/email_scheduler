'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { EmailList } from '../components/EmailList';
import { EmailDetailView } from '../components/EmailDetailView';
import { ComposeView } from '../components/ComposeView';
import { SlackModal } from '../components/SlackModal';
import { LoginView } from '../components/LoginView';
import { api } from '../lib/api';
import { User, SenderAccount, EmailJob, SlackConfig } from '../types';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected email for Detail View (Screenshot 3)
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  // Compose View State (Screenshots 4 & 5)
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // Authenticate & Verify User on Mount
  useEffect(() => {
    // 1. Check for URL query params (e.g. error from Google OAuth redirect)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setAuthError(decodeURIComponent(err));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Failsafe timer so loading state never hangs
    const failsafe = setTimeout(() => {
      setAuthChecking(false);
    }, 2000);

    // 2. Verify active session with backend using stored token
    const token = typeof window !== 'undefined' ? localStorage.getItem('outbox_token') : null;
    if (!token) {
      setUser(null);
      setAuthChecking(false);
      clearTimeout(failsafe);
      return;
    }

    api
      .getCurrentUser()
      .then((verifiedUser) => {
        if (verifiedUser) {
          setUser(verifiedUser);
          localStorage.setItem('outbox_user', JSON.stringify(verifiedUser));
        } else {
          setUser(null);
          localStorage.removeItem('outbox_token');
          localStorage.removeItem('outbox_user');
        }
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('outbox_token');
        localStorage.removeItem('outbox_user');
      })
      .finally(() => {
        clearTimeout(failsafe);
        setAuthChecking(false);
      });

    return () => clearTimeout(failsafe);
  }, []);

  // Fetch Senders & Slack Config when authenticated
  const loadInitialData = useCallback(async () => {
    if (!user) return;
    try {
      const [sendersList, slack] = await Promise.all([
        api.getSenders(),
        api.getSlackConfig(),
      ]);
      setSenders(sendersList);
      setSlackConfig(slack);
    } catch (e) {
      console.warn('Initial data load warning:', e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, loadInitialData]);

  // Fetch Emails & Counts
  const fetchEmails = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);
    setIsRefreshing(true);

    try {
      if (searchQuery.trim()) {
        const searchRes = await api.searchEmails(searchQuery.trim(), activeTab);
        setJobs(searchRes.jobs);
      } else {
        const [schedRes, sentRes] = await Promise.all([
          api.getScheduledEmails(1, 100),
          api.getSentEmails(1, 100),
        ]);

        setScheduledCount(schedRes.total);
        setSentCount(sentRes.total);

        if (activeTab === 'scheduled') {
          setJobs(schedRes.jobs);
        } else {
          setJobs(sentRes.jobs);
        }
      }
    } catch (e) {
      console.error('Error fetching emails:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user, activeTab, searchQuery]);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user, fetchEmails]);

  // Auto-poll in background every 5 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchEmails(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [user, fetchEmails]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSelectedEmail(null);
    setIsComposeOpen(false);
  };

  // 1. Loading State during auth check
  if (authChecking) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          <p className="text-xs text-gray-500">Loading your inbox...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Strict Google OAuth Login View
  if (!user) {
    return <LoginView errorMessage={authError} />;
  }

  // 3. Authenticated: Full Application Interface
  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Left Sidebar (Fixed width, email_scheduler brand, compose, core navigation) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
        slackConfig={slackConfig}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedEmail(null);
          setIsComposeOpen(false);
        }}
        onOpenCompose={() => {
          setSelectedEmail(null);
          setIsComposeOpen(true);
        }}
        onOpenSlack={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {selectedEmail ? (
          // Email Detail / Thread View (Screenshot 3)
          <EmailDetailView
            email={selectedEmail}
            currentUser={user}
            onBack={() => setSelectedEmail(null)}
          />
        ) : isComposeOpen ? (
          // Compose View (Screenshots 4 & 5)
          <ComposeView
            senders={senders}
            onClose={() => setIsComposeOpen(false)}
            onScheduled={() => {
              fetchEmails();
              setActiveTab('scheduled');
            }}
          />
        ) : (
          // List View (Screenshots 1 & 2)
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* Top Search & Actions Bar */}
            <TopBar
              searchQuery={searchQuery}
              onSearchChange={(q) => setSearchQuery(q)}
              onRefresh={() => fetchEmails()}
              isRefreshing={isRefreshing}
            />

            {/* Email List Table */}
            <EmailList
              activeTab={activeTab}
              jobs={jobs}
              loading={loading}
              onSelectEmail={(job) => setSelectedEmail(job)}
            />
          </div>
        )}
      </main>

      {/* Slack Configuration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackConfig={slackConfig}
        onRefreshConfig={loadInitialData}
      />
    </div>
  );
}
