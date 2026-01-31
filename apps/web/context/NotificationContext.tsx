'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import type { Notification } from '@shared/notifications';
import { readSettings } from '@shared/settings';

interface NotificationWithReadState extends Notification {
  read: boolean;
}

/** SSE connection health state for monitoring/debugging */
export interface SSEHealthState {
  status: 'connecting' | 'connected' | 'degraded' | 'disconnected';
  lastMessageAt: Date | null;
  lastHeartbeatAt: Date | null;
  consecutiveFailures: number;
  retryCount: number;
}

interface NotificationContextValue {
  notifications: NotificationWithReadState[];
  unreadCount: number;
  sseHealth: SSEHealthState;
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

const initialSSEHealth: SSEHealthState = {
  status: 'connecting',
  lastMessageAt: null,
  lastHeartbeatAt: null,
  consecutiveFailures: 0,
  retryCount: 0
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationWithReadState[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sseHealth, setSSEHealth] = useState<SSEHealthState>(initialSSEHealth);
  
  // Use ref to track retry state without causing re-renders
  const retryStateRef = useRef({ count: 0, timeout: null as NodeJS.Timeout | null });

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
    const MAX_RETRY_DELAY = 30000; // 30 seconds max
    const BASE_RETRY_DELAY = 1000; // 1 second base
    
    const updateHealth = (updates: Partial<SSEHealthState>) => {
      setSSEHealth((prev) => ({ ...prev, ...updates }));
    };
    
    const connect = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[NotificationContext] Connecting to SSE stream...');
      }
      
      updateHealth({ status: 'connecting' });
      
      es = new EventSource('/api/notifications/stream');

      es.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[NotificationContext] SSE connection established');
        }
        // Reset retry count on successful connection
        retryStateRef.current.count = 0;
        updateHealth({ 
          status: 'connected', 
          consecutiveFailures: 0,
          retryCount: 0
        });
      };

      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          const now = new Date();
          
          // Update health on any message (connection is alive)
          updateHealth({ lastMessageAt: now });
          
          // Reset retry count on successful message (connection is healthy)
          retryStateRef.current.count = 0;
          
          // Handle connection/heartbeat messages - update health but don't add to notifications
          if (notification.type === 'connection') {
            if (process.env.NODE_ENV === 'development') {
              console.log('[NotificationContext] SSE connection confirmed');
            }
            updateHealth({ status: 'connected', consecutiveFailures: 0 });
            return;
          }
          
          if (notification.type === 'heartbeat') {
            // Heartbeat received - connection is healthy, reset backoff
            updateHealth({ lastHeartbeatAt: now, status: 'connected', consecutiveFailures: 0 });
            return;
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('[NotificationContext] Notification received:', notification.type);
          }

          // Check user preferences
          const settings = readSettings();
          const preferences = settings?.notificationPreferences;
          
          // Filter based on user preferences (default to true if preference not set)
          const preferenceKey = notification.type as keyof typeof preferences;
          const isEnabled = preferences?.[preferenceKey] !== false;
          
          if (!isEnabled) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[NotificationContext] Notification filtered by preferences: ${notification.type}`);
            }
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
        } catch {
          // Silently ignore parse errors for malformed messages
        }
      };

      es.onerror = () => {
        // Close the current connection
        es?.close();
        es = null;
        
        // Calculate exponential backoff delay
        const retryCount = retryStateRef.current.count;
        const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
        retryStateRef.current.count = retryCount + 1;
        
        // Update health state
        const newFailures = retryCount + 1;
        updateHealth({ 
          status: newFailures >= 3 ? 'degraded' : 'connecting',
          consecutiveFailures: newFailures,
          retryCount: retryCount + 1
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[NotificationContext] SSE error, reconnecting in ${delay}ms (attempt ${retryCount + 1})`);
        }
        
        // Schedule reconnection
        retryStateRef.current.timeout = setTimeout(connect, delay);
      };

      setEventSource(es);
    };
    
    connect();

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[NotificationContext] Closing SSE connection');
      }
      if (retryStateRef.current.timeout) {
        clearTimeout(retryStateRef.current.timeout);
      }
      updateHealth({ status: 'disconnected' });
      es?.close();
    };
  }, []);

  // Expose debug info in development via window object
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      (window as any).__notifDebug = {
        getHealth: () => sseHealth,
        getNotifications: () => notifications
      };
    }
  }, [sseHealth, notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        sseHealth,
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
