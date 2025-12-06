/**
 * Notification Scheduler
 * 
 * Core notification & event loop subsystem for Jarvis V5 OS.
 * Handles scheduling, storage, and firing of internal notifications.
 * 
 * Features:
 * - Schedule events with ISO timestamps
 * - Persistent storage (JSON file)
 * - Event loop checks every minute for due events
 * - Broadcasts fired events to all connected SSE clients
 */

import { randomUUID } from 'crypto';
import { readFile, writeFile, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import type { ScheduledEvent, Notification } from '@shared/core';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'scheduled-events.json');

/**
 * SSE client connection
 */
interface SSEClient {
  id: string;
  send: (data: string) => void;
}

/**
 * Notification Scheduler Class
 */
export class NotificationScheduler {
  private events: ScheduledEvent[] = [];
  private sseClients: SSEClient[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Initialize scheduler: load events from disk and start event loop
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[NotificationScheduler] Already initialized');
      return;
    }

    console.log('[NotificationScheduler] Initializing...');

    // Load events from disk
    await this.loadEvents();

    // Start event check loop (every minute)
    this.startEventLoop();

    this.initialized = true;
    console.log(`[NotificationScheduler] Initialized with ${this.events.length} scheduled event(s)`);
  }

  /**
   * Load scheduled events from JSON file
   */
  private async loadEvents(): Promise<void> {
    try {
      if (existsSync(EVENTS_FILE)) {
        const content = await readFileAsync(EVENTS_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        if (Array.isArray(data.events)) {
          this.events = data.events;
          console.log(`[NotificationScheduler] Loaded ${this.events.length} event(s) from disk`);
        }
      } else {
        console.log('[NotificationScheduler] No existing events file found');
      }
    } catch (error) {
      console.error('[NotificationScheduler] Failed to load events:', error);
      this.events = [];
    }
  }

  /**
   * Save scheduled events to JSON file
   */
  private async saveEvents(): Promise<void> {
    try {
      const data = {
        events: this.events,
        lastUpdated: new Date().toISOString()
      };
      await writeFileAsync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[NotificationScheduler] Failed to save events:', error);
    }
  }

  /**
   * Schedule a new notification event
   */
  async scheduleEvent(type: string, payload: Record<string, any>, triggerAt: string): Promise<string> {
    const event: ScheduledEvent = {
      id: randomUUID(),
      type,
      payload,
      triggerAt,
      createdAt: new Date().toISOString(),
      fired: false,
      firedAt: null
    };

    this.events.push(event);
    await this.saveEvents();

    console.log(`[NotificationScheduler] Scheduled event ${event.id} (type: ${type}) for ${triggerAt}`);

    return event.id;
  }

  /**
   * Get all scheduled events
   */
  getScheduledEvents(): ScheduledEvent[] {
    return this.events.filter(e => !e.fired);
  }

  /**
   * Get all fired events
   */
  getFiredEvents(): ScheduledEvent[] {
    return this.events.filter(e => e.fired);
  }

  /**
   * Start event loop: check every minute for due events
   */
  private startEventLoop(): void {
    // Check immediately on startup
    this.checkAndFireDueEvents();

    // Then check every 60 seconds
    this.checkInterval = setInterval(() => {
      this.checkAndFireDueEvents();
    }, 60 * 1000);

    console.log('[NotificationScheduler] Event loop started (check every 60s)');
  }

  /**
   * Stop event loop
   */
  stopEventLoop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[NotificationScheduler] Event loop stopped');
    }
  }

  /**
   * Check for events whose triggerAt <= now and fire them
   */
  private async checkAndFireDueEvents(): Promise<void> {
    const now = new Date();
    const dueEvents = this.events.filter(e => !e.fired && new Date(e.triggerAt) <= now);

    if (dueEvents.length === 0) {
      return; // No due events
    }

    console.log(`[NotificationScheduler] Found ${dueEvents.length} due event(s)`);

    for (const event of dueEvents) {
      await this.fireEvent(event);
    }

    // Save updated events to disk
    await this.saveEvents();
  }

  /**
   * Fire an event: mark as fired and broadcast to all SSE clients
   */
  private async fireEvent(event: ScheduledEvent): Promise<void> {
    const firedAt = new Date().toISOString();

    // Mark event as fired
    event.fired = true;
    event.firedAt = firedAt;

    // Create notification payload
    const notification: Notification = {
      id: event.id,
      type: event.type,
      payload: event.payload,
      triggeredAt: firedAt
    };

    console.log(`[NotificationScheduler] Firing event ${event.id} (type: ${event.type})`);

    // Broadcast to all connected SSE clients
    this.broadcastNotification(notification);
  }

  /**
   * Register an SSE client
   */
  registerSSEClient(clientId: string, sendFn: (data: string) => void): void {
    this.sseClients.push({ id: clientId, send: sendFn });
    console.log(`[NotificationScheduler] SSE client registered: ${clientId} (${this.sseClients.length} total)`);
  }

  /**
   * Unregister an SSE client
   */
  unregisterSSEClient(clientId: string): void {
    this.sseClients = this.sseClients.filter(c => c.id !== clientId);
    console.log(`[NotificationScheduler] SSE client unregistered: ${clientId} (${this.sseClients.length} remaining)`);
  }

  /**
   * Broadcast notification to all connected SSE clients
   */
  private broadcastNotification(notification: Notification): void {
    const message = JSON.stringify(notification);

    console.log(`[NotificationScheduler] Broadcasting to ${this.sseClients.length} client(s)`);

    for (const client of this.sseClients) {
      try {
        client.send(`data: ${message}\n\n`);
      } catch (error) {
        console.error(`[NotificationScheduler] Failed to send to client ${client.id}:`, error);
      }
    }
  }

  /**
   * Get scheduler stats
   */
  getStats() {
    return {
      totalEvents: this.events.length,
      scheduledEvents: this.getScheduledEvents().length,
      firedEvents: this.getFiredEvents().length,
      connectedClients: this.sseClients.length
    };
  }
}

// Singleton instance
export const notificationScheduler = new NotificationScheduler();
