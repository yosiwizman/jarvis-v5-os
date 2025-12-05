# Server-Side Settings - CRITICAL FIX

## The Problem

Settings were stored **ONLY in localStorage** on each client device:
- ❌ Laptop has settings A (custom prompt, voice, etc.)
- ❌ Tablet has settings B (defaults)
- ❌ Phone has settings C (different prompt)
- ❌ **NO SYNCHRONIZATION** across devices

**Result**: Jarvis behaves differently on each device!

## The Solution

Settings are now stored **ON THE SERVER** and shared across ALL devices:
- ✅ Settings saved to `/data/settings.json` on server
- ✅ All devices load from server
- ✅ Changes on one device → instant sync to all others
- ✅ localStorage used as backup only

## What Was Changed

### 1. Server Endpoints Added (`apps/server/src/index.ts`)

```typescript
// GET /settings - Load settings from server
fastify.get('/settings', async (req, reply) => {
  // Returns settings from data/settings.json
});

// POST /settings - Save settings to server
fastify.post('/settings', async (req, reply) => {
  // Saves to data/settings.json
});
```

### 2. Client Settings Refactored (`packages/shared/src/settings.ts`)

**New Functions**:
```typescript
// Async load from server
loadSettingsFromServer(): Promise<AppSettings>

// Synchronous read (returns cached or defaults)
readSettings(): AppSettings  // No changes to API!

// Async write to server
writeSettings(settings): Promise<void>  // Now async!
```

**Flow**:
```
1. App loads → loadSettingsFromServer() called
2. Fetches from /settings endpoint
3. Caches in memory
4. readSettings() returns cached data
5. writeSettings() saves to server + localStorage
```

### 3. Auto-Load on App Start (`apps/web/app/layout.tsx`)

```typescript
useEffect(() => {
  console.log('🔄 Loading settings from server...');
  loadSettingsFromServer().catch(err => {
    console.error('Failed to load settings from server:', err);
  });
}, []);
```

## How It Works

### Read Flow
```
Device 1                    Server                    Device 2
   |                          |                          |
   |  loadSettingsFromServer  |                          |
   |------------------------->|                          |
   |  GET /settings           |                          |
   |<-------------------------|                          |
   |  {jarvis: {...}}         |                          |
   |                          |  loadSettingsFromServer  |
   |                          |<-------------------------|
   |                          |  GET /settings           |
   |                          |------------------------->|
   |                          |  {jarvis: {...}}         |
   |                          |                          |
   ✅ Same settings on both devices!
```

### Write Flow
```
Device 1 (Laptop)           Server                    Device 2 (Tablet)
   |                          |                          |
   | User changes prompt      |                          |
   | writeSettings()          |                          |
   |------------------------->|                          |
   |  POST /settings          |                          |
   |  {jarvis: {prompt: ...}} |                          |
   |<-------------------------|                          |
   |  {success: true}         |                          |
   |                          |                          |
   |                          | (Tablet reloads page)    |
   |                          |  loadSettingsFromServer  |
   |                          |<-------------------------|
   |                          |  GET /settings           |
   |                          |------------------------->|
   |                          |  {jarvis: {prompt: ...}} |
   |                          |                          |
   ✅ Tablet gets new prompt!
```

## Fallback Behavior

If server is unreachable:
1. Tries to load from server
2. Falls back to localStorage
3. Console warns: "⚠️ Failed to load settings from server, using localStorage fallback"
4. App still works!

## File Storage

Settings stored on server at:
```
/Users/kevincoda/Desktop/Projects/Jarvis/apps/server/data/settings.json
```

Format:
```json
{
  "jarvis": {
    "model": "gpt-4o-mini-realtime-preview-2024-12-17",
    "voice": "echo",
    "initialPrompt": "You are J.A.R.V.I.S. ...",
    "hotword": "jarvis",
    "imageDetail": "low"
  },
  "models": { ... },
  "textChat": { ... },
  "imageGeneration": { ... }
}
```

## Migration Path

### First Device After Deployment
1. Loads from server → gets empty {}
2. Falls back to localStorage
3. Next time user changes settings → saves to server
4. Server now has settings!

### Subsequent Devices
1. Load from server → gets existing settings
2. All devices now synchronized!

## Debug Output

### Successful Load
```
🔄 Loading settings from server...
✅ Settings loaded from server
```

### Fallback to localStorage
```
🔄 Loading settings from server...
⚠️ Failed to load settings from server, using localStorage fallback: Error: ...
```

### Settings Save
```
✅ Settings saved to server
```

## Breaking Changes

**IMPORTANT**: `writeSettings()` is now async!

**Old Code**:
```typescript
writeSettings(settings);  // Sync
```

**New Code**:
```typescript
await writeSettings(settings);  // Async
```

All helper functions are also now async:
- `updateSettings()` → `await updateSettings()`
- `updateJarvisSettings()` → `await updateJarvisSettings()`
- `updateModelSettings()` → `await updateModelSettings()`
- etc.

## Testing

### On Laptop
1. Change initial prompt in settings
2. Check console: `✅ Settings saved to server`
3. Verify file exists: `apps/server/data/settings.json`

### On Tablet
1. Refresh the page
2. Check console: `✅ Settings loaded from server`
3. Open Jarvis
4. Verify it uses the laptop's prompt!

### Verify Sync
1. Change voice on tablet
2. Reload laptop
3. Laptop should use new voice!

## Benefits

✅ **One source of truth** - Server has the settings
✅ **Cross-device sync** - All devices use same settings
✅ **Consistent behavior** - Jarvis acts the same everywhere
✅ **Centralized management** - Update once, applies everywhere
✅ **Backup to localStorage** - Works offline
✅ **No manual sync** - Automatic on page load

## Files Modified

1. **apps/server/src/index.ts** - Added GET/POST /settings endpoints
2. **packages/shared/src/settings.ts** - Refactored to use server
3. **apps/web/app/layout.tsx** - Auto-load settings on mount

## No Breaking Changes to Read API

The `readSettings()` function **still works synchronously**:
```typescript
const settings = readSettings();  // Still works!
```

It returns cached server settings or defaults. The async load happens in the background.

## Future Enhancements

- Real-time sync via WebSocket (settings change → push to all devices)
- Settings versioning/history
- Per-device overrides (tablet uses different voice)
- Settings import/export
- Backup to cloud storage

