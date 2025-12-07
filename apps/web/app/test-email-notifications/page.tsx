'use client';

import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/context/NotificationContext';

interface EmailNotificationStatus {
  ok: boolean;
  initialized: boolean;
  state?: {
    lastCheckedAt: string | null;
    lastMessageId: string | null;
    checkCount: number;
    lastError: string | null;
  };
  config?: {
    enabled: boolean;
    checkIntervalMinutes: number;
    notifyUnreadOnly: boolean;
    maxMessagesPerCheck: number;
  };
}

export default function TestEmailNotificationsPage() {
  const { notifications, scheduleNotification } = useNotifications();
  const [status, setStatus] = useState<EmailNotificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch email notification status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/email-notifications/status');
      const data = await response.json();
      setStatus(data);
      setMessage('');
    } catch (error) {
      setMessage('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual email check
  const triggerCheck = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/email-notifications/trigger', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.ok) {
        setMessage('✅ Email check triggered successfully');
        // Refresh status after 2 seconds
        setTimeout(fetchStatus, 2000);
      } else {
        setMessage('❌ Failed to trigger check: ' + data.error);
      }
    } catch (error) {
      setMessage('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Simulate email notification (for testing UI)
  const simulateEmailNotification = async () => {
    try {
      setLoading(true);
      const triggerAt = new Date().toISOString();
      const success = await scheduleNotification(
        'email_notification',
        {
          messageId: 'test_' + Date.now(),
          threadId: 'thread_test',
          subject: 'Test Email Notification',
          from: 'test@example.com',
          date: triggerAt,
          snippet: 'This is a test email notification to verify the UI display works correctly.'
        },
        triggerAt
      );

      if (success) {
        setMessage('✅ Test notification scheduled (should appear in ~1 second)');
      } else {
        setMessage('❌ Failed to schedule test notification');
      }
    } catch (error) {
      setMessage('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Update config
  const updateConfig = async (enabled: boolean) => {
    try {
      setLoading(true);
      const response = await fetch('/api/email-notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await response.json();
      if (data.ok) {
        setMessage(`✅ Email notifications ${enabled ? 'enabled' : 'disabled'}`);
        setTimeout(fetchStatus, 1000);
      } else {
        setMessage('❌ Failed to update config: ' + data.error);
      }
    } catch (error) {
      setMessage('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Load status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Filter email notifications
  const emailNotifications = notifications.filter(n => n.type === 'email_notification');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            📧 Email Notification System - Test Dashboard
          </h1>
          <p className="text-gray-300">
            Phase 7: Testing & Validation - Email Notification Integration
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('❌') ? 'bg-red-500/20 border-2 border-red-500' : 'bg-green-500/20 border-2 border-green-500'}`}>
            <p className="text-white font-medium">{message}</p>
          </div>
        )}

        {/* System Status Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border-2 border-white/20 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">📊 System Status</h2>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh Status'}
            </button>
          </div>

          {status ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-black/30 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Initialization Status</p>
                  <p className={`text-xl font-bold ${status.initialized ? 'text-green-400' : 'text-red-400'}`}>
                    {status.initialized ? '✅ Initialized' : '❌ Not Initialized'}
                  </p>
                </div>

                <div className="bg-black/30 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Service Status</p>
                  <p className={`text-xl font-bold ${status.config?.enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                    {status.config?.enabled ? '🟢 Enabled' : '🟡 Disabled'}
                  </p>
                </div>
              </div>

              {status.state && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Last Checked:</span>
                    <span className="text-white font-mono">
                      {status.state.lastCheckedAt ? new Date(status.state.lastCheckedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Last Message ID:</span>
                    <span className="text-white font-mono text-xs">
                      {status.state.lastMessageId || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Checks:</span>
                    <span className="text-white font-bold">{status.state.checkCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Last Error:</span>
                    <span className={`font-mono ${status.state.lastError ? 'text-red-400' : 'text-green-400'}`}>
                      {status.state.lastError || 'None'}
                    </span>
                  </div>
                </div>
              )}

              {status.config && (
                <div className="mt-6 p-4 bg-black/30 rounded-lg">
                  <p className="text-white font-bold mb-3">⚙️ Configuration:</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Check Interval:</span>
                      <span className="text-white font-bold">{status.config.checkIntervalMinutes} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Unread Only:</span>
                      <span className={status.config.notifyUnreadOnly ? 'text-green-400' : 'text-gray-400'}>
                        {status.config.notifyUnreadOnly ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max per Check:</span>
                      <span className="text-white font-bold">{status.config.maxMessagesPerCheck}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400">Loading status...</p>
          )}
        </div>

        {/* Control Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border-2 border-white/20 p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">🎮 Control Panel</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={triggerCheck}
              disabled={loading || !status?.initialized}
              className="p-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              <span className="text-2xl mb-2 block">🔄</span>
              Trigger Manual Check
            </button>

            <button
              onClick={simulateEmailNotification}
              disabled={loading}
              className="p-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              <span className="text-2xl mb-2 block">🧪</span>
              Simulate Email Notification
            </button>

            <button
              onClick={() => updateConfig(!status?.config?.enabled)}
              disabled={loading || !status?.initialized}
              className={`p-4 ${status?.config?.enabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} disabled:bg-gray-500 text-white font-medium rounded-lg transition-colors`}
            >
              <span className="text-2xl mb-2 block">{status?.config?.enabled ? '🔴' : '🟢'}</span>
              {status?.config?.enabled ? 'Disable' : 'Enable'} Notifications
            </button>
          </div>
        </div>

        {/* Live Notifications Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border-2 border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            📬 Live Email Notifications ({emailNotifications.length})
          </h2>

          {emailNotifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-2">No email notifications received yet</p>
              <p className="text-gray-500 text-sm">
                Try clicking "Trigger Manual Check" or "Simulate Email Notification" above
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-purple-500/20 border-2 border-purple-500/40 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">📧</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-white font-bold">
                          {notification.payload.subject || 'No Subject'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(notification.triggeredAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <p className="text-cyan-400 text-sm mb-2">
                        From: {notification.payload.from || 'Unknown'}
                      </p>
                      <p className="text-gray-300 text-sm line-clamp-2">
                        {notification.payload.snippet || 'No preview available'}
                      </p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-purple-500/30 rounded text-purple-200">
                          ID: {notification.payload.messageId}
                        </span>
                        <span className="px-2 py-1 bg-cyan-500/30 rounded text-cyan-200">
                          Thread: {notification.payload.threadId}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Instructions */}
        <div className="mt-6 bg-black/30 rounded-2xl border-2 border-cyan-500/40 p-6">
          <h3 className="text-xl font-bold text-white mb-4">📋 Testing Instructions</h3>
          <ol className="space-y-2 text-gray-300 list-decimal list-inside">
            <li>Verify system status shows "✅ Initialized" and "🟢 Enabled"</li>
            <li>Click "Trigger Manual Check" to fetch emails from Gmail immediately</li>
            <li>Click "Simulate Email Notification" to test the UI display (creates a fake notification)</li>
            <li>Check that simulated notifications appear in the "Live Email Notifications" section</li>
            <li>Verify toast notifications appear in the top-right corner (purple background with 📧 icon)</li>
            <li>Wait 5 minutes for automatic email checking to occur (watch "Total Checks" increment)</li>
            <li>Open another browser tab and verify notification syncing works</li>
            <li>Test "Disable Notifications" button to stop background checking</li>
            <li>Re-enable and verify checking resumes</li>
          </ol>

          <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500/40 rounded-lg">
            <p className="text-yellow-200 font-bold mb-2">⚠️ Prerequisites:</p>
            <ul className="text-yellow-100 text-sm space-y-1 list-disc list-inside">
              <li>Gmail OAuth credentials configured in <code className="bg-black/50 px-2 py-1 rounded">data/settings.json</code></li>
              <li>Valid refresh token with Gmail API scopes</li>
              <li>Server restarted after configuration</li>
              <li>Network connectivity to Gmail API</li>
            </ul>
          </div>
        </div>

        {/* API Testing Panel */}
        <div className="mt-6 bg-white/10 backdrop-blur-md rounded-2xl border-2 border-white/20 p-6">
          <h3 className="text-xl font-bold text-white mb-4">🔧 API Endpoints</h3>
          <div className="space-y-3 font-mono text-sm">
            <div className="bg-black/50 p-3 rounded">
              <span className="text-green-400 font-bold">GET</span>{' '}
              <span className="text-cyan-400">/api/email-notifications/status</span>
              <p className="text-gray-400 text-xs mt-1">Get email notification system status</p>
            </div>
            <div className="bg-black/50 p-3 rounded">
              <span className="text-yellow-400 font-bold">POST</span>{' '}
              <span className="text-cyan-400">/api/email-notifications/trigger</span>
              <p className="text-gray-400 text-xs mt-1">Manually trigger email check</p>
            </div>
            <div className="bg-black/50 p-3 rounded">
              <span className="text-yellow-400 font-bold">POST</span>{' '}
              <span className="text-cyan-400">/api/email-notifications/config</span>
              <p className="text-gray-400 text-xs mt-1">Update notification configuration</p>
            </div>
            <div className="bg-black/50 p-3 rounded">
              <span className="text-cyan-400 font-bold">SSE</span>{' '}
              <span className="text-cyan-400">/api/notifications/stream</span>
              <p className="text-gray-400 text-xs mt-1">Real-time notification stream (already connected)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
