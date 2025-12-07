/**
 * Action Store
 * 
 * Persistent storage for user actions and system events.
 * Tracks notifications, settings changes, function executions, security events, and more.
 */

import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ACTIONS_DIR = path.join(DATA_DIR, 'actions');
const ACTIONS_FILE = path.join(ACTIONS_DIR, 'actions.json');

export type ActionType =
  | 'notification_scheduled'
  | 'notification_delivered'
  | 'notification_dismissed'
  | 'settings_changed'
  | 'reminder_set'
  | 'function_executed'
  | 'security_event'
  | 'camera_motion'
  | 'image_generated'
  | '3d_model_generated'
  | 'navigation'
  | 'file_uploaded'
  | 'integration_connected'
  | 'integration_disconnected';

export interface Action {
  id: string;
  type: ActionType;
  timestamp: string; // ISO 8601
  userId?: string;
  metadata: Record<string, any>;
  source: 'user' | 'system' | 'integration';
  description?: string;
}

export interface ActionQuery {
  type?: ActionType | ActionType[];
  source?: 'user' | 'system' | 'integration';
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ActionResult {
  actions: Action[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Initialize action storage
 */
export async function initActionStore(): Promise<void> {
  try {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(ACTIONS_DIR)) {
      await mkdir(ACTIONS_DIR, { recursive: true });
    }
    if (!existsSync(ACTIONS_FILE)) {
      await writeFile(ACTIONS_FILE, JSON.stringify({ actions: [] }, null, 2), 'utf-8');
    }
    console.log('[ActionStore] Initialized');
  } catch (error) {
    console.error('[ActionStore] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Load all actions from disk
 */
async function loadActions(): Promise<Action[]> {
  try {
    const content = await readFile(ACTIONS_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.actions || [];
  } catch (error) {
    console.error('[ActionStore] Failed to load actions:', error);
    return [];
  }
}

/**
 * Save actions to disk
 */
async function saveActions(actions: Action[]): Promise<void> {
  try {
    // Sort by timestamp descending (most recent first)
    actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Keep only last 10,000 actions to prevent file from growing too large
    const trimmed = actions.slice(0, 10000);
    
    await writeFile(
      ACTIONS_FILE,
      JSON.stringify({ actions: trimmed, lastUpdated: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('[ActionStore] Failed to save actions:', error);
    throw error;
  }
}

/**
 * Record a new action
 */
export async function recordAction(action: Omit<Action, 'id' | 'timestamp'>): Promise<string> {
  try {
    const actions = await loadActions();
    
    const newAction: Action = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...action
    };
    
    actions.unshift(newAction); // Add to beginning (most recent)
    await saveActions(actions);
    
    console.log(`[ActionStore] Recorded ${newAction.type} action: ${newAction.id}`);
    return newAction.id;
  } catch (error) {
    console.error('[ActionStore] Failed to record action:', error);
    throw error;
  }
}

/**
 * Query actions based on filters
 */
export async function queryActions(query: ActionQuery): Promise<ActionResult> {
  try {
    let actions = await loadActions();
    
    // Filter by type
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      actions = actions.filter(a => types.includes(a.type));
    }
    
    // Filter by source
    if (query.source) {
      actions = actions.filter(a => a.source === query.source);
    }
    
    // Filter by userId
    if (query.userId) {
      actions = actions.filter(a => a.userId === query.userId);
    }
    
    // Filter by date range
    if (query.startDate) {
      const startTime = new Date(query.startDate).getTime();
      actions = actions.filter(a => new Date(a.timestamp).getTime() >= startTime);
    }
    if (query.endDate) {
      const endTime = new Date(query.endDate).getTime();
      actions = actions.filter(a => new Date(a.timestamp).getTime() <= endTime);
    }
    
    const total = actions.length;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const filtered = actions.slice(offset, offset + limit);
    
    return {
      actions: filtered,
      total,
      limit,
      offset
    };
  } catch (error) {
    console.error('[ActionStore] Failed to query actions:', error);
    return { actions: [], total: 0, limit: query.limit || 50, offset: query.offset || 0 };
  }
}

/**
 * Get action by ID
 */
export async function getAction(id: string): Promise<Action | null> {
  try {
    const actions = await loadActions();
    return actions.find(a => a.id === id) || null;
  } catch (error) {
    console.error(`[ActionStore] Failed to get action ${id}:`, error);
    return null;
  }
}

/**
 * Delete actions older than specified days
 */
export async function cleanupOldActions(days: number): Promise<number> {
  try {
    const actions = await loadActions();
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const beforeCount = actions.length;
    const filtered = actions.filter(a => new Date(a.timestamp).getTime() >= cutoffTime);
    
    await saveActions(filtered);
    
    const deleted = beforeCount - filtered.length;
    console.log(`[ActionStore] Cleaned up ${deleted} actions older than ${days} days`);
    return deleted;
  } catch (error) {
    console.error('[ActionStore] Failed to cleanup actions:', error);
    return 0;
  }
}

/**
 * Get action statistics
 */
export async function getActionStats(): Promise<{
  totalActions: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  recentActivity: { date: string; count: number }[];
  topActions: { type: string; count: number }[];
}> {
  try {
    const actions = await loadActions();
    const totalActions = actions.length;
    
    // Count by type
    const byType: Record<string, number> = {};
    for (const action of actions) {
      byType[action.type] = (byType[action.type] || 0) + 1;
    }
    
    // Count by source
    const bySource: Record<string, number> = {};
    for (const action of actions) {
      bySource[action.source] = (bySource[action.source] || 0) + 1;
    }
    
    // Recent activity (last 7 days)
    const recentActivity: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = actions.filter(a => {
        const actionDate = a.timestamp.split('T')[0];
        return actionDate === dateStr;
      }).length;
      
      recentActivity.push({ date: dateStr, count });
    }
    
    // Top 10 action types
    const topActions = Object.entries(byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalActions,
      byType,
      bySource,
      recentActivity,
      topActions
    };
  } catch (error) {
    console.error('[ActionStore] Failed to get stats:', error);
    return {
      totalActions: 0,
      byType: {},
      bySource: {},
      recentActivity: [],
      topActions: []
    };
  }
}

/**
 * Helper functions for common action types
 */

export async function recordNotificationScheduled(notificationId: string, type: string, triggerAt: string, payload: any): Promise<string> {
  return recordAction({
    type: 'notification_scheduled',
    source: 'system',
    metadata: {
      notificationId,
      notificationType: type,
      triggerAt,
      payload
    },
    description: `Scheduled ${type} notification for ${new Date(triggerAt).toLocaleString()}`
  });
}

export async function recordNotificationDelivered(notificationId: string, type: string): Promise<string> {
  return recordAction({
    type: 'notification_delivered',
    source: 'system',
    metadata: {
      notificationId,
      notificationType: type
    },
    description: `Delivered ${type} notification`
  });
}

export async function recordFunctionExecuted(functionName: string, args: any, result: any, durationMs?: number): Promise<string> {
  return recordAction({
    type: 'function_executed',
    source: 'user',
    metadata: {
      functionName,
      arguments: args,
      result,
      durationMs
    },
    description: `Executed function: ${functionName}`
  });
}

export async function recordSettingsChanged(section: string, changes: Record<string, any>): Promise<string> {
  return recordAction({
    type: 'settings_changed',
    source: 'user',
    metadata: {
      section,
      changes
    },
    description: `Changed ${section} settings`
  });
}

export async function recordSecurityEvent(eventType: string, deviceId: string, details: any): Promise<string> {
  return recordAction({
    type: 'security_event',
    source: 'system',
    metadata: {
      eventType,
      deviceId,
      details
    },
    description: `Security event: ${eventType} on ${deviceId}`
  });
}

export async function recordImageGenerated(prompt: string, modelUrl?: string): Promise<string> {
  return recordAction({
    type: 'image_generated',
    source: 'user',
    metadata: {
      prompt,
      modelUrl
    },
    description: `Generated image: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`
  });
}

export async function record3DModelGenerated(jobId: string, source: string, outputs: any): Promise<string> {
  return recordAction({
    type: '3d_model_generated',
    source: 'user',
    metadata: {
      jobId,
      modelSource: source,
      outputs
    },
    description: `Generated 3D model from ${source}`
  });
}
