'use client';

import React, { useEffect } from 'react';
import { useNotifications } from '@/context/NotificationContext';

// Icon mapping for notification types
const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'calendar_reminder':
      return <span className="text-2xl">📅</span>;
    case 'email_notification':
      return <span className="text-2xl">📧</span>;
    case 'printer_alert':
      return <span className="text-2xl">🖨️</span>;
    case 'camera_alert':
      return <span className="text-2xl">📹</span>;
    case 'system_update':
      return <span className="text-2xl">⚙️</span>;
    case 'integration_error':
      return <span className="text-2xl">⚠️</span>;
    case 'custom':
      return <span className="text-2xl">💬</span>;
    default:
      return <span className="text-2xl">🔔</span>;
  }
};

// Format notification title from type
const getNotificationTitle = (type: string): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format payload for display
const formatPayload = (payload: Record<string, unknown>): string => {
  if (payload.message) return String(payload.message);
  if (payload.text) return String(payload.text);
  if (payload.from && payload.subject) {
    return `From: ${String(payload.from)} - ${String(payload.subject)}`;
  }
  if (payload.eventName) {
    return `${payload.eventName}${payload.location ? ` @ ${payload.location}` : ''}`;
  }
  
  const values = Object.values(payload).filter((v) => v !== null && v !== undefined);
  if (values.length > 0) return String(values[0]).substring(0, 100);
  
  return 'Notification received';
};

// Format relative timestamp
const formatTimestamp = (isoString: string): string => {
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
};

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const { notifications, markAsRead, markAllAsRead, clearAll, loadHistory } = useNotifications();

  // Load history when drawer opens for the first time
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Sort notifications by timestamp (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => {
    const aTime = new Date(a.triggeredAt).getTime();
    const bTime = new Date(b.triggeredAt).getTime();
    return bTime - aTime;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[#0b0f14] border-l border-white/10 shadow-2xl z-[100] overflow-hidden flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <h2
            id="notification-drawer-title"
            className="text-lg font-semibold text-white flex items-center gap-2"
          >
            <span className="text-2xl">🔔</span>
            Notifications
            {notifications.length > 0 && (
              <span className="text-sm font-normal text-white/60">
                ({notifications.length})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
            aria-label="Close notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Actions Bar */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-white/5">
            <button
              onClick={markAllAsRead}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors border border-blue-500/30"
            >
              Mark all as read
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto">
          {sortedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <div className="text-white/60 mb-2">No notifications</div>
              <div className="text-xs text-white/40">
                Notifications will appear here when they arrive
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-white/5' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-white/70'}`}>
                          {getNotificationTitle(notification.type)}
                        </span>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" aria-label="Unread" />
                        )}
                      </div>
                      <div className="text-sm text-white/70 mb-2 line-clamp-3">
                        {formatPayload(notification.payload)}
                      </div>
                      <div className="text-xs text-white/40">
                        {formatTimestamp(notification.triggeredAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {sortedNotifications.length > 0 && (
          <div className="p-3 border-t border-white/10 bg-white/5 text-center">
            <div className="text-xs text-white/50">
              Showing {sortedNotifications.length} notification{sortedNotifications.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
