# Agent D: Quick Reference Card
## Voice Features Implementation for J.A.R.V.I.S. V6.1.0

---

## 🎯 Quick Start

**Branch**: `feature/v6.1-voice-features`  
**Timeline**: 3-5 days  
**Priority**: Follow numbered task order

---

## 📋 Task Checklist

### Task 1: Data Storage Infrastructure ⏱️ 4-6 hours
- [ ] Create `apps/server/data/notes.json`
- [ ] Create `apps/server/data/reminders.json`
- [ ] Create `apps/server/data/alarms.json`
- [ ] Create `apps/server/src/storage/notesStore.ts` (CRUD operations)
- [ ] Create `apps/server/src/storage/remindersStore.ts` (CRUD operations)
- [ ] Create `apps/server/src/storage/alarmsStore.ts` (CRUD operations)

### Task 2: Voice-Activated Weather ⏱️ 3-4 hours
- [ ] Add `get_weather` function to `apps/web/src/lib/jarvis-functions.ts`
- [ ] Add `POST /api/integrations/weather/query` endpoint to `apps/server/src/index.ts`
- [ ] Implement handler in `apps/web/src/lib/jarvis-function-executor.ts`
- [ ] Test: "What's the weather?" → Returns weather data

### Task 3: Quick Note-Taking System ⏱️ 6-8 hours
- [ ] Add 4 endpoints to `apps/server/src/index.ts`: GET/POST/PUT/DELETE `/api/notes`
- [ ] Add 4 functions to `jarvis-functions.ts`: `create_note`, `list_notes`, `delete_note`, `edit_note`
- [ ] Implement 4 handlers in `jarvis-function-executor.ts`
- [ ] Test: "Take a note: Buy milk" → Note created and stored

### Task 4: Natural Language Time Parser ⏱️ 4-5 hours
- [ ] Create `apps/web/src/lib/time-parser.ts`
- [ ] Implement `parseTime()` function with regex patterns
- [ ] Implement `formatTimestamp()` for display
- [ ] Test: "in 30 minutes", "at 6 PM", "tomorrow at 9 AM"

### Task 5: Contextual Reminders ⏱️ 6-8 hours
- [ ] Add 3 endpoints: POST/GET/DELETE `/api/reminders`
- [ ] Integrate with `notificationScheduler.scheduleEvent()`
- [ ] Add 3 functions: `set_reminder`, `list_reminders`, `cancel_reminder`
- [ ] Implement handlers with time parser integration
- [ ] Test: "Remind me to call Mom at 3 PM" → Notification fires at 3 PM

### Task 6: Smart Alarm System ⏱️ 8-10 hours
- [ ] Add 4 endpoints: POST/GET/PUT/DELETE `/api/alarms`
- [ ] Add 4 functions: `set_alarm`, `list_alarms`, `toggle_alarm`, `delete_alarm`
- [ ] Integrate with camera motion detection (Socket.IO)
- [ ] Test time-based: "Set alarm for 7 AM"
- [ ] Test motion-based: "Alert me if there's motion in the backyard"

### Task 7: Voice Feedback System ⏱️ 4-5 hours
- [ ] Create `apps/web/src/lib/voice-feedback.ts` module
- [ ] Add `voiceFeedbackProvider` to `packages/shared/src/settings.ts`
- [ ] Update `apps/web/app/settings/page.tsx` with provider dropdown
- [ ] Implement TTS for all 3 providers (Realtime, ElevenLabs, Azure)
- [ ] Test voice confirmations for all actions

### Task 8: Integration & Testing ⏱️ 4-6 hours
- [ ] Unit tests for storage modules
- [ ] Unit tests for time parser
- [ ] Integration tests for all endpoints
- [ ] E2E tests for complete voice workflows
- [ ] Test data persistence across server restarts

---

## 🗂️ File Structure

