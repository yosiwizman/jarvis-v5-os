/**
 * Notification & Event Loop Types
 * 
 * Shared types for the internal notification system used across Jarvis V5 OS.
 * Supports scheduled events, real-time delivery, and notification history.
 */

/**
 * Notification delivered to clients
 */
export interface Notification {
  id: string;
  type: string;
  payload: Record<string, any>;
  triggeredAt: string; // ISO 8601 timestamp
  readAt?: string | null; // ISO 8601 timestamp when user marked as read
}

/**
 * Scheduled event stored on server (before firing)
 */
export interface ScheduledEvent {
  id: string;
  type: string;
  payload: Record<string, any>;
  triggerAt: string; // ISO 8601 timestamp when event should fire
  createdAt: string; // ISO 8601 timestamp when event was scheduled
  fired: boolean; // Whether event has been triggered
  firedAt?: string | null; // ISO 8601 timestamp when event was fired
}

/**
 * Request body for scheduling a new notification
 */
export interface ScheduleNotificationRequest {
  type: string;
  payload: Record<string, any>;
  triggerAt: string; // ISO 8601 timestamp
}

/**
 * Response from scheduling endpoint
 */
export interface ScheduleNotificationResponse {
  ok: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Notification types supported by the system
 */
export type NotificationType =
  | 'calendar_reminder'
  | 'email_notification'
  | 'printer_alert'
  | 'camera_alert'
  | 'system_update'
  | 'integration_error'
  | 'custom';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Extended notification with priority (future enhancement)
 */
export interface NotificationWithPriority extends Notification {
  priority: NotificationPriority;
}
