'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  ChevronDown,
  X,
  AlertCircle,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Quote,
  Code,
  Strikethrough,
} from 'lucide-react';
import { SenderAccount } from '../types';
import { api } from '../lib/api';
import { parseEmailLeads } from '../lib/csv-parser';
import { useToast } from './ui';

interface ComposeViewProps {
  senders: SenderAccount[];
  onClose: () => void;
  onScheduled: () => void;
}

export const ComposeView: React.FC<ComposeViewProps> = ({
  senders,
  onClose,
  onScheduled,
}) => {
  // Form State
  const [senderEmail, setSenderEmail] = useState(senders[0]?.email || 'oliver.brown@domain.io');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientList, setRecipientList] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isExpandedRecipients, setIsExpandedRecipients] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayValue, setDelayValue] = useState<number>(2);
  const [delayUnit, setDelayUnit] = useState<'sec' | 'ms'>('sec');
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Rich Text Editor State & Controls
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    heading: false,
    orderedList: false,
    unorderedList: false,
    justifyLeft: false,
    blockquote: false,
    code: false,
  });

  // Sync initial body on mount if provided
  useEffect(() => {
    if (editorRef.current && body && editorRef.current.innerHTML !== body) {
      editorRef.current.innerHTML = body;
    }
  }, []);

  const checkActiveFormats = () => {
    if (typeof document === 'undefined') return;
    try {
      const formatBlock = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        heading:
          formatBlock.includes('h3') ||
          formatBlock.includes('h2') ||
          formatBlock.includes('h1') ||
          formatBlock.includes('heading'),
        orderedList: document.queryCommandState('insertOrderedList'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        blockquote: formatBlock.includes('blockquote'),
        code: formatBlock.includes('pre'),
      });
    } catch {
      // ignore
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    checkActiveFormats();
  };

  const toggleBlockFormat = (tag: 'h3' | 'blockquote' | 'pre') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const currentBlock = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    const isCurrentlyTag = currentBlock.includes(tag);
    const target = isCurrentlyTag ? '<p>' : `<${tag}>`;
    try {
      document.execCommand('formatBlock', false, target);
    } catch {
      document.execCommand('formatBlock', false, isCurrentlyTag ? 'p' : tag);
    }
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    checkActiveFormats();
  };

  // Compute effective delay in ms and formatted seconds
  const effectiveDelayMs = Math.max(
    500,
    delayUnit === 'sec'
      ? (delayValue >= 100 ? delayValue : Math.round((delayValue || 0) * 1000))
      : (delayValue < 100 ? Math.round((delayValue || 0) * 1000) : (delayValue || 500))
  );

  const effectiveSeconds = (effectiveDelayMs / 1000).toFixed(
    effectiveDelayMs % 1000 === 0 ? 0 : 1
  );

  // Send Later Popover State
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();

  const leadFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Parse uploaded CSV/TXT lead file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { validEmails, totalDetected, duplicateCount } = await parseEmailLeads(file);
      if (validEmails.length > 0) {
        setRecipientList((prev) => Array.from(new Set([...prev, ...validEmails])));
        setErrorMessage(null);
        const dupNote = duplicateCount > 0 ? ` (${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} skipped)` : '';
        toast.success(`Imported ${validEmails.length} recipient${validEmails.length > 1 ? 's' : ''} from ${file.name}${dupNote}`);
      } else {
        setErrorMessage('No valid email addresses found in uploaded file.');
        toast.error('No valid email addresses found in uploaded file.');
      }
    } catch {
      setErrorMessage('Failed to parse uploaded lead file.');
      toast.error('Failed to parse uploaded lead file.');
    } finally {
      e.target.value = '';
    }
  };

  // Handle actual file attachments
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setAttachments((prev) => [...prev, ...files]);
    toast.success(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
    e.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = recipientInput.trim().replace(',', '');
      if (trimmed && trimmed.includes('@')) {
        if (!recipientList.includes(trimmed)) {
          setRecipientList((prev) => [...prev, trimmed]);
        }
        setRecipientInput('');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipientList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Quick preset helper for Send Later
  const setQuickPreset = (hoursFromNow: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow);
    d.setMinutes(0);
    d.setSeconds(0);
    // Format YYYY-MM-DDTHH:mm
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledDateTime(localIso);
  };

  const handleSendOrSchedule = async () => {
    setErrorMessage(null);

    // Merge any leftover text in input
    const extra = recipientInput.trim().replace(',', '');
    const finalRecipients = [...recipientList];
    if (extra && extra.includes('@') && !finalRecipients.includes(extra)) {
      finalRecipients.push(extra);
    }

    if (finalRecipients.length === 0) {
      setErrorMessage('Please specify at least one recipient email or upload a lead list.');
      return;
    }

    if (!subject.trim()) {
      setErrorMessage('Please enter an email subject.');
      return;
    }

    const htmlBody = editorRef.current?.innerHTML || body;
    const textBody = editorRef.current?.innerText?.trim() || '';

    if (!textBody && (!htmlBody || htmlBody === '<br>' || !htmlBody.trim())) {
      setErrorMessage('Please enter email body content.');
      return;
    }

    setIsSending(true);

    try {
      await api.scheduleEmails({
        subject: subject.trim(),
        body: htmlBody,
        senderEmail: senderEmail || senders[0]?.email || 'oliver.brown@domain.io',
        recipients: finalRecipients,
        startTime: scheduledDateTime ? new Date(scheduledDateTime).toISOString() : undefined,
        delayBetweenMs: effectiveDelayMs,
        hourlyLimit: Number(hourlyLimit) || 100,
      });

      toast.success(
        `Successfully scheduled outreach batch to ${finalRecipients.length} recipients!`
      );
      onScheduled();
      onClose();
    } catch (err: any) {
      console.error('Failed to dispatch email batch:', err);
      const msg = err.response?.data?.error || 'Failed to dispatch email batch.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const isScheduled = !!scheduledDateTime;

  // Render recipient chips matching Figma Screenshot:
  // e.g. [tame@jmail.com] [lame@jmail.com] [dame@jmail.com] [+4]
  const visibleChips = isExpandedRecipients ? recipientList : recipientList.slice(0, 3);
  const overflowCount = recipientList.length - 3;

  return (
    <div className="flex-1 flex flex-col h-screen bg-white overflow-y-auto relative select-none">
      {/* Top Bar */}
      <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
        {/* Left: Back Arrow + Title */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Discard and return"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            Compose New Email
          </h2>
        </div>

        {/* Right Actions: Paperclip, Clock (Send Later), and Send / Send Later button */}
        <div className="flex items-center space-x-3 relative">
          {/* Paperclip Icon with live badge (only shown if attachments exist) */}
          <div className="flex items-center space-x-1 text-emerald-600">
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              title="Attach files"
              className="p-1.5 hover:bg-emerald-50 rounded-full transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4 text-emerald-600" />
            </button>
            {attachments.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full leading-none">
                {attachments.length}
              </span>
            )}
          </div>

          {/* Clock Icon (Toggles Send Later Popover) */}
          <button
            type="button"
            onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
            title="Schedule dispatch time"
            className={`p-2 rounded-full transition-colors ${
              isScheduled
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Primary Action Button (Send or Send Later) matching green outline pill in Figma */}
          <button
            type="button"
            onClick={handleSendOrSchedule}
            disabled={isSending}
            className="border border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-full px-5 py-1.5 text-xs font-semibold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isSending ? 'Scheduling...' : isScheduled ? 'Send Later' : 'Send Later'}</span>
          </button>

          {/* SEND LATER POPOVER CARD (Matching Figma Screenshot) */}
          {isSendLaterOpen && (
            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 z-50 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Send Later</h3>

              {/* Date & Time Picker */}
              <div className="relative mb-4">
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 mb-5 text-gray-600">
                <button
                  type="button"
                  onClick={() => setQuickPreset(24)}
                  className="w-full text-left py-1.5 px-2 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPreset(20)}
                  className="w-full text-left py-1.5 px-2 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPreset(21)}
                  className="w-full text-left py-1.5 px-2 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPreset(25)}
                  className="w-full text-left py-1.5 px-2 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              {/* Popover Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateTime('');
                    setIsSendLaterOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsSendLaterOpen(false)}
                  className="border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-full px-4 py-1 text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Compose Form */}
      <div className="max-w-4xl w-full mx-auto px-8 py-6 space-y-4 flex-1 flex flex-col">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={leadFileInputRef}
          onChange={handleFileUpload}
          accept=".csv,.txt"
          className="hidden"
        />
        <input
          type="file"
          ref={attachmentInputRef}
          onChange={handleAttachmentUpload}
          multiple
          className="hidden"
        />

        {/* From Field */}
        <div className="flex items-center py-1.5 border-b border-gray-100 text-xs">
          <span className="w-16 text-gray-500 font-medium">From</span>
          <div className="relative">
            <select
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="appearance-none bg-gray-100/90 hover:bg-gray-200/70 text-gray-800 font-medium text-xs py-1.5 pl-3 pr-7 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.email}>
                  {s.email}
                </option>
              ))}
              {!senders.some((s) => s.email === 'oliver.brown@domain.io') && (
                <option value="oliver.brown@domain.io">oliver.brown@domain.io</option>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        {/* To Field with green pill chips */}
        <div className="flex items-center py-2 border-b border-gray-100 text-xs">
          <span className="w-16 text-gray-500 font-medium shrink-0">To</span>

          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0 pr-2">
            {visibleChips.map((email, idx) => (
              <span
                key={email + idx}
                className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full border border-emerald-500 bg-emerald-50/20 text-emerald-800 text-xs font-medium"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="hover:text-rose-600 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Overflow chip "+N" */}
            {!isExpandedRecipients && overflowCount > 0 && (
              <button
                type="button"
                onClick={() => setIsExpandedRecipients(true)}
                title="Show all recipients"
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-500 bg-white text-emerald-800 text-xs font-medium hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                +{overflowCount}
              </button>
            )}

            {isExpandedRecipients && overflowCount > 0 && (
              <button
                type="button"
                onClick={() => setIsExpandedRecipients(false)}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline ml-1"
              >
                collapse
              </button>
            )}

            {/* Text input to type new email */}
            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleAddRecipient}
              placeholder={recipientList.length === 0 ? 'Enter recipient email (press Enter) or click Upload List...' : 'add email...'}
              className="py-1 text-xs text-gray-800 placeholder-gray-400 bg-transparent border-0 focus:outline-none min-w-[240px] flex-1"
            />
          </div>

          {/* Upload List Button */}
          <button
            type="button"
            onClick={() => leadFileInputRef.current?.click()}
            className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2.5 py-1 rounded-md hover:bg-emerald-50 transition-colors shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Upload List</span>
          </button>
        </div>

        {/* Subject Field */}
        <div className="flex items-center py-1.5 border-b border-gray-100 text-xs">
          <span className="w-16 text-gray-500 font-medium">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 py-1 text-xs text-gray-900 placeholder-gray-400 bg-transparent border-0 focus:outline-none"
          />
        </div>

        {/* Concurrency & Rate Limit Row (Delay between 2 emails, Hourly Limit) */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 py-2.5 border-b border-gray-100 text-xs text-gray-600">
          <div className="flex items-center space-x-2.5">
            <span className="text-gray-500 font-medium">Delay between 2 emails:</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="number"
                min="0.5"
                step={delayUnit === 'sec' ? '0.5' : '500'}
                value={delayValue}
                onChange={(e) => setDelayValue(parseFloat(e.target.value) || 0)}
                placeholder={delayUnit === 'sec' ? '2' : '2000'}
                className="w-18 px-2 py-1 bg-white border border-gray-200 rounded-lg text-center text-xs font-mono font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              {/* Unit selector dropdown */}
              <div className="relative inline-block">
                <select
                  value={delayUnit}
                  onChange={(e) => {
                    const newUnit = e.target.value as 'sec' | 'ms';
                    setDelayUnit(newUnit);
                    if (newUnit === 'sec' && delayValue >= 100) {
                      setDelayValue(delayValue / 1000);
                    } else if (newUnit === 'ms' && delayValue < 100) {
                      setDelayValue(delayValue * 1000);
                    }
                  }}
                  className="appearance-none bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium py-1 pl-2 pr-5 rounded-md border border-gray-200 focus:outline-none cursor-pointer"
                >
                  <option value="sec">sec</option>
                  <option value="ms">ms</option>
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>

              {/* Prominent Seconds Indicator Badge */}
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-xs">
                <span>⏱</span>
                <span>{effectiveSeconds} second{Number(effectiveSeconds) === 1 ? '' : 's'}</span>
                <span className="text-[10px] text-emerald-600 font-normal">({effectiveDelayMs.toLocaleString()} ms)</span>
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="hidden sm:flex items-center space-x-1 pl-1">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setDelayUnit('sec');
                    setDelayValue(s);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    delayUnit === 'sec' && delayValue === s
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-500 font-medium">Hourly Limit</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                placeholder="100"
                className="w-16 px-2 py-1 bg-white border border-gray-200 rounded-lg text-center text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-gray-400">/hr</span>
            </div>
          </div>

          {scheduledDateTime && (
            <div className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full text-[11px] border border-amber-200">
              <Clock className="w-3 h-3" />
              <span>Scheduled: {new Date(scheduledDateTime).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Rich Text Editor Toolbar (Matching Figma design) */}
        <div className="flex items-center flex-wrap gap-1 py-1.5 px-3 bg-white border border-gray-200 rounded-t-xl text-gray-500 text-xs shadow-xs">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('undo');
            }}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('redo');
            }}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-gray-200 mx-1" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlockFormat('h3');
            }}
            className={`px-1.5 py-1 rounded font-serif text-xs font-bold transition-colors ${
              activeFormats.heading
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Heading 3 (Tt)"
          >
            Tt
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('bold');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.bold
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('italic');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.italic
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('underline');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.underline
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('strikeThrough');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.strikeThrough
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-gray-200 mx-1" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('justifyLeft');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.justifyLeft
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('insertOrderedList');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.orderedList
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('insertUnorderedList');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.unorderedList
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlockFormat('blockquote');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.blockquote
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Blockquote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlockFormat('pre');
            }}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.code
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message Body Area (Interactive contentEditable Rich Text Area) */}
        <div
          className="flex-1 flex flex-col cursor-text"
          onClick={() => {
            if (editorRef.current && document.activeElement !== editorRef.current) {
              editorRef.current.focus();
            }
          }}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type Your Reply..."
            data-empty={!body || body === '<br>' || body.trim() === ''}
            onInput={(e) => {
              setBody(e.currentTarget.innerHTML);
              checkActiveFormats();
            }}
            onKeyUp={checkActiveFormats}
            onMouseUp={checkActiveFormats}
            onSelect={checkActiveFormats}
            className="rich-editor w-full flex-1 min-h-[260px] p-4 bg-white rounded-b-xl border-x border-b border-gray-200 text-xs text-gray-800 focus:outline-none overflow-y-auto leading-relaxed font-sans"
          />
        </div>

        {/* Real Attachments List (only shown if files are actually attached) */}
        {attachments.length > 0 && (
          <div className="pt-3 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700">
              <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
              <span>Attachments ({attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {attachments.map((file, idx) => (
                <div
                  key={file.name + idx}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs transition-colors shadow-2xs"
                >
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-medium text-gray-800 max-w-[200px] truncate">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-gray-400 hover:text-rose-600 ml-1 p-0.5 rounded transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