```
apps/
  server/
    data/
      notes.json                    # NEW
      reminders.json                # NEW
      alarms.json                   # NEW
    src/
      storage/
        notesStore.ts               # NEW
        remindersStore.ts           # NEW
        alarmsStore.ts              # NEW
      index.ts                      # MODIFY - add endpoints
  web/
    src/
      lib/
        jarvis-functions.ts         # MODIFY - add functions
        jarvis-function-executor.ts # MODIFY - add handlers
        time-parser.ts              # NEW
        voice-feedback.ts           # NEW
    app/
      settings/
        page.tsx                    # MODIFY - add voice feedback UI

packages/
  shared/
    src/
      settings.ts                   # MODIFY - add voiceFeedbackProvider
```

---

## 🔧 Key Implementation Patterns

### Storage Module Pattern (Repeat for notes/reminders/alarms)

```typescript
// Example: notesStore.ts
import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const NOTES_FILE = 'data/notes.json';

const NoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});

export async function createNote(content: string, tags?: string[]): Promise<Note> {
  const notes = await loadNotes();
  const note = { id: randomUUID(), content, tags, createdAt: new Date().toISOString() };
  NoteSchema.parse(note);
  notes.push(note);
  await saveNotes(notes);
  return note;
}

export async function getAllNotes(): Promise<Note[]> { /* ... */ }
export async function updateNote(id, content, tags): Promise<Note | null> { /* ... */ }
export async function deleteNote(id): Promise<boolean> { /* ... */ }
```

### Voice Function Pattern

```typescript
// In jarvis-functions.ts
{
  name: 'function_name',
  description: 'When to use this function',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'What this param is for' }
    },
    required: ['param1'],
    additionalProperties: false
  },
  strict: true,
  handler: async (args) => {
    return { success: true, message: 'Processing...', data: args };
  }
}
```

### Backend Endpoint Pattern

```typescript
// In apps/server/src/index.ts
fastify.post('/api/resource', async (req, reply) => {
  const body = req.body as { field?: string };
  
  if (!body.field) {
    return reply.status(400).send({ ok: false, error: 'field_required' });
  }
  
  try {
    const { createResource } = await import('./storage/resourceStore.js');
    const resource = await createResource(body.field);
    
    fastify.log.info({ resourceId: resource.id }, 'Resource created');
    return reply.send({ ok: true, resource });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to create resource');
    return reply.status(500).send({ ok: false, error: 'failed_to_create_resource' });
  }
});
```

### Handler Implementation Pattern

```typescript
// In jarvis-function-executor.ts
case 'function_name': {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field: args.param1 })
  });
  
  if (!response.ok) {
    return { success: false, message: 'Failed to execute' };
  }
  
  const result = await response.json();
  return {
    success: true,
    message: 'Action completed successfully',
    data: result.resource
  };
}
```

---

## 🎤 Voice Commands Reference

### Weather
- "What's the weather?"
- "How hot is it in Miami?"
- "What's the temperature?"

### Notes
- "Take a note: Buy groceries tomorrow"
- "Show my notes"
- "Delete my last note"
- "Read my notes"

### Reminders
- "Remind me to call Mom at 3 PM"
- "Set a reminder for tomorrow at 9 AM to check email"
- "Show my reminders"
- "Cancel the Mom reminder"

### Alarms
- "Set an alarm for 7 AM"
- "Wake me up at 6:30 tomorrow"
- "Alert me if there's motion in the backyard"
- "Show my alarms"
- "Turn off the motion alarm"

---

## 🔍 Testing Commands

### Backend Tests
```bash
# Test weather endpoint
curl -X POST https://localhost:1234/api/integrations/weather/query \
  -H "Content-Type: application/json" \
  -d '{"location": "Miami,US"}'

# Test note creation
curl -X POST https://localhost:1234/api/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Test note", "tags": ["test"]}'

# Test reminder creation
curl -X POST https://localhost:1234/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"message": "Test reminder", "triggerAt": "2025-12-06T18:00:00Z"}'
```

### TypeScript Compilation
```bash
npm run typecheck
```

### Production Build
```bash
npm run build
```

---

## 📊 Data Models Quick Reference

