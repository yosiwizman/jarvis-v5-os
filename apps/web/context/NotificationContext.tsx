'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Notification } from '@shared/core';
import { readSettings } from '@shared/settings';

interface NotificationContextValue {
  notifications: Notification[];
  dismissNotification: (id: string) => void;
  scheduleNotification: (type: string, payload: Record<string, unknown>, triggerAt: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Dismiss notification by ID
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  // Schedule a notification via API
  const scheduleNotification = useCallback(
    async (type: string, payload: Record<string, unknown>, triggerAt: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/notifications/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload, triggerAt })
        });

        const data = await response.json();
        return response.ok && data.ok === true;
      } catch (error) {
        console.error('[NotificationContext] Failed to schedule notification:', error);
        return false;
      }
    },
    []
  );

  // Auto-dismiss notifications after 10 seconds
  useEffect(() => {
    if (notifications.length === 0) return;

    const timers = notifications.map((notification) => {
      return setTimeout(() => {
        dismissNotification(notification.id);
      }, 10_000); // 10 seconds
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [notifications, dismissNotification]);

  // Connect to SSE stream for real-time notifications
  useEffect(() => {
    console.log('[NotificationContext] Connecting to SSE stream...');

    const es = new EventSource('/api/notifications/stream');

    es.onopen = () => {
      console.log('[NotificationContext] SSE connection established');
    };

    es.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        
        // Skip connection confirmation messages
        if (notification.type === 'connection') {
          console.log('[NotificationContext] SSE connection confirmed:', notification.payload);
          return;
        }

        console.log('[NotificationContext] Notification received:', notification);

        // Check user preferences
        const settings = readSettings();
        const preferences = settings?.notificationPreferences;
        
        // Filter based on user preferences (default to true if preference not set)
        const preferenceKey = notification.type as keyof typeof preferences;
        const isEnabled = preferences?.[preferenceKey] !== false;
        
        if (!isEnabled) {
          console.log(`[NotificationContext] Notification filtered by preferences: ${notification.type}`);
          return;
        }

        // Add notification to state with unique ID
        setNotifications((prev) => [
          ...prev,
          {
            ...notification,
            id: notification.id || `notif-${Date.now()}-${Math.random()}`
          }
        ]);
      } catch (error) {
        console.error('[NotificationContext] Failed to parse notification:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[NotificationContext] SSE connection error:', error);
      // EventSource will automatically attempt reconnection
    };

    setEventSource(es);

    return () => {
      console.log('[NotificationContext] Closing SSE connection');
      es.close();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, dismissNotification, scheduleNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}
