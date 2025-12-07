/**
 * Notes Storage Module
 * Handles CRUD operations for quick notes with validation
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

// Zod schema for validation
const NoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().max(50)).max(10).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});

export type Note = z.infer<typeof NoteSchema>;

interface NotesData {
  notes: Note[];
  lastUpdated: string;
}

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load notes from file
 */
export async function loadNotes(): Promise<Note[]> {
  try {
    if (!existsSync(NOTES_FILE)) {
      return [];
    }
    const content = await readFile(NOTES_FILE, 'utf-8');
    const data: NotesData = JSON.parse(content);
    return Array.isArray(data.notes) ? data.notes : [];
  } catch (error) {
    console.error('[NotesStore] Failed to load notes:', error);
    return [];
  }
}

/**
 * Save notes to file
 */
async function saveNotes(notes: Note[]): Promise<void> {
  try {
    const data: NotesData = {
      notes,
      lastUpdated: new Date().toISOString()
    };
    await writeFile(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[NotesStore] Failed to save notes:', error);
    throw error;
  }
}

/**
 * Create a new note
 */
export async function createNote(content: string, tags?: string[]): Promise<Note> {
  const notes = await loadNotes();
  
  const note: Note = {
    id: randomUUID(),
    content: content.trim(),
    tags: tags?.map(tag => tag.trim()).filter(tag => tag.length > 0),
    createdAt: new Date().toISOString()
  };
  
  // Validate
  NoteSchema.parse(note);
  
  notes.push(note);
  await saveNotes(notes);
  
  console.log(`[NotesStore] Created note ${note.id}`);
  
  return note;
}

/**
 * Get all notes
 */
export async function getAllNotes(): Promise<Note[]> {
  return loadNotes();
}

/**
 * Get note by ID
 */
export async function getNoteById(id: string): Promise<Note | null> {
  const notes = await loadNotes();
  return notes.find(n => n.id === id) || null;
}

/**
 * Update note
 */
export async function updateNote(id: string, content: string, tags?: string[]): Promise<Note | null> {
  const notes = await loadNotes();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) {
    return null;
  }
  
  notes[index].content = content.trim();
  notes[index].tags = tags?.map(tag => tag.trim()).filter(tag => tag.length > 0);
  notes[index].updatedAt = new Date().toISOString();
  
  // Validate updated note
  NoteSchema.parse(notes[index]);
  
  await saveNotes(notes);
  
  console.log(`[NotesStore] Updated note ${id}`);
  
  return notes[index];
}

/**
 * Delete note
 */
export async function deleteNote(id: string): Promise<boolean> {
  const notes = await loadNotes();
  const filtered = notes.filter(n => n.id !== id);
  
  if (filtered.length === notes.length) {
    return false; // Note not found
  }
  
  await saveNotes(filtered);
  
  console.log(`[NotesStore] Deleted note ${id}`);
  
  return true;
}

/**
 * Delete last note (most recent)
 */
export async function deleteLastNote(): Promise<boolean> {
  const notes = await loadNotes();
  
  if (notes.length === 0) {
    return false;
  }
  
  // Sort by createdAt descending and remove the first (most recent)
  notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastNoteId = notes[0].id;
  
  return deleteNote(lastNoteId);
}