### Note
```typescript
interface Note {
  id: string;              // UUID
  content: string;         // Max 5000 chars
  tags?: string[];         // Optional tags
  createdAt: string;       // ISO 8601
  updatedAt?: string;      // ISO 8601
}
```

### Reminder
```typescript
interface Reminder {
  id: string;
  message: string;         // Max 500 chars
  triggerAt: string;       // ISO 8601
  createdAt: string;
  notificationId?: string; // Link to notification
  fired: boolean;
}
```

### Alarm
```typescript
interface Alarm {
  id: string;
  name: string;
  type: 'time' | 'motion' | 'event';
  enabled: boolean;
  
  // Time-based
  triggerTime?: string;
  recurring?: boolean;
  recurrencePattern?: string;
  
  // Motion-based
  cameraId?: string;
  location?: string;
  
  createdAt: string;
  lastTriggered?: string;
}
```

---

## 🔐 Security Checklist

- [ ] Input validation with Zod schemas
- [ ] Max content lengths enforced (notes: 5000, reminders: 500)
- [ ] Rate limiting on endpoints (notes: 100/day, reminders: 50/day, alarms: 20 total)
- [ ] No arbitrary file path access
- [ ] Atomic write operations
- [ ] API keys never exposed to client
- [ ] HTML sanitization for user content

---

## 🐛 Common Issues & Solutions

### Issue: "Failed to load notes"
**Solution**: Ensure `apps/server/data/` directory exists and has write permissions

### Issue: "Time parsing failed"
**Solution**: Check time expression format. Supported: "in 30 minutes", "at 3 PM", "tomorrow at 9 AM"

### Issue: "Notification not firing"
**Solution**: Verify notification scheduler is initialized in `apps/server/src/index.ts`

### Issue: "Camera motion alarm not triggering"
**Solution**: Check camera Socket.IO integration and ensure `motion-detected` event is emitted

---

## 📦 Dependencies

**Existing (No New Installs Required)**:
- `zod` - Input validation
- `crypto` - UUID generation
- `fs/promises` - File operations
- Socket.IO - Camera integration
- Fastify - Backend server
- Next.js - Frontend

---

## 🚀 Deployment Steps

1. **Create feature branch**: `git checkout -b feature/v6.1-voice-features`
2. **Implement tasks 1-8** (follow checklist above)
3. **Run tests**: `npm run typecheck && npm run build`
4. **Test voice commands** via J.A.R.V.I.S. interface
5. **Create PR** with description from implementation guide
6. **Merge to main** after review
7. **Tag release**: `git tag v6.1.0 && git push --tags`
8. **Update README.md** with new features

---

## 💡 Pro Tips

1. **Start with storage infrastructure** - It's the foundation for everything else
2. **Test each feature independently** before integrating
3. **Use existing patterns** - Follow the camera/3D printer integration patterns
4. **Log everything** - Use `fastify.log.info()` and `fastify.log.error()`
5. **Handle edge cases** - Empty inputs, past times, invalid IDs
6. **Voice feedback is optional** - Features should work without it

---

## 📝 Notes

- All features work with or without voice feedback enabled
- Data persists across server restarts automatically
- Reminders integrate with existing notification system
- Camera alarms use existing motion detection
- Time parser supports multiple natural language formats
- Settings are synced across all devices automatically

---

## 📞 Support

**Documentation**: See `AGENT_D_IMPLEMENTATION_GUIDE.md` for detailed implementation steps

**Architecture**: J.A.R.V.I.S. uses:
- Fastify backend (port 1234)
- Next.js frontend (port 3001 → proxied to 3000)
- OpenAI Realtime API for voice
- Socket.IO for real-time features
- JSON files for data persistence

**Questions**: Refer to existing implementations:
- Notification system: `apps/server/src/notificationScheduler.ts`
- Camera integration: Search for Socket.IO camera namespace
- Weather API: Search for `OPENWEATHER_API_KEY`
- Function calling: `apps/web/src/lib/jarvis-functions.ts`
