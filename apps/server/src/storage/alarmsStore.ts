/**
 * Alarms Storage Module
 * Handles time-based, motion-based, and event-based alarms
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const DATA_DIR = path.join(process.cwd(), 'data');
const ALARMS_FILE = path.join(DATA_DIR, 'alarms.json');

const AlarmSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(['time', 'motion', 'event']),
  enabled: z.boolean(),
  // Time-based fields
  triggerTime: z.string().optional(),
  recurring: z.boolean().optional(),
  recurrencePattern: z.string().optional(),
  // Motion-based fields
  cameraId: z.string().optional(),
  location: z.string().optional(),
  // Event-based fields (future)
  eventType: z.string().optional(),
  eventCondition: z.record(z.any()).optional(),
  // Metadata
  createdAt: z.string().datetime(),
  lastTriggered: z.string().datetime().optional()
});

export type Alarm = z.infer<typeof AlarmSchema>;

interface AlarmsData {
  alarms: Alarm[];
  lastUpdated: string;
}

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

async function load(): Promise<AlarmsData> {
  try {
    if (!existsSync(ALARMS_FILE)) {
      return { alarms: [], lastUpdated: new Date().toISOString() };
    }
    const content = await readFile(ALARMS_FILE, 'utf-8');
    const data = JSON.parse(content) as AlarmsData;
    return {
      alarms: Array.isArray(data.alarms) ? data.alarms : [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('[AlarmsStore] Failed to load alarms:', error);
    return { alarms: [], lastUpdated: new Date().toISOString() };
  }
}

async function save(data: AlarmsData): Promise<void> {
  try {
    data.lastUpdated = new Date().toISOString();
    await writeFile(ALARMS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[AlarmsStore] Failed to save alarms:', error);
    throw error;
  }
}

export async function createAlarm(params: Omit<Alarm, 'id' | 'createdAt'>): Promise<Alarm> {
  const data = await load();
  const alarm: Alarm = {
    id: randomUUID(),
    ...params,
    createdAt: new Date().toISOString()
  };
  AlarmSchema.parse(alarm);
  data.alarms.push(alarm);
  await save(data);
  console.log(`[AlarmsStore] Created ${alarm.type} alarm ${alarm.id}: ${alarm.name}`);
  return alarm;
}

export async function getAllAlarms(): Promise<Alarm[]> {
  const data = await load();
  return data.alarms;
}

export async function toggleAlarm(id: string): Promise<Alarm | null> {
  const data = await load();
  const idx = data.alarms.findIndex(a => a.id === id);
  if (idx === -1) return null;
  data.alarms[idx].enabled = !data.alarms[idx].enabled;
  await save(data);
  console.log(`[AlarmsStore] Toggled alarm ${id} to ${data.alarms[idx].enabled ? 'enabled' : 'disabled'}`);
  return data.alarms[idx];
}

export async function updateAlarmLastTriggered(id: string): Promise<Alarm | null> {
  const data = await load();
  const idx = data.alarms.findIndex(a => a.id === id);
  if (idx === -1) return null;
  data.alarms[idx].lastTriggered = new Date().toISOString();
  await save(data);
  return data.alarms[idx];
}

export async function deleteAlarm(id: string): Promise<boolean> {
  const data = await load();
  const before = data.alarms.length;
  data.alarms = data.alarms.filter(a => a.id !== id);
  if (data.alarms.length === before) return false;
  await save(data);
  console.log(`[AlarmsStore] Deleted alarm ${id}`);
  return true;
}

export async function getActiveMotionAlarms(cameraId?: string, location?: string): Promise<Alarm[]> {
  const data = await load();
  return data.alarms.filter(a => {
    if (!a.enabled || a.type !== 'motion') return false;
    if (cameraId && a.cameraId && a.cameraId !== cameraId) return false;
    if (location && a.location && a.location.toLowerCase() !== location.toLowerCase()) return false;
    return true;
  });
}
