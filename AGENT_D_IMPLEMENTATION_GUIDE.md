# Agent D: Weather Updates, Quick Notes, Reminders, and Smart Alarms
## Implementation Guide for AKIOR V6.1.0

---

## Overview

This guide provides a comprehensive implementation plan for adding voice-activated weather updates, quick note-taking, contextual reminders, and smart alarms to the AKIOR system. All features integrate seamlessly with the existing OpenAI Realtime API function calling architecture.

**Version**: 6.1.0  
**Branch**: `feature/v6.1-voice-features`  
**Estimated Implementation Time**: 3-5 days

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Feature Specifications](#feature-specifications)
3. [Implementation Tasks](#implementation-tasks)
4. [File Structure](#file-structure)
5. [API Endpoints](#api-endpoints)
6. [Voice Function Definitions](#voice-function-definitions)
7. [Data Models](#data-models)
8. [Testing Strategy](#testing-strategy)
9. [Security Considerations](#security-considerations)

---

## Architecture Overview

### System Integration Points

```
┌─────────────────────────────────────────────────────┐
│              User Voice Command                      │
│         "AKIOR, take a note..."              │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         OpenAI Realtime API (Function Calling)       │
│  - Processes natural language                        │
│  - Extracts parameters                               │
│  - Calls appropriate function                        │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│       Frontend Function Executor (Next.js)           │
│  apps/web/src/lib/akior-function-executor.ts       │
│  - Routes function calls to backend                  │
│  - Handles responses                                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         Backend API Endpoints (Fastify)              │
│  apps/server/src/index.ts                           │
│  - Weather: GET /api/integrations/weather/query     │
│  - Notes: CRUD /api/notes                           │
│  - Reminders: CRUD /api/reminders                   │
│  - Alarms: CRUD /api/alarms                         │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│           Data Storage & Integrations                │
│  - JSON Files: notes.json, reminders.json, etc.     │
│  - Notification Scheduler (existing)                 │
│  - Camera Motion Detection (existing)                │
│  - Weather API (existing)                            │
└─────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Leverage Existing Systems**: Reuse notification scheduler, camera integration, and weather API
2. **Consistent Architecture**: Follow existing patterns for storage, endpoints, and function calling
3. **Voice-First Design**: All features accessible through natural language voice commands
4. **Data Persistence**: JSON file storage in `apps/server/data/` directory
5. **Graceful Degradation**: Features work with or without voice feedback enabled

---

## Feature Specifications

### 1. Voice-Activated Weather Updates

**User Stories:**
- "What's the weather like today?"
- "How hot is it in Miami?"
- "Will it rain tomorrow?" (future enhancement)

**Requirements:**
- Leverage existing OpenWeather API integration
- Support location-based queries
- Return formatted weather data (temperature, condition, humidity, wind)
- Voice response option for weather information

**Implementation:**
- New function: `get_weather`
- New endpoint: `POST /api/integrations/weather/query`
- Voice feedback with current conditions

---

### 2. Quick Note-Taking

**User Stories:**
- "AKIOR, take a note: Buy milk tomorrow"
- "Show my notes"
- "Delete my last note"
- "Edit note 3 to say: Call dentist at 2 PM"

**Requirements:**
- Create, read, update, delete notes via voice
- Store notes with timestamps
- Support optional tags/categories
- List notes chronologically or by tag
- Content validation and sanitization

**Implementation:**
- Functions: `create_note`, `list_notes`, `delete_note`, `edit_note`
- Endpoints: POST/GET/PUT/DELETE `/api/notes`
- Storage: `apps/server/data/notes.json`

**Data Model:**
```typescript
interface Note {
  id: string;
  content: string;
  tags?: string[];
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}
```

---

### 3. Contextual Reminders

**User Stories:**
- "Remind me to take out the trash at 6 PM"
- "Set a reminder for tomorrow at 9 AM to call Mom"
- "Show my reminders"
- "Cancel the trash reminder"

**Requirements:**
- Natural language time parsing
- Integration with existing notification scheduler
- Persistent storage across server restarts
- Support for absolute and relative times
- Notification delivery via SSE

**Implementation:**
- Functions: `set_reminder`, `list_reminders`, `cancel_reminder`
- Endpoints: POST/GET/DELETE `/api/reminders`
- Integration: `notificationScheduler.scheduleEvent()`
- Time Parser: `apps/web/src/lib/time-parser.ts`

**Data Model:**
```typescript
interface Reminder {
  id: string;
  message: string;
  triggerAt: string; // ISO 8601
  createdAt: string; // ISO 8601
  notificationId?: string; // Reference to scheduled notification
  fired: boolean;
}
```

---

### 4. Smart Alarm System

**User Stories:**
- "Set an alarm for 7 AM"
- "Alert me if there's motion in the backyard"
- "Wake me up at 6:30 tomorrow"
- "Show my alarms"
- "Turn off the motion alarm"

**Requirements:**
- Time-based alarms (single or recurring)
- Motion-based alarms (camera integration)
- Event-based triggers (future: low battery, temperature threshold)
- Enable/disable without deleting
- Location-based filtering for camera alarms

**Implementation:**
- Functions: `set_alarm`, `list_alarms`, `toggle_alarm`, `delete_alarm`
- Endpoints: POST/GET/PUT/DELETE `/api/alarms`
- Integration: Camera motion detection hook
- Storage: `apps/server/data/alarms.json`

**Data Model:**
```typescript
interface Alarm {
  id: string;
  name: string;
  type: 'time' | 'motion' | 'event';
  enabled: boolean;
  
  // For time-based alarms
  triggerTime?: string; // ISO 8601 or time-only (HH:mm)
  recurring?: boolean;
  recurrencePattern?: string; // e.g., "daily", "weekdays", "Mon,Wed,Fri"
  
  // For motion-based alarms
  cameraId?: string;
  location?: string; // e.g., "backyard", "front door"
  
  // For event-based alarms (future)
  eventType?: string;
  eventCondition?: Record<string, any>;
  
  createdAt: string; // ISO 8601
  lastTriggered?: string; // ISO 8601
}
```

---

### 5. Voice Feedback System

**User Stories:**
- Hear confirmation: "I've taken a note: Buy milk tomorrow"
- Hear weather updates: "It's currently 75 degrees and sunny in Miami"
- Hear reminder confirmations: "Reminder set for 6 PM to take out the trash"

**Requirements:**
- Support multiple TTS providers
- User-selectable provider in settings
- Fallback between providers
- Disable option (text-only responses)

**Supported Providers:**
1. OpenAI Realtime API (real-time voice)
2. ElevenLabs (high-quality TTS)
3. Azure TTS (enterprise TTS)
4. None (text-only)

**Implementation:**
- Module: `apps/web/src/lib/voice-feedback.ts`
- Settings: Add `voiceFeedbackProvider` to AppSettings
- UI: Settings page dropdown for provider selection

---

## Implementation Tasks

### Task 1: Set Up Data Storage Infrastructure

**Files to Create:**
- `apps/server/data/notes.json`
- `apps/server/data/reminders.json`
- `apps/server/data/alarms.json`
- `apps/server/src/storage/notesStore.ts`
- `apps/server/src/storage/remindersStore.ts`
- `apps/server/src/storage/alarmsStore.ts`

**Implementation Steps:**

1. **Create Initial JSON Files**
   ```json
   {
     "notes": [],
     "lastUpdated": "2025-12-06T16:00:00.000Z"
   }
   ```

2. **Create Storage Helper Pattern** (Example: `notesStore.ts`)
   ```typescript
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
     tags: z.array(z.string()).optional(),
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
   
   // Load notes from file
   export async function loadNotes(): Promise<Note[]> {
     try {
       if (!existsSync(NOTES_FILE)) {
         return [];
       }
       const content = await readFile(NOTES_FILE, 'utf-8');
       const data: NotesData = JSON.parse(content);
       return data.notes;
     } catch (error) {
       console.error('[NotesStore] Failed to load notes:', error);
       return [];
     }
   }
   
   // Save notes to file
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
   
   // Create a new note
   export async function createNote(content: string, tags?: string[]): Promise<Note> {
     const notes = await loadNotes();
     
     const note: Note = {
       id: randomUUID(),
       content: content.trim(),
       tags,
       createdAt: new Date().toISOString()
     };
     
     // Validate
     NoteSchema.parse(note);
     
     notes.push(note);
     await saveNotes(notes);
     
     return note;
   }
   
   // Get all notes
   export async function getAllNotes(): Promise<Note[]> {
     return loadNotes();
   }
   
   // Get note by ID
   export async function getNoteById(id: string): Promise<Note | null> {
     const notes = await loadNotes();
     return notes.find(n => n.id === id) || null;
   }
   
   // Update note
   export async function updateNote(id: string, content: string, tags?: string[]): Promise<Note | null> {
     const notes = await loadNotes();
     const index = notes.findIndex(n => n.id === id);
     
     if (index === -1) {
       return null;
     }
     
     notes[index].content = content.trim();
     notes[index].tags = tags;
     notes[index].updatedAt = new Date().toISOString();
     
     await saveNotes(notes);
     return notes[index];
   }
   
   // Delete note
   export async function deleteNote(id: string): Promise<boolean> {
     const notes = await loadNotes();
     const filtered = notes.filter(n => n.id !== id);
     
     if (filtered.length === notes.length) {
       return false; // Note not found
     }
     
     await saveNotes(filtered);
     return true;
   }
   ```

3. **Repeat Pattern for `remindersStore.ts` and `alarmsStore.ts`**

**Testing:**
- Unit tests for each CRUD operation
- Test concurrent access scenarios
- Test file corruption recovery

---

### Task 2: Implement Voice-Activated Weather Updates

**Files to Modify:**
- `apps/web/src/lib/akior-functions.ts`
- `apps/web/src/lib/akior-function-executor.ts`
- `apps/server/src/index.ts`

**Implementation Steps:**

1. **Add Function Definition** (`akior-functions.ts`)
   ```typescript
   {
     name: 'get_weather',
     description: 'Get current weather information for a specific location. Use this when the user asks about weather, temperature, or weather conditions.',
     parameters: {
       type: 'object',
       properties: {
         location: {
           type: 'string',
           description: 'Location to get weather for (e.g., "Miami", "London,GB", "Tokyo,JP"). If not specified, uses user\'s default location.'
         }
       },
       required: [],
       additionalProperties: false
     },
     strict: true,
     handler: async (args) => {
       return { success: true, message: 'Getting weather...', data: args };
     }
   }
   ```

2. **Add Backend Endpoint** (`apps/server/src/index.ts`)
   ```typescript
   // Voice-activated weather query endpoint
   fastify.post('/api/integrations/weather/query', async (req, reply) => {
     const body = req.body as { location?: string };
     
     // Load settings for default location
     let settings: any = null;
     try {
       if (existsSync(SETTINGS_FILE)) {
         const content = await readFile(SETTINGS_FILE, 'utf-8');
         settings = JSON.parse(content);
       }
     } catch (error) {
       fastify.log.error({ error }, 'Failed to load settings for weather query');
       return reply.status(500).send({ ok: false, error: 'failed_to_load_settings' });
     }
     
     const location = body.location || settings?.integrations?.weather?.location || 'Miami,US';
     
     // Call existing weather endpoint logic
     const apiKey = process.env.OPENWEATHER_API_KEY;
     
     if (!apiKey) {
       return reply.status(503).send({ ok: false, error: 'weather_api_key_not_configured' });
     }
     
     try {
       const response = await fetch(
         `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
       );
       
       if (!response.ok) {
         throw new Error(`Weather API returned ${response.status}`);
       }
       
       const data = await response.json();
       
       // Format response
       const weatherData = {
         location: `${data.name}, ${data.sys.country}`,
         temperatureC: Math.round(data.main.temp),
         temperatureF: Math.round((data.main.temp * 9/5) + 32),
         condition: data.weather[0]?.main || 'Unknown',
         description: data.weather[0]?.description || '',
         humidity: data.main.humidity,
         windKph: Math.round(data.wind.speed * 3.6),
         iconCode: data.weather[0]?.icon,
         updatedAt: new Date().toISOString()
       };
       
       return reply.send({ ok: true, data: weatherData });
     } catch (error) {
       fastify.log.error({ error, location }, 'Failed to fetch weather');
       return reply.status(502).send({ ok: false, error: 'weather_api_request_failed' });
     }
   });
   ```

3. **Implement Handler** (`akior-function-executor.ts`)
   ```typescript
   case 'get_weather': {
     const response = await fetch('/api/integrations/weather/query', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ location: args.location })
     });
     
     if (!response.ok) {
       return {
         success: false,
         message: 'Failed to retrieve weather information'
       };
     }
     
     const result = await response.json();
     const weather = result.data;
     
     const message = `The weather in ${weather.location} is currently ${weather.temperatureC}°C (${weather.temperatureF}°F) and ${weather.condition.toLowerCase()}. Humidity is ${weather.humidity}% with winds at ${weather.windKph} km/h.`;
     
     return {
       success: true,
       message,
       data: weather
     };
   }
   ```

---

### Task 3: Build Quick Note-Taking System

**Files to Create/Modify:**
- `apps/server/src/storage/notesStore.ts` (create)
- `apps/server/src/index.ts` (modify - add endpoints)
- `apps/web/src/lib/akior-functions.ts` (modify - add functions)
- `apps/web/src/lib/akior-function-executor.ts` (modify - add handlers)

**Backend Endpoints:**

```typescript
// GET /api/notes - List all notes
fastify.get('/api/notes', async (req, reply) => {
  try {
    const { getAllNotes } = await import('./storage/notesStore.js');
    const notes = await getAllNotes();
    
    return reply.send({ ok: true, notes });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to get notes');
    return reply.status(500).send({ ok: false, error: 'failed_to_get_notes' });
  }
});

// POST /api/notes - Create a note
fastify.post('/api/notes', async (req, reply) => {
  const body = req.body as { content?: string; tags?: string[] };
  
  if (!body.content || !body.content.trim()) {
    return reply.status(400).send({ ok: false, error: 'content_required' });
  }
  
  try {
    const { createNote } = await import('./storage/notesStore.js');
    const note = await createNote(body.content, body.tags);
    
    fastify.log.info({ noteId: note.id }, 'Note created');
    
    return reply.send({ ok: true, note });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to create note');
    return reply.status(500).send({ ok: false, error: 'failed_to_create_note' });
  }
});

// PUT /api/notes/:id - Update a note
fastify.put('/api/notes/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { content?: string; tags?: string[] };
  
  if (!body.content || !body.content.trim()) {
    return reply.status(400).send({ ok: false, error: 'content_required' });
  }
  
  try {
    const { updateNote } = await import('./storage/notesStore.js');
    const note = await updateNote(id, body.content, body.tags);
    
    if (!note) {
      return reply.status(404).send({ ok: false, error: 'note_not_found' });
    }
    
    fastify.log.info({ noteId: id }, 'Note updated');
    
    return reply.send({ ok: true, note });
  } catch (error) {
    fastify.log.error({ error, noteId: id }, 'Failed to update note');
    return reply.status(500).send({ ok: false, error: 'failed_to_update_note' });
  }
});

// DELETE /api/notes/:id - Delete a note
fastify.delete('/api/notes/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  
  try {
    const { deleteNote } = await import('./storage/notesStore.js');
    const success = await deleteNote(id);
    
    if (!success) {
      return reply.status(404).send({ ok: false, error: 'note_not_found' });
    }
    
    fastify.log.info({ noteId: id }, 'Note deleted');
    
    return reply.send({ ok: true });
  } catch (error) {
    fastify.log.error({ error, noteId: id }, 'Failed to delete note');
    return reply.status(500).send({ ok: false, error: 'failed_to_delete_note' });
  }
});
```

**Voice Function Definitions:**

```typescript
// create_note
{
  name: 'create_note',
  description: 'Create a quick note. Use this when the user says things like "take a note", "remember this", or "write down".',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content of the note'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to categorize the note'
      }
    },
    required: ['content'],
    additionalProperties: false
  },
  strict: true,
  handler: async (args) => {
    return { success: true, message: 'Creating note...', data: args };
  }
}

// list_notes
{
  name: 'list_notes',
  description: 'List all saved notes. Use this when the user asks to "show my notes", "what are my notes", or "read my notes".',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  },
  strict: true,
  handler: async (args) => {
    return { success: true, message: 'Retrieving notes...', data: args };
  }
}

// delete_note
{
  name: 'delete_note',
  description: 'Delete a specific note. Use this when the user says "delete note", "remove my last note", etc.',
  parameters: {
    type: 'object',
    properties: {
      note_id: {
        type: 'string',
        description: 'The ID of the note to delete. Use "last" to delete the most recent note.'
      }
    },
    required: ['note_id'],
    additionalProperties: false
  },
  strict: true,
  handler: async (args) => {
    return { success: true, message: 'Deleting note...', data: args };
  }
}
```

---

### Task 4: Create Natural Language Time Parser

**File to Create:**
- `apps/web/src/lib/time-parser.ts`

**Implementation:**

```typescript
/**
 * Natural Language Time Parser
 * Converts natural language time expressions to ISO 8601 timestamps
 */

export interface ParsedTime {
  timestamp: string; // ISO 8601
  isRelative: boolean;
  originalInput: string;
}

export class TimeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeParseError';
  }
}

/**
 * Parse natural language time expression
 * 
 * Supported formats:
 * - Relative: "in 30 minutes", "in 2 hours", "in 5 days"
 * - Absolute time: "at 3 PM", "at 15:30", "at 18:00"
 * - Date with time: "tomorrow at 9 AM", "December 10 at 2 PM"
 * - Special: "noon", "midnight", "tomorrow", "next Monday"
 */
export function parseTime(input: string): ParsedTime {
  const normalizedInput = input.toLowerCase().trim();
  
  // Relative time patterns
  const relativePattern = /^in (\d+)\s*(minute|minutes|min|hour|hours|hr|hrs|day|days)$/i;
  const relativeMatch = normalizedInput.match(relativePattern);
  
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    
    const now = new Date();
    
    if (unit.startsWith('min')) {
      now.setMinutes(now.getMinutes() + amount);
    } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
      now.setHours(now.getHours() + amount);
    } else if (unit.startsWith('day')) {
      now.setDate(now.getDate() + amount);
    }
    
    return {
      timestamp: now.toISOString(),
      isRelative: true,
      originalInput: input
    };
  }
  
  // Absolute time patterns
  const timePattern = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const timeMatch = normalizedInput.match(timePattern);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
    
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return {
      timestamp: targetTime.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  // Special keywords
  if (normalizedInput === 'noon') {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    if (noon <= new Date()) {
      noon.setDate(noon.getDate() + 1);
    }
    return {
      timestamp: noon.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  if (normalizedInput === 'midnight') {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    midnight.setDate(midnight.getDate() + 1);
    return {
      timestamp: midnight.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  if (normalizedInput.startsWith('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if there's a time specified
    const timeMatch = normalizedInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      
      if (meridiem === 'pm' && hours < 12) {
        hours += 12;
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
      }
      
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    
    return {
      timestamp: tomorrow.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  // If we can't parse, throw error
  throw new TimeParseError(`Unable to parse time expression: "${input}"`);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `today at ${timeStr}`;
  } else if (isTomorrow) {
    return `tomorrow at ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${dateStr} at ${timeStr}`;
  }
}
```

**Testing:**
```typescript
// Unit tests
describe('Time Parser', () => {
  test('parses relative times', () => {
    const result = parseTime('in 30 minutes');
    expect(result.isRelative).toBe(true);
  });
  
  test('parses absolute times', () => {
    const result = parseTime('at 3 PM');
    expect(result.isRelative).toBe(false);
  });
  
  test('handles tomorrow', () => {
    const result = parseTime('tomorrow at 9 AM');
    // ... assertions
  });
});
```

---

### Task 5: Implement Contextual Reminders System

**Files to Create/Modify:**
- `apps/server/src/storage/remindersStore.ts` (create)
- `apps/server/src/index.ts` (modify - add endpoints)
- `apps/web/src/lib/akior-functions.ts` (modify)
- `apps/web/src/lib/akior-function-executor.ts` (modify)

**Integration with Notification Scheduler:**

```typescript
// In apps/server/src/index.ts

// POST /api/reminders - Create a reminder
fastify.post('/api/reminders', async (req, reply) => {
  const body = req.body as { message?: string; triggerAt?: string };
  
  if (!body.message || !body.message.trim()) {
    return reply.status(400).send({ ok: false, error: 'message_required' });
  }
  
  if (!body.triggerAt) {
    return reply.status(400).send({ ok: false, error: 'trigger_time_required' });
  }
  
  try {
    const { createReminder } = await import('./storage/remindersStore.js');
    
    // Create reminder in storage
    const reminder = await createReminder(body.message, body.triggerAt);
    
    // Schedule notification event
    const notificationId = await notificationScheduler.scheduleEvent(
      'reminder',
      {
        reminderId: reminder.id,
        message: reminder.message
      },
      reminder.triggerAt
    );
    
    // Update reminder with notification ID
    const { updateReminderNotificationId } = await import('./storage/remindersStore.js');
    await updateReminderNotificationId(reminder.id, notificationId);
    
    fastify.log.info({ reminderId: reminder.id, notificationId }, 'Reminder created and scheduled');
    
    return reply.send({ ok: true, reminder: { ...reminder, notificationId } });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to create reminder');
    return reply.status(500).send({ ok: false, error: 'failed_to_create_reminder' });
  }
});

// GET /api/reminders - List reminders
fastify.get('/api/reminders', async (req, reply) => {
  try {
    const { getAllReminders } = await import('./storage/remindersStore.js');
    const reminders = await getAllReminders();
    
    return reply.send({ ok: true, reminders });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to get reminders');
    return reply.status(500).send({ ok: false, error: 'failed_to_get_reminders' });
  }
});

// DELETE /api/reminders/:id - Cancel a reminder
fastify.delete('/api/reminders/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  
  try {
    const { deleteReminder } = await import('./storage/remindersStore.js');
    const success = await deleteReminder(id);
    
    if (!success) {
      return reply.status(404).send({ ok: false, error: 'reminder_not_found' });
    }
    
    fastify.log.info({ reminderId: id }, 'Reminder deleted');
    
    return reply.send({ ok: true });
  } catch (error) {
    fastify.log.error({ error, reminderId: id }, 'Failed to delete reminder');
    return reply.status(500).send({ ok: false, error: 'failed_to_delete_reminder' });
  }
});
```

**Voice Functions:**

```typescript
{
  name: 'set_reminder',
  description: 'Set a reminder for a specific time. Use this when the user says "remind me to", "set a reminder", etc.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'What to be reminded about'
      },
      time_expression: {
        type: 'string',
        description: 'When to be reminded (e.g., "in 30 minutes", "at 6 PM", "tomorrow at 9 AM")'
      }
    },
    required: ['message', 'time_expression'],
    additionalProperties: false
  },
  strict: true,
  handler: async (args) => {
    return { success: true, message: 'Setting reminder...', data: args };
  }
}
```

**Handler Implementation:**

```typescript
case 'set_reminder': {
  try {
    // Parse time expression
    const { parseTime, formatTimestamp } = await import('@/lib/time-parser');
    const parsedTime = parseTime(args.time_expression);
    
    // Create reminder
    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: args.message,
        triggerAt: parsedTime.timestamp
      })
    });
    
    if (!response.ok) {
      return {
        success: false,
        message: 'Failed to set reminder'
      };
    }
    
    const result = await response.json();
    const displayTime = formatTimestamp(parsedTime.timestamp);
    
    return {
      success: true,
      message: `Reminder set for ${displayTime}: ${args.message}`,
      data: result.reminder
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse time: ${error.message}`
    };
  }
}
```

---

### Task 6: Build Smart Alarm System

**Files to Create/Modify:**
- `apps/server/src/storage/alarmsStore.ts` (create)
- `apps/server/src/index.ts` (modify - add endpoints and camera integration)
- `apps/web/src/lib/akior-functions.ts` (modify)
- `apps/web/src/lib/akior-function-executor.ts` (modify)

**Alarm Types:**

1. **Time-Based Alarms**: Traditional alarms that trigger at specific times
2. **Motion-Based Alarms**: Trigger when camera detects motion
3. **Event-Based Alarms**: Future - trigger on specific system events

**Backend Endpoints:**

```typescript
// POST /api/alarms - Create an alarm
fastify.post('/api/alarms', async (req, reply) => {
  const body = req.body as {
    name?: string;
    type?: 'time' | 'motion' | 'event';
    triggerTime?: string;
    recurring?: boolean;
    recurrencePattern?: string;
    cameraId?: string;
    location?: string;
  };
  
  if (!body.name || !body.type) {
    return reply.status(400).send({ ok: false, error: 'name_and_type_required' });
  }
  
  // Validate based on alarm type
  if (body.type === 'time' && !body.triggerTime) {
    return reply.status(400).send({ ok: false, error: 'trigger_time_required_for_time_alarms' });
  }
  
  if (body.type === 'motion' && !body.location && !body.cameraId) {
    return reply.status(400).send({ ok: false, error: 'location_or_camera_id_required_for_motion_alarms' });
  }
  
  try {
    const { createAlarm } = await import('./storage/alarmsStore.js');
    
    const alarm = await createAlarm({
      name: body.name,
      type: body.type,
      enabled: true,
      triggerTime: body.triggerTime,
      recurring: body.recurring,
      recurrencePattern: body.recurrencePattern,
      cameraId: body.cameraId,
      location: body.location
    });
    
    fastify.log.info({ alarmId: alarm.id, type: alarm.type }, 'Alarm created');
    
    return reply.send({ ok: true, alarm });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to create alarm');
    return reply.status(500).send({ ok: false, error: 'failed_to_create_alarm' });
  }
});

// GET /api/alarms - List alarms
fastify.get('/api/alarms', async (req, reply) => {
  try {
    const { getAllAlarms } = await import('./storage/alarmsStore.js');
    const alarms = await getAllAlarms();
    
    return reply.send({ ok: true, alarms });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to get alarms');
    return reply.status(500).send({ ok: false, error: 'failed_to_get_alarms' });
  }
});

// PUT /api/alarms/:id/toggle - Toggle alarm on/off
fastify.put('/api/alarms/:id/toggle', async (req, reply) => {
  const { id } = req.params as { id: string };
  
  try {
    const { toggleAlarm } = await import('./storage/alarmsStore.js');
    const alarm = await toggleAlarm(id);
    
    if (!alarm) {
      return reply.status(404).send({ ok: false, error: 'alarm_not_found' });
    }
    
    fastify.log.info({ alarmId: id, enabled: alarm.enabled }, 'Alarm toggled');
    
    return reply.send({ ok: true, alarm });
  } catch (error) {
    fastify.log.error({ error, alarmId: id }, 'Failed to toggle alarm');
    return reply.status(500).send({ ok: false, error: 'failed_to_toggle_alarm' });
  }
});

// DELETE /api/alarms/:id - Delete alarm
fastify.delete('/api/alarms/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  
  try {
    const { deleteAlarm } = await import('./storage/alarmsStore.js');
    const success = await deleteAlarm(id);
    
    if (!success) {
      return reply.status(404).send({ ok: false, error: 'alarm_not_found' });
    }
    
    fastify.log.info({ alarmId: id }, 'Alarm deleted');
    
    return reply.send({ ok: true });
  } catch (error) {
    fastify.log.error({ error, alarmId: id }, 'Failed to delete alarm');
    return reply.status(500).send({ ok: false, error: 'failed_to_delete_alarm' });
  }
});
```

**Camera Motion Integration:**

Find the existing camera motion detection code and add alarm checking:

```typescript
// In camera motion detection handler (Socket.IO namespace)
io.of('/camera').on('connection', (socket) => {
  // ... existing code ...
  
  socket.on('motion-detected', async (data: { cameraId: string; location?: string }) => {
    // Check for active motion alarms
    try {
      const { getActiveMotionAlarms } = await import('./storage/alarmsStore.js');
      const activeAlarms = await getActiveMotionAlarms(data.cameraId, data.location);
      
      for (const alarm of activeAlarms) {
        // Fire notification for each active alarm
        await notificationScheduler.scheduleEvent(
          'alarm',
          {
            alarmId: alarm.id,
            alarmName: alarm.name,
            alarmType: 'motion',
            cameraId: data.cameraId,
            location: data.location,
            message: `Motion detected: ${alarm.name}`
          },
          new Date().toISOString()
        );
        
        // Update last triggered timestamp
        const { updateAlarmLastTriggered } = await import('./storage/alarmsStore.js');
        await updateAlarmLastTriggered(alarm.id);
      }
    } catch (error) {
      console.error('[Alarms] Failed to check motion alarms:', error);
    }
  });
});
```

---

### Task 7: Implement Voice Feedback System

**Files to Create/Modify:**
- `apps/web/src/lib/voice-feedback.ts` (create)
- `packages/shared/src/settings.ts` (modify)
- `apps/web/app/settings/page.tsx` (modify)

**Voice Feedback Module:**

```typescript
/**
 * Voice Feedback System
 * Provides TTS responses using configured provider
 */

import { readSettings } from '@shared/settings';

export type VoiceFeedbackProvider = 'realtime' | 'elevenlabs' | 'azure' | 'none';

export interface VoiceFeedbackOptions {
  text: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Speak a response using the configured TTS provider
 */
export async function speakResponse(options: VoiceFeedbackOptions): Promise<boolean> {
  const settings = readSettings();
  const provider = settings.voiceFeedbackProvider || 'none';
  
  if (provider === 'none') {
    console.log('[VoiceFeedback] Provider disabled, skipping TTS');
    return false;
  }
  
  try {
    switch (provider) {
      case 'realtime':
        return await speakWithRealtime(options.text);
      
      case 'elevenlabs':
        return await speakWithElevenLabs(options.text);
      
      case 'azure':
        return await speakWithAzure(options.text);
      
      default:
        console.warn('[VoiceFeedback] Unknown provider:', provider);
        return false;
    }
  } catch (error) {
    console.error('[VoiceFeedback] Failed to speak:', error);
    return false;
  }
}

/**
 * Speak using OpenAI Realtime API
 */
async function speakWithRealtime(text: string): Promise<boolean> {
  // If we're in an active Realtime API session, send the text
  // This would integrate with the existing AKIOR assistant
  // For now, return false to indicate not implemented
  console.log('[VoiceFeedback] Realtime API TTS not yet implemented');
  return false;
}

/**
 * Speak using ElevenLabs TTS
 */
async function speakWithElevenLabs(text: string): Promise<boolean> {
  try {
    const response = await fetch('/api/integrations/elevenlabs/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(audioUrl);
    await audio.play();
    
    // Cleanup after playback
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };
    
    return true;
  } catch (error) {
    console.error('[VoiceFeedback] ElevenLabs TTS error:', error);
    return false;
  }
}

/**
 * Speak using Azure TTS
 */
async function speakWithAzure(text: string): Promise<boolean> {
  try {
    const response = await fetch('/api/integrations/azure-tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`Azure TTS failed: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(audioUrl);
    await audio.play();
    
    // Cleanup after playback
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };
    
    return true;
  } catch (error) {
    console.error('[VoiceFeedback] Azure TTS error:', error);
    return false;
  }
}

/**
 * Helper to speak feedback after function execution
 */
export async function speakFunctionResult(functionName: string, result: { success: boolean; message: string }): Promise<void> {
  if (result.success) {
    await speakResponse({ text: result.message, priority: 'normal' });
  }
}
```

**Settings Integration:**

```typescript
// In packages/shared/src/settings.ts

export type VoiceFeedbackProvider = 'realtime' | 'elevenlabs' | 'azure' | 'none';

export type AppSettings = {
  akior: AKIORSettings;
  models: ModelSettings;
  textChat: TextChatSettings;
  imageGeneration: ImageGenerationSettings;
  integrations: import('./integrations').IntegrationSettings;
  notificationPreferences?: NotificationPreferences;
  voiceFeedbackProvider?: VoiceFeedbackProvider;  // NEW
  useServerProxy?: boolean;
  weather?: {
    enabled?: boolean;
    provider?: 'openweather';
    location?: string;
  };
};

// Update default settings
const defaultSettings: AppSettings = {
  // ... existing defaults ...
  voiceFeedbackProvider: 'none',  // Default to disabled
};
```

**Settings UI:**

```tsx
// In apps/web/app/settings/page.tsx

<div className="space-y-4">
  <h3 className="text-lg font-semibold">Voice Feedback</h3>
  
  <div>
    <label className="block text-sm font-medium mb-2">
      TTS Provider
    </label>
    <select
      value={settings.voiceFeedbackProvider || 'none'}
      onChange={(e) => {
        updateSettings({ 
          voiceFeedbackProvider: e.target.value as VoiceFeedbackProvider 
        });
      }}
      className="w-full px-3 py-2 border rounded"
    >
      <option value="none">None (Text Only)</option>
      <option value="realtime">OpenAI Realtime API</option>
      <option value="elevenlabs">ElevenLabs</option>
      <option value="azure">Azure TTS</option>
    </select>
    <p className="text-sm text-gray-500 mt-1">
      Select how AKIOR should speak responses
    </p>
  </div>
</div>
```

---

## Testing Strategy

### Unit Testing

**Storage Modules:**
```typescript
describe('NotesStore', () => {
  test('creates note with valid content', async () => {
    const note = await createNote('Test note content');
    expect(note.id).toBeDefined();
    expect(note.content).toBe('Test note content');
  });
  
  test('rejects empty note content', async () => {
    await expect(createNote('')).rejects.toThrow();
  });
});
```

**Time Parser:**
```typescript
describe('Time Parser', () => {
  test('parses "in 30 minutes"', () => {
    const result = parseTime('in 30 minutes');
    expect(result.isRelative).toBe(true);
    // Check timestamp is ~30 minutes from now
  });
  
  test('throws on invalid input', () => {
    expect(() => parseTime('invalid time')).toThrow(TimeParseError);
  });
});
```

### Integration Testing

**Voice Commands:**
```typescript
describe('Voice Commands', () => {
  test('creates note via voice', async () => {
    const result = await executeFunction('create_note', {
      content: 'Test voice note'
    });
    
    expect(result.success).toBe(true);
    
    // Verify note was created
    const notes = await fetch('/api/notes').then(r => r.json());
    expect(notes.notes).toContainEqual(
      expect.objectContaining({ content: 'Test voice note' })
    );
  });
});
```

**Reminder Scheduling:**
```typescript
describe('Reminders', () => {
  test('schedules reminder correctly', async () => {
    const triggerAt = new Date(Date.now() + 60000).toISOString(); // 1 min from now
    
    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test reminder',
        triggerAt
      })
    });
    
    expect(response.ok).toBe(true);
    
    const result = await response.json();
    expect(result.ok).toBe(true);
    expect(result.reminder.notificationId).toBeDefined();
  });
});
```

### End-to-End Testing

**Complete Workflows:**
1. User says "Take a note: Buy groceries"
2. System creates note
3. System speaks confirmation
4. User says "Show my notes"
5. System lists all notes including the new one

---

## Security Considerations

### Input Validation

**All user input must be validated:**
- Note content: Max 5000 characters, sanitize HTML
- Reminder messages: Max 500 characters
- Time expressions: Validated by time parser
- Tags: Max 50 characters each, max 10 tags

**Zod Schemas:**
```typescript
const NoteSchema = z.object({
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().max(50)).max(10).optional()
});
```

### Rate Limiting

**Prevent abuse of endpoints:**
- Notes: Max 100 per user per day
- Reminders: Max 50 per user per day
- Alarms: Max 20 per user

### File Access

**Ensure data isolation:**
- All JSON files in `apps/server/data/` directory
- No arbitrary file path access
- Atomic write operations to prevent corruption

### API Keys

**Never expose:**
- OpenWeather API key (server-side only)
- ElevenLabs API key (server-side only)
- Azure TTS keys (server-side only)

---

## Deployment Checklist

- [ ] All TypeScript compilation passes (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Voice commands tested with OpenAI Realtime API
- [ ] Data persistence verified across restarts
- [ ] Camera motion alarm integration tested
- [ ] TTS providers tested (ElevenLabs, Azure)
- [ ] Settings UI updated with new options
- [ ] Documentation updated (README.md)
- [ ] Release notes created

---

## Future Enhancements

### Phase 2 Features

1. **Recurring Alarms**: Daily, weekly, custom patterns
2. **Snooze Functionality**: Delay alarms/reminders
3. **Location-Based Reminders**: Geofencing (requires mobile app)
4. **Note Attachments**: Voice memos, images
5. **Note Sharing**: Share notes with other users
6. **Smart Suggestions**: AI-powered note categorization
7. **Voice Commands for Editing**: "Change note 5 to say..."
8. **Weather Forecasts**: Multi-day weather predictions
9. **Weather Alerts**: Severe weather notifications

### Technical Improvements

1. **Database Migration**: Move from JSON to SQLite/PostgreSQL
2. **Full-Text Search**: Search notes by content
3. **Undo/Redo**: Revert note/reminder changes
4. **Backup/Export**: Export notes to PDF, CSV, etc.
5. **Sync Across Devices**: Cloud sync for notes/reminders
6. **Natural Language Understanding**: Better time parsing with more formats

---

## Summary

This implementation adds four major voice-controlled features to AKIOR:

1. ✅ **Voice-Activated Weather**: Query weather by voice
2. ✅ **Quick Notes**: Create, list, edit, delete notes
3. ✅ **Reminders**: Schedule notifications with natural language times
4. ✅ **Smart Alarms**: Time-based and motion-based triggers

All features integrate seamlessly with existing architecture:
- OpenAI Realtime API for voice commands
- Notification scheduler for reminders/alarms
- Camera system for motion detection
- Existing TTS integrations for voice feedback
- JSON file storage for persistence

**Estimated Timeline:** 3-5 days for complete implementation

**Testing:** Unit, integration, and E2E tests included

**Security:** Input validation, rate limiting, API key protection
