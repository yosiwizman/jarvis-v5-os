'use client';

import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import type { Notification } from '@shared/core';

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

// Get background color based on notification type
const getNotificationColor = (type: string): string => {
  switch (type) {
    case 'calendar_reminder':
      return 'bg-blue-500/20 border-blue-500/40';
    case 'email_notification':
      return 'bg-purple-500/20 border-purple-500/40';
    case 'printer_alert':
      return 'bg-purple-500/20 border-purple-500/40';
    case 'camera_alert':
      return 'bg-yellow-500/20 border-yellow-500/40';
    case 'system_update':
      return 'bg-cyan-500/20 border-cyan-500/40';
    case 'integration_error':
      return 'bg-red-500/20 border-red-500/40';
    case 'custom':
      return 'bg-green-500/20 border-green-500/40';
    default:
      return 'bg-white/10 border-white/20';
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
  if (payload.message) {
    return String(payload.message);
  }
  if (payload.text) {
    return String(payload.text);
  }
  // Email notifications: show from + subject if available
  if (payload.from && payload.subject) {
    return `From: ${String(payload.from)} - ${String(payload.subject)}`;
  }
  if (payload.eventName) {
    return `${payload.eventName}${payload.location ? ` @ ${payload.location}` : ''}`;
  }
  
  // Fallback: show first meaningful value
  const values = Object.values(payload).filter((v) => v !== null && v !== undefined);
  if (values.length > 0) {
    return String(values[0]);
  }
  
  return 'Notification received';
};

interface NotificationToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function NotificationToastItem({ notification, onDismiss }: NotificationToastItemProps) {
  const colorClass = getNotificationColor(notification.type);
  const title = getNotificationTitle(notification.type);
  const message = formatPayload(notification.payload);

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-2xl border ${colorClass} shadow-lg backdrop-blur-sm animate-slide-in-right`}
      role="alert"
    >
      <div className="flex-shrink-0">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-white/70 mt-1 line-clamp-2">{message}</div>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationToast() {
  const { notifications, dismissNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-6 right-6 z-[100] space-y-3 w-full max-w-sm pointer-events-none">
      <div className="pointer-events-auto space-y-3">
        {notifications.map((notification) => (
          <NotificationToastItem
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </div>
  );
}
