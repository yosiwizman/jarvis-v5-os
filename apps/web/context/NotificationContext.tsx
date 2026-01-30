'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Notification } from '@shared/notifications';
import { readSettings } from '@shared/settings';

interface NotificationWithReadState extends Notification {
  read: boolean;
}

interface NotificationContextValue {
  notifications: NotificationWithReadState[];
  unreadCount: number;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  loadHistory: () => Promise<void>;
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
  const [notifications, setNotifications] = useState<NotificationWithReadState[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Dismiss notification by ID
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Clear all notifications (client-side only)
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Load notification history from server
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return; // Only load once

    try {
      const response = await fetch('/api/notifications/history?limit=50&offset=0');
      if (!response.ok) {
        throw new Error('Failed to load notification history');
      }

      const data = await response.json();
      const historyNotifications: NotificationWithReadState[] = (data.notifications || []).map(
        (event: any) => ({
          id: event.id,
          type: event.type,
          payload: event.payload,
          triggeredAt: event.firedAt || event.triggerAt,
          readAt: null,
          read: true // History items are considered "already seen"
        })
      );

      // Merge with existing notifications (avoid duplicates)
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newNotifications = historyNotifications.filter((n) => !existingIds.has(n.id));
        return [...prev, ...newNotifications];
      });

      setHistoryLoaded(true);
      console.log('[NotificationContext] Loaded history:', historyNotifications.length, 'notifications');
    } catch (error) {
      console.error('[NotificationContext] Failed to load history:', error);
    }
  }, [historyLoaded]);

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

  // Connect to SSE stream for real-time notifications with exponential backoff
  useEffect(() => {
    let es: EventSource | null = null;
    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;
    const MAX_RETRY_DELAY = 30000; // 30 seconds max
    const BASE_RETRY_DELAY = 1000; // 1 second base
    
    const connect = () => {
      console.log('[NotificationContext] Connecting to SSE stream...');
      
      es = new EventSource('/api/notifications/stream');

      es.onopen = () => {
        console.log('[NotificationContext] SSE connection established');
        retryCount = 0; // Reset retry count on successful connection
      };

      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          
          // Skip connection/heartbeat messages
          if (notification.type === 'connection' || notification.type === 'heartbeat') {
            if (notification.type === 'connection') {
              console.log('[NotificationContext] SSE connection confirmed');
            }
            return;
          }

          console.log('[NotificationContext] Notification received:', notification.type);

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

          // Add notification to state with unique ID and mark as unread
          setNotifications((prev) => [
            {
              ...notification,
              id: notification.id || `notif-${Date.now()}-${Math.random()}`,
              read: false // New live notifications are unread
            },
            ...prev // Prepend to show newest first
          ]);
        } catch (error) {
          // Silently ignore parse errors for malformed messages
        }
      };

      es.onerror = () => {
        // Close the current connection
        es?.close();
        es = null;
        
        // Calculate exponential backoff delay
        const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
        retryCount++;
        
        console.log(`[NotificationContext] SSE error, reconnecting in ${delay}ms (attempt ${retryCount})`);
        
        // Schedule reconnection
        retryTimeout = setTimeout(connect, delay);
      };

      setEventSource(es);
    };
    
    connect();

    return () => {
      console.log('[NotificationContext] Closing SSE connection');
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        dismissNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        loadHistory,
        scheduleNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
