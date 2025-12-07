/**
 * Email Notification System
 * 
 * Background service for checking new Gmail messages and triggering notifications.
 * Integrated with the J.A.R.V.I.S. notification scheduler and SSE streaming.
 * 
 * Features:
 * - Periodic email checking (configurable interval, default 5 minutes)
 * - Detects new unread messages
 * - Broadcasts email notifications via SSE
 * - Tracks last checked message to avoid duplicates
 * - Graceful error handling with automatic retry
 * - Configurable filters (sender, subject keywords)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { notificationScheduler } from '../notificationScheduler.js';
import type { GmailClientConfig, GmailMessageSummary } from '../clients/gmailClient.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const EMAIL_STATE_FILE = path.join(DATA_DIR, 'email-notification-state.json');

/**
 * Email notification state (persisted to disk)
 */
interface EmailNotificationState {
  lastCheckedAt: string | null;
  lastMessageId: string | null;
  checkCount: number;
  lastError: string | null;
}

/**
 * Email notification configuration
 */
interface EmailNotificationConfig {
  enabled: boolean;
  checkIntervalMinutes: number; // Default: 5 minutes
  notifyUnreadOnly: boolean; // Only notify for unread messages
  maxMessagesPerCheck: number; // Max messages to check per interval (default: 10)
  filters?: {
    senderWhitelist?: string[]; // Only notify for these senders (email addresses)
    subjectKeywords?: string[]; // Only notify if subject contains these keywords
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EmailNotificationConfig = {
  enabled: true,
  checkIntervalMinutes: 5,
  notifyUnreadOnly: true,
  maxMessagesPerCheck: 10
};

/**
 * Email Notification Checker Class
 */
export class EmailNotificationChecker {
  private config: EmailNotificationConfig;
  private gmailConfig: GmailClientConfig | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private state: EmailNotificationState;
  private isChecking: boolean = false;

  constructor(config?: Partial<EmailNotificationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      lastCheckedAt: null,
      lastMessageId: null,
      checkCount: 0,
      lastError: null
    };
  }

  /**
   * Initialize the email notification checker
   */
  async initialize(gmailConfig: GmailClientConfig): Promise<void> {
    console.log('[EmailNotificationChecker] Initializing...');

    // Ensure data directory exists
    try {
      await mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    this.gmailConfig = gmailConfig;

    // Load state from disk
    await this.loadState();

    // Start background checking if enabled
    if (this.config.enabled) {
      this.start();
    }

    console.log(`[EmailNotificationChecker] Initialized (check interval: ${this.config.checkIntervalMinutes} min)`);
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      if (existsSync(EMAIL_STATE_FILE)) {
        const content = await readFile(EMAIL_STATE_FILE, 'utf-8');
        this.state = JSON.parse(content);
        console.log(`[EmailNotificationChecker] Loaded state: last checked ${this.state.lastCheckedAt}`);
      }
    } catch (error) {
      console.error('[EmailNotificationChecker] Failed to load state:', error);
      // Reset to default state on error
      this.state = {
        lastCheckedAt: null,
        lastMessageId: null,
        checkCount: 0,
        lastError: null
      };
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    try {
      await writeFile(EMAIL_STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (error) {
      console.error('[EmailNotificationChecker] Failed to save state:', error);
    }
  }

  /**
   * Start background email checking
   */
  start(): void {
    if (this.checkInterval) {
      console.log('[EmailNotificationChecker] Already running');
      return;
    }

    console.log('[EmailNotificationChecker] Starting background email checking');

    // Check immediately on start
    this.checkForNewEmails();

    // Then check periodically
    const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
    this.checkInterval = setInterval(() => {
      this.checkForNewEmails();
    }, intervalMs);

    console.log(`[EmailNotificationChecker] Background checker started (every ${this.config.checkIntervalMinutes} min)`);
  }

  /**
   * Stop background email checking
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[EmailNotificationChecker] Background checker stopped');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EmailNotificationConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    // Restart if interval changed or enabled status changed
    if (wasEnabled && this.config.enabled && this.checkInterval) {
      this.stop();
      this.start();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    }

    console.log('[EmailNotificationChecker] Configuration updated');
  }

  /**
   * Check for new emails and trigger notifications
   */
  private async checkForNewEmails(): Promise<void> {
    // Prevent concurrent checks
    if (this.isChecking) {
      console.log('[EmailNotificationChecker] Check already in progress, skipping');
      return;
    }

    if (!this.gmailConfig) {
      console.error('[EmailNotificationChecker] Gmail config not set, cannot check emails');
      return;
    }

    this.isChecking = true;
    const checkStartTime = new Date().toISOString();

    try {
      console.log(`[EmailNotificationChecker] Checking for new emails (check #${this.state.checkCount + 1})`);

      // Import Gmail client
      const { fetchInboxMessages } = await import('../clients/gmailClient.js');

      // Fetch recent inbox messages (optionally filter for unread only)
      const result = await fetchInboxMessages(
        this.gmailConfig,
        {
          maxResults: this.config.maxMessagesPerCheck,
          timeoutMs: 30000,
          labelIds: this.config.notifyUnreadOnly ? ['INBOX', 'UNREAD'] : ['INBOX']
        }
      );

      if (!result.ok || !result.messages) {
        this.state.lastError = result.error || 'unknown_error';
        await this.saveState();
        console.error(`[EmailNotificationChecker] Failed to fetch inbox: ${this.state.lastError}`);
        return;
      }

      const messages = result.messages;
      console.log(`[EmailNotificationChecker] Fetched ${messages.length} message(s)`);

      // Find new messages (messages we haven't seen before)
      const newMessages = this.filterNewMessages(messages);

      if (newMessages.length === 0) {
        console.log('[EmailNotificationChecker] No new messages found');
      } else {
        console.log(`[EmailNotificationChecker] Found ${newMessages.length} new message(s)`);

        // Apply filters if configured
        const filteredMessages = this.applyFilters(newMessages);
        console.log(`[EmailNotificationChecker] ${filteredMessages.length} message(s) passed filters`);

        // Trigger notifications for new messages
        for (const message of filteredMessages) {
          await this.triggerEmailNotification(message);
        }

        // Update last message ID to the most recent message
        if (messages.length > 0) {
          this.state.lastMessageId = messages[0]!.id;
        }
      }

      // Update state
      this.state.lastCheckedAt = checkStartTime;
      this.state.checkCount += 1;
      this.state.lastError = null;
      await this.saveState();

      console.log('[EmailNotificationChecker] Check completed successfully');
    } catch (error) {
      const errorMessage = (error as Error).message || 'unknown_error';
      this.state.lastError = errorMessage;
      await this.saveState();
      console.error('[EmailNotificationChecker] Check failed:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Filter messages to find new ones (not seen in previous check)
   */
  private filterNewMessages(messages: GmailMessageSummary[]): GmailMessageSummary[] {
    if (!this.state.lastMessageId) {
      // First check - consider all messages as new
      return messages;
    }

    // Find messages that come after the last checked message
    const newMessages: GmailMessageSummary[] = [];
    for (const message of messages) {
      if (message.id === this.state.lastMessageId) {
        // Found the last checked message, stop here
        break;
      }
      newMessages.push(message);
    }

    return newMessages;
  }

  /**
   * Apply configured filters (sender whitelist, subject keywords)
   */
  private applyFilters(messages: GmailMessageSummary[]): GmailMessageSummary[] {
    let filtered = messages;

    // Filter by sender whitelist
    if (this.config.filters?.senderWhitelist && this.config.filters.senderWhitelist.length > 0) {
      filtered = filtered.filter(msg => {
        const from = msg.from?.toLowerCase() || '';
        return this.config.filters!.senderWhitelist!.some(sender =>
          from.includes(sender.toLowerCase())
        );
      });
    }

    // Filter by subject keywords
    if (this.config.filters?.subjectKeywords && this.config.filters.subjectKeywords.length > 0) {
      filtered = filtered.filter(msg => {
        const subject = msg.subject?.toLowerCase() || '';
        return this.config.filters!.subjectKeywords!.some(keyword =>
          subject.includes(keyword.toLowerCase())
        );
      });
    }

    return filtered;
  }

  /**
   * Trigger email notification via notification scheduler
   */
  private async triggerEmailNotification(message: GmailMessageSummary): Promise<void> {
    try {
      // Schedule notification to fire immediately
      const triggerAt = new Date().toISOString();

      await notificationScheduler.scheduleEvent(
        'email_notification',
        {
          messageId: message.id,
          threadId: message.threadId,
          subject: message.subject || '(No Subject)',
          from: message.from || 'Unknown Sender',
          date: message.date || triggerAt,
          snippet: message.snippet || ''
        },
        triggerAt
      );

      console.log(`[EmailNotificationChecker] Scheduled email notification for message ${message.id}`);
    } catch (error) {
      console.error(`[EmailNotificationChecker] Failed to schedule notification for message ${message.id}:`, error);
    }
  }

  /**
   * Get current state
   */
  getState(): EmailNotificationState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): EmailNotificationConfig {
    return { ...this.config };
  }

  /**
   * Manual trigger (useful for testing)
   */
  async triggerCheck(): Promise<void> {
    console.log('[EmailNotificationChecker] Manual check triggered');
    await this.checkForNewEmails();
  }
}

// Singleton instance (initialized on server startup)
let emailNotificationChecker: EmailNotificationChecker | null = null;

/**
 * Initialize the email notification system
 */
export async function initializeEmailNotifications(
  gmailConfig: GmailClientConfig,
  config?: Partial<EmailNotificationConfig>
): Promise<void> {
  if (emailNotificationChecker) {
    console.log('[EmailNotifications] Already initialized');
    return;
  }

  emailNotificationChecker = new EmailNotificationChecker(config);
  await emailNotificationChecker.initialize(gmailConfig);
}

/**
 * Get the email notification checker instance
 */
export function getEmailNotificationChecker(): EmailNotificationChecker | null {
  return emailNotificationChecker;
}

/**
 * Stop email notifications
 */
export function stopEmailNotifications(): void {
  if (emailNotificationChecker) {
    emailNotificationChecker.stop();
  }
}
