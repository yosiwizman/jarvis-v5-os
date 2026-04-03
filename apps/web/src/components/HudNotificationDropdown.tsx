'use client';

import React, { useEffect } from 'react';
import { useNotifications } from '@/context/NotificationContext';

// Icon mapping for notification types
const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'calendar_reminder':
      return <span className="text-xl">📅</span>;
    case 'email_notification':
      return <span className="text-xl">📧</span>;
    case 'printer_alert':
      return <span className="text-xl">🖨️</span>;
    case 'camera_alert':
      return <span className="text-xl">📹</span>;
    case 'system_update':
      return <span className="text-xl">⚙️</span>;
    case 'integration_error':
      return <span className="text-xl">⚠️</span>;
    case 'custom':
      return <span className="text-xl">💬</span>;
    default:
      return <span className="text-xl">🔔</span>;
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

interface HudNotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HudNotificationDropdown({ isOpen, onClose }: HudNotificationDropdownProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  // Close dropdown on Escape key
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking within the dropdown or the HUD widget bell button
      if (isOpen && !target.closest('[data-hud-notification-dropdown]') && !target.closest('[data-hud-notification-bell]')) {
        onClose();
      }
    };

    if (isOpen) {
      // Use timeout to avoid immediate closure on same click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <div
      data-hud-notification-dropdown
      className="absolute top-full right-0 mt-2 w-[360px] bg-[rgba(var(--akior-panel-surface),0.4)] backdrop-blur-xl border border-[rgba(var(--akior-accent),0.3)] rounded-2xl shadow-lg overflow-hidden z-[80]"
      role="dialog"
      aria-label="Notifications"
      style={{
        boxShadow: '0 0 24px rgba(var(--akior-glow), 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(var(--akior-accent), 0.2)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <span 
            className="text-sm font-semibold"
            style={{ color: 'rgba(var(--akior-accent), 0.9)' }}
          >
            Notifications
          </span>
        </div>
        <span 
          className="text-xs"
          style={{ color: 'rgba(var(--akior-accent), 0.6)' }}
        >
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </span>
      </div>

      {/* Notification List */}
      <div className="max-h-[400px] overflow-y-auto py-1">
        {sortedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="text-4xl mb-2">🔔</div>
            <div 
              className="text-sm mb-1"
              style={{ color: 'rgba(var(--akior-accent), 0.7)' }}
            >
              No notifications
            </div>
            <div 
              className="text-xs"
              style={{ color: 'rgba(var(--akior-accent), 0.5)' }}
            >
              Notifications will appear here
            </div>
          </div>
        ) : (
          <div>
            {sortedNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => !notification.read && markAsRead(notification.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-[rgba(var(--akior-accent),0.05)]"
                style={{
                  backgroundColor: !notification.read ? 'rgba(var(--akior-accent), 0.08)' : 'transparent',
                  opacity: notification.read ? 0.7 : 1
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="text-sm font-medium"
                      style={{ color: !notification.read ? 'rgba(var(--akior-accent), 1)' : 'rgba(var(--akior-accent), 0.7)' }}
                    >
                      {getNotificationTitle(notification.type)}
                    </span>
                    {!notification.read && (
                      <span 
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(var(--akior-glow), 0.9)',
                          boxShadow: '0 0 8px rgba(var(--akior-glow), 0.6)'
                        }}
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <div 
                    className="text-xs mb-1 line-clamp-2"
                    style={{ color: 'rgba(var(--akior-accent), 0.7)' }}
                  >
                    {formatPayload(notification.payload)}
                  </div>
                  <div 
                    className="text-xs"
                    style={{ color: 'rgba(var(--akior-accent), 0.5)' }}
                  >
                    {formatTimestamp(notification.triggeredAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      {sortedNotifications.length > 0 && (
        <div 
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: 'rgba(var(--akior-accent), 0.2)' }}
        >
          <button
            onClick={markAllAsRead}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-[rgba(var(--akior-accent),0.15)]"
            style={{ 
              color: 'rgba(var(--akior-accent), 0.8)',
              border: '1px solid rgba(var(--akior-accent), 0.2)'
            }}
          >
            Mark all read
          </button>
          <button
            onClick={clearAll}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/20"
            style={{ 
              color: 'rgba(239, 68, 68, 0.8)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
