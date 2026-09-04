'use client';

import React, { useState } from 'react';
import { Slack, CheckCircle, AlertTriangle, Send, Link, Unlink } from 'lucide-react';
import { SlackConfig } from '../types';
import { api } from '../lib/api';
import { Modal, Button, Input, useToast } from './ui';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackConfig: SlackConfig | null;
  onRefreshConfig: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackConfig,
  onRefreshConfig,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(slackConfig?.webhookUrl || '');
  const [channel, setChannel] = useState(slackConfig?.channel || '#cold-outreach-alerts');
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const toast = useToast();

  const isConnected = !!(slackConfig && slackConfig.webhookUrl);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setLoading(true);
    try {
      await api.saveSlackWebhook(webhookUrl.trim(), channel.trim());
      toast.success('Slack webhook saved successfully!');
      onRefreshConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save Slack webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setTestSending(true);
    try {
      await api.testAlert();
      toast.success('Live alert sent! Check your Slack channel.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send test alert');
    } finally {
      setTestSending(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectSlack();
      setWebhookUrl('');
      toast.info('Slack disconnected successfully.');
      onRefreshConfig();
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Slack Rate-Limit Alerts"
      description="Receive live alerts when sender hourly limits are reached"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Connection Status Card */}
        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center shrink-0">
              <Slack className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center space-x-1.5">
              {isConnected ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="font-semibold text-gray-800">
                {isConnected
                  ? `Connected to ${slackConfig?.channel || '#alerts'}`
                  : 'Slack is not connected'}
              </span>
            </div>
          </div>

          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
            >
              <Unlink className="w-3 h-3" />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveWebhook} className="space-y-3.5">
          <Input
            label="Incoming Webhook URL"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
            required
            helperText="Create an incoming webhook in your Slack workspace settings."
          />

          <Input
            label="Channel Label"
            type="text"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="#cold-outreach-alerts"
          />

          <div className="flex items-center justify-between pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
              leftIcon={<Link className="w-3.5 h-3.5" />}
            >
              Save Webhook
            </Button>

            {isConnected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestAlert}
                isLoading={testSending}
                leftIcon={<Send className="w-3.5 h-3.5 text-emerald-600" />}
              >
                Send Live Test
              </Button>
            )}
          </div>
        </form>

        <div className="pt-3 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">
            When rate limits are hit during email dispatch, an alert with sender metrics and rescheduled job counts will be automatically posted to your channel.
          </p>
        </div>
      </div>
    </Modal>
  );
};
