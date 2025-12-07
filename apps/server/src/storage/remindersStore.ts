/**
 * Reminders Storage Module
 * Persistent storage and helpers for reminders
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const DATA_DIR = path.join(process.cwd(), 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

const ReminderSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1).max(500),
  triggerAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  fired: z.boolean().default(false),
  notificationId: z.string().uuid().optional()
});

export type Reminder = z.infer<typeof ReminderSchema>;

interface RemindersData {
  reminders: Reminder[];
  lastUpdated: string;
}

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

async function load(): Promise<RemindersData> {
  try {
    if (!existsSync(REMINDERS_FILE)) {
      return { reminders: [], lastUpdated: new Date().toISOString() };
    }
    const content = await readFile(REMINDERS_FILE, 'utf-8');
    const data = JSON.parse(content) as RemindersData;
    return {
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('[RemindersStore] Failed to load reminders:', error);
    return { reminders: [], lastUpdated: new Date().toISOString() };
  }
}

async function save(data: RemindersData): Promise<void> {
  try {
    data.lastUpdated = new Date().toISOString();
    await writeFile(REMINDERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[RemindersStore] Failed to save reminders:', error);
    throw error;
  }
}

export async function createReminder(message: string, triggerAt: string): Promise<Reminder> {
  const data = await load();
  const reminder: Reminder = {
    id: randomUUID(),
    message: message.trim(),
    triggerAt,
    createdAt: new Date().toISOString(),
    fired: false
  };
  ReminderSchema.parse(reminder);
  data.reminders.push(reminder);
  await save(data);
  console.log(`[RemindersStore] Created reminder ${reminder.id} at ${triggerAt}`);
  return reminder;
}

export async function updateReminderNotificationId(id: string, notificationId: string): Promise<Reminder | null> {
  const data = await load();
  const idx = data.reminders.findIndex(r => r.id === id);
  if (idx === -1) return null;
  data.reminders[idx].notificationId = notificationId;
  await save(data);
  return data.reminders[idx];
}

export async function getAllReminders(): Promise<Reminder[]> {
  const data = await load();
  return data.reminders;
}

export async function deleteReminder(id: string): Promise<boolean> {
  const data = await load();
  const before = data.reminders.length;
  data.reminders = data.reminders.filter(r => r.id !== id);
  if (data.reminders.length === before) return false;
  await save(data);
  console.log(`[RemindersStore] Deleted reminder ${id}`);
  return true;
}
