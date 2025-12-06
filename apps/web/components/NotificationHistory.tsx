'use client';

import React, { useEffect, useState } from 'react';
import type { ScheduledEvent } from '@shared/core';

interface NotificationHistoryResponse {
  ok: boolean;
  notifications: ScheduledEvent[];
  total: number;
  limit: number;
  offset: number;
}

const notificationTypeLabels: Record<string, string> = {
  calendar_reminder: 'Calendar',
  printer_alert: 'Printer',
  camera_alert: 'Camera',
  system_update: 'System',
  integration_error: 'Integration',
  custom: 'Custom'
};

const notificationTypeIcons: Record<string, string> = {
  calendar_reminder: '📅',
  printer_alert: '🖨️',
  camera_alert: '📹',
  system_update: '⚙️',
  integration_error: '⚠️',
  custom: '💬'
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPayloadSummary(payload: Record<string, unknown>): string {
  if (payload.message) return String(payload.message);
  if (payload.text) return String(payload.text);
  if (payload.eventName) return String(payload.eventName);
  if (payload.error) return `Error: ${String(payload.error).substring(0, 50)}`;
  
  const values = Object.values(payload).filter(v => v !== null && v !== undefined);
  if (values.length > 0) return String(values[0]).substring(0, 80);
  
  return 'No details';
}

export function NotificationHistory() {
  const [history, setHistory] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [total, setTotal] = useState(0);

  const loadHistory = async (type?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (type && type !== 'all') {
        params.set('type', type);
      }

      const response = await fetch(`/api/notifications/history?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load notification history');
      }

      const data: NotificationHistoryResponse = await response.json();
      setHistory(data.notifications);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      console.error('[NotificationHistory] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(filterType === 'all' ? undefined : filterType);
  }, [filterType]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="text-center text-white/60">Loading notification history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notification History</h3>
          <p className="text-sm text-white/60">{total} notification{total !== 1 ? 's' : ''} delivered</p>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-white/70">Filter:</label>
          <select
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option className="bg-[#0b0f14]" value="all">All Types</option>
            <option className="bg-[#0b0f14]" value="calendar_reminder">Calendar</option>
            <option className="bg-[#0b0f14]" value="printer_alert">Printer</option>
            <option className="bg-[#0b0f14]" value="camera_alert">Camera</option>
            <option className="bg-[#0b0f14]" value="system_update">System</option>
            <option className="bg-[#0b0f14]" value="integration_error">Integration</option>
          </select>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <div className="text-white/60">No notifications in history</div>
          <div className="text-xs text-white/40 mt-1">
            {filterType !== 'all' ? 'Try changing the filter' : 'Notifications will appear here when triggered'}
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-white/5">
          {history.map((event) => (
            <div key={event.id} className="p-4 hover:bg-white/5 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {notificationTypeIcons[event.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {notificationTypeLabels[event.type] || event.type}
                    </span>
                    <span className="text-xs text-white/40">
                      {event.firedAt ? formatTimestamp(event.firedAt) : 'Unknown time'}
                    </span>
                  </div>
                  <div className="text-sm text-white/70 line-clamp-2">
                    {getPayloadSummary(event.payload)}
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    Scheduled: {new Date(event.triggerAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                    Delivered
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && history.length < total && (
        <div className="text-center">
          <button 
            className="btn btn-secondary text-sm"
            onClick={() => {
              // Pagination can be added here
              console.log('Load more functionality can be implemented');
            }}
          >
            Showing {history.length} of {total}
          </button>
        </div>
      )}
    </div>
  );
}
