'use client';

import React, { useState } from 'react';
import { Clock, Send, ChevronDown, User as UserIcon, LogOut, Activity, Slack, Mail } from 'lucide-react';
import { User, SlackConfig } from '../types';

interface SidebarProps {
  user: User | null;
  activeTab: 'scheduled' | 'sent';
  scheduledCount: number;
  sentCount: number;
  slackConfig: SlackConfig | null;
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  scheduledCount,
  sentCount,
  slackConfig,
  onTabChange,
  onOpenCompose,
  onOpenSlack,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isSlackConnected = !!(slackConfig && slackConfig.webhookUrl);
  const bullBoardUrl = process.env.NEXT_PUBLIC_BULL_BOARD_URL || 'http://localhost:5000/admin/queues';

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shrink-0 select-none">
      {/* Top Section: Brand Logo */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center space-x-2.5">
          {/* Small sleek logo */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-gray-900 block truncate">
              email_scheduler
            </span>
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="px-4 py-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-gray-100/80 hover:bg-gray-200/70 transition-colors text-left"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  <UserIcon className="w-4 h-4 text-emerald-700" />
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {user?.email || 'user@domain.io'}
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50 text-xs text-gray-700">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compose Button (Green Pill Outline from Figma) */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onOpenCompose}
          className="w-full py-2 px-4 rounded-full border border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 font-medium text-sm text-center transition-all shadow-sm flex items-center justify-center cursor-pointer"
        >
          Compose
        </button>
      </div>

      {/* Navigation Section */}
      <div className="px-4 py-2 flex-1 space-y-1">
        <div className="px-3 py-1">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            CORE
          </span>
        </div>

        {/* Scheduled Tab */}
        <button
          type="button"
          onClick={() => onTabChange('scheduled')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
            activeTab === 'scheduled'
              ? 'bg-[#E6F4EA] text-emerald-900 font-semibold'
              : 'text-gray-700 hover:bg-gray-100 font-normal'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-emerald-700' : 'text-gray-500'}`} />
            <span>Scheduled</span>
          </div>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-md ${
              activeTab === 'scheduled'
                ? 'text-emerald-800 font-semibold'
                : 'text-gray-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        {/* Sent Tab */}
        <button
          type="button"
          onClick={() => onTabChange('sent')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
            activeTab === 'sent'
              ? 'bg-[#E6F4EA] text-emerald-900 font-semibold'
              : 'text-gray-700 hover:bg-gray-100 font-normal'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-emerald-700' : 'text-gray-500'}`} />
            <span>Sent</span>
          </div>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-md ${
              activeTab === 'sent'
                ? 'text-emerald-800 font-semibold'
                : 'text-gray-400'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </div>

      {/* Bottom Utility Integrations (Bull-Board & Slack) */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        <a
          href={bullBoardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] text-gray-600 hover:bg-gray-100 transition-colors"
          title="Open BullMQ Queue Monitor"
        >
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Live Queues</span>
          </div>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
            Active
          </span>
        </a>

        <button
          type="button"
          onClick={onOpenSlack}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Slack className={`w-3.5 h-3.5 ${isSlackConnected ? 'text-emerald-500' : 'text-gray-400'}`} />
            <span>Slack Alerts</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isSlackConnected
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-gray-400 bg-gray-100'
            }`}
          >
            {isSlackConnected ? 'Connected' : 'Setup'}
          </span>
        </button>
      </div>
    </aside>
  );
};
