'use client';

import React, { useState, useEffect } from 'react';
import { BRAND } from '@/lib/brand';

interface EmailAppProps {
  onClose: () => void;
}

interface EmailSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string | null;
  from: string | null;
  date: string | null;
}

interface FullEmail {
  id: string;
  threadId: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  date: string | null;
  body: string | null;
  snippet: string;
}

type View = 'inbox' | 'detail' | 'compose';

export function EmailApp({ onClose }: EmailAppProps) {
  const [view, setView] = useState<View>('inbox');
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<FullEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Compose form state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');

  // Fetch inbox on mount
  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async (pageToken?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/integrations/gmail/inbox', window.location.origin);
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch inbox');
      }

      setEmails(pageToken ? [...emails, ...(data.messages || [])] : (data.messages || []));
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error('Failed to fetch inbox:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch inbox');
    } finally {
      setLoading(false);
    }
  };

  const fetchFullEmail = async (messageId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/gmail/message/${messageId}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch email');
      }

      setSelectedEmail(data.message);
      setView('detail');
    } catch (err) {
      console.error('Failed to fetch email:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch email');
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    // Validate required fields
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setSendError('To, Subject, and Body are required');
      return;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const response = await fetch('/api/integrations/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          cc: composeCc || undefined,
          bcc: composeBcc || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setSendSuccess(true);
      // Clear form after 2 seconds and return to inbox
      setTimeout(() => {
        resetComposeForm();
        setView('inbox');
        setSendSuccess(false);
        // Refresh inbox to show sent email
        fetchInbox();
      }, 2000);
    } catch (err) {
      console.error('Failed to send email:', err);
      setSendError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const resetComposeForm = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeCc('');
    setComposeBcc('');
    setSendError(null);
    setSendSuccess(false);
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    
    // Pre-fill compose form with reply data
    setComposeTo(selectedEmail.from || '');
    setComposeSubject(`Re: ${selectedEmail.subject || '(No Subject)'}`);
    setComposeBody(`\n\n---\nOn ${selectedEmail.date || 'Unknown date'}, ${selectedEmail.from || 'Unknown sender'} wrote:\n${selectedEmail.body || selectedEmail.snippet}`);
    setView('compose');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const extractEmailAddress = (fromString: string | null) => {
    if (!fromString) return 'Unknown';
    // Extract email from "Name <email@example.com>" format
    const match = fromString.match(/<(.+?)>/);
    return match ? match[1] : fromString;
  };

  const extractSenderName = (fromString: string | null) => {
    if (!fromString) return 'Unknown Sender';
    // Extract name from "Name <email@example.com>" format
    const match = fromString.match(/^(.+?)\s*</);
    if (match) {
      return match[1].replace(/^["']|["']$/g, ''); // Remove quotes if present
    }
    return fromString;
  };

  // Render inbox view
  const renderInbox = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-100 tracking-wider">INBOX</h3>
        <div className="flex gap-2">
          <button
            onClick={() => fetchInbox()}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-sm text-purple-200 transition-all disabled:opacity-50"
          >
            {loading ? '↻' : '⟳'} Refresh
          </button>
          <button
            onClick={() => {
              resetComposeForm();
              setView('compose');
            }}
            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 rounded-lg text-sm text-cyan-200 transition-all"
          >
            ✎ Compose
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Email list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {emails.length === 0 && !loading && (
          <div className="text-center text-purple-300/60 py-8">
            {error ? 'Unable to load emails' : 'No emails found'}
          </div>
        )}

        {emails.map((email) => (
          <div
            key={email.id}
            onClick={() => fetchFullEmail(email.id)}
            className="p-3 bg-purple-950/30 border border-purple-400/20 rounded-lg hover:bg-purple-500/20 hover:border-purple-400/50 cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="font-bold text-purple-100 text-sm">
                {extractSenderName(email.from)}
              </span>
              <span className="text-xs text-purple-300/60">
                {formatDate(email.date)}
              </span>
            </div>
            <div className="text-sm text-purple-200 mb-1 font-medium">
              {email.subject || '(No Subject)'}
            </div>
            <div className="text-xs text-purple-300/60 line-clamp-2">
              {email.snippet}
            </div>
          </div>
        ))}

        {/* Load more button */}
        {nextPageToken && !loading && (
          <button
            onClick={() => fetchInbox(nextPageToken)}
            className="w-full p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/20 rounded-lg text-purple-200 text-sm transition-all"
          >
            Load More ↓
          </button>
        )}

        {loading && (
          <div className="text-center text-purple-300/60 py-4">
            <div className="animate-pulse">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );

  // Render email detail view
  const renderDetail = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setView('inbox')}
          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-sm text-purple-200 transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleReply}
          className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 rounded-lg text-sm text-cyan-200 transition-all"
        >
          ↵ Reply
        </button>
      </div>

      {selectedEmail && (
        <div className="flex-1 overflow-y-auto pr-2">
          {/* Email metadata */}
          <div className="mb-4 p-4 bg-purple-950/30 border border-purple-400/20 rounded-lg">
            <h3 className="text-xl font-bold text-purple-100 mb-3">
              {selectedEmail.subject || '(No Subject)'}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex">
                <span className="text-purple-300/60 w-16">From:</span>
                <span className="text-purple-200">{selectedEmail.from || 'Unknown'}</span>
              </div>
              <div className="flex">
                <span className="text-purple-300/60 w-16">To:</span>
                <span className="text-purple-200">{selectedEmail.to || 'Unknown'}</span>
              </div>
              {selectedEmail.cc && (
                <div className="flex">
                  <span className="text-purple-300/60 w-16">Cc:</span>
                  <span className="text-purple-200">{selectedEmail.cc}</span>
                </div>
              )}
              <div className="flex">
                <span className="text-purple-300/60 w-16">Date:</span>
                <span className="text-purple-200">{formatDate(selectedEmail.date)}</span>
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="p-4 bg-purple-950/20 border border-purple-400/20 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm text-purple-100 font-mono">
              {selectedEmail.body || selectedEmail.snippet || '(No content)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );

  // Render compose view
  const renderCompose = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-100 tracking-wider">COMPOSE EMAIL</h3>
        <button
          onClick={() => {
            resetComposeForm();
            setView('inbox');
          }}
          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-sm text-purple-200 transition-all"
        >
          Cancel
        </button>
      </div>

      {/* Success message */}
      {sendSuccess && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg text-green-200 text-sm">
          ✓ Email sent successfully!
        </div>
      )}

      {/* Error message */}
      {sendError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
          ⚠️ {sendError}
        </div>
      )}

      {/* Compose form */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {/* To field */}
        <div>
          <label className="block text-sm text-purple-300 mb-1">To: *</label>
          <input
            type="email"
            value={composeTo}
            onChange={(e) => setComposeTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full px-3 py-2 bg-purple-950/30 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400/60 transition-colors"
            disabled={sending}
          />
        </div>

        {/* CC field */}
        <div>
          <label className="block text-sm text-purple-300 mb-1">Cc:</label>
          <input
            type="email"
            value={composeCc}
            onChange={(e) => setComposeCc(e.target.value)}
            placeholder="cc@example.com (optional)"
            className="w-full px-3 py-2 bg-purple-950/30 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400/60 transition-colors"
            disabled={sending}
          />
        </div>

        {/* BCC field */}
        <div>
          <label className="block text-sm text-purple-300 mb-1">Bcc:</label>
          <input
            type="email"
            value={composeBcc}
            onChange={(e) => setComposeBcc(e.target.value)}
            placeholder="bcc@example.com (optional)"
            className="w-full px-3 py-2 bg-purple-950/30 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400/60 transition-colors"
            disabled={sending}
          />
        </div>

        {/* Subject field */}
        <div>
          <label className="block text-sm text-purple-300 mb-1">Subject: *</label>
          <input
            type="text"
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full px-3 py-2 bg-purple-950/30 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400/60 transition-colors"
            disabled={sending}
          />
        </div>

        {/* Body field */}
        <div>
          <label className="block text-sm text-purple-300 mb-1">Body: *</label>
          <textarea
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            placeholder="Write your message..."
            rows={12}
            className="w-full px-3 py-2 bg-purple-950/30 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400/60 transition-colors resize-none font-mono text-sm"
            disabled={sending}
          />
        </div>

        {/* Send button */}
        <button
          onClick={sendEmail}
          disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
          className="w-full p-3 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-cyan-400/30 rounded-lg text-cyan-100 font-bold tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'SENDING...' : '✉ SEND EMAIL'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative w-[600px] h-[700px] bg-black/80 backdrop-blur-xl border-2 border-purple-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
      {/* Header */}
      <div
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing"
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">📧</div>
          <h2 className="text-xl font-bold text-purple-400 tracking-wider">EMAIL</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Content area */}
      <div className="h-[calc(100%-5rem)]">
        {view === 'inbox' && renderInbox()}
        {view === 'detail' && renderDetail()}
        {view === 'compose' && renderCompose()}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-6 right-6 text-center text-xs text-purple-400/60 tracking-wider">
        {BRAND.productName.toUpperCase()} EMAIL SYSTEM • {emails.length} MESSAGE{emails.length !== 1 ? 'S' : ''}
      </div>
    </div>
  );
}
