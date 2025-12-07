# Jarvis V6.1.0 – Notification Drawer & History UI

**Release Date:** December 7, 2025  
**Type:** Feature Enhancement (Incremental)  
**Focus:** User Interface & Experience for Notifications

---

## Overview

Jarvis V6.1.0 delivers a complete notification UI experience on top of the notification foundation built in v6.0.0. This release adds a **notification drawer**, **bell icon with badge**, and **read/unread tracking** to provide users with a modern, intuitive way to manage and review their notifications.

### Key Highlights

- **🔔 Notification Bell Icon** – Fixed top-right header icon with unread badge counter
- **📱 Notification Drawer** – Sliding panel with full notification history and controls
- **✅ Read/Unread Tracking** – Client-side state management for notification status
- **🎨 Theme-Aware Design** – Consistent with Jarvis dark mode and glassmorphism aesthetic
- **♿ Accessibility** – ARIA labels, keyboard navigation (Escape to close), focus management

---

## What's New in V6.1.0

### 1. Notification Bell Icon

A bell icon has been added to the top-right corner of the main Jarvis layout (beside the HUD widget).

**Features:**
- **Unread Badge**: Shows count of unread notifications (1-9, "9+" for 10+)
- **Visual States**: 
  - Default: Gray bell icon
  - Hover: White bell icon
  - Badge: Red circle with white text when unread notifications exist
- **Click Action**: Toggles the notification drawer open/closed
- **Accessibility**: `aria-label="Open notifications"` and `aria-expanded` state

**Location:** Fixed position at top-right of main content area, z-index 50 to stay above content

---

### 2. Notification Drawer

A full-screen (mobile) or 480px-wide (desktop) sliding panel that displays all notifications.

#### UI Components

**Header:**
- Title: "Notifications" with count (e.g., "(5)")
- Bell emoji icon (🔔)
- Close button (X) with hover effect

**Actions Bar** (only visible when notifications exist):
- **Mark all as read** – Blue button with soft background
- **Clear all** – Red button (client-side clear only, does not delete server history)

**Notification List:**
- Sorted newest-first by `triggeredAt` timestamp
- Each notification shows:
  - Type icon (📅 calendar, 🖨️ printer, 📹 camera, ⚙️ system, ⚠️ error, 💬 custom)
  - Title (formatted from type, e.g., "Calendar Reminder")
  - Message/payload summary (truncated to 100 chars)
  - Relative timestamp (e.g., "2m ago", "Just now", "3d ago")
  - Unread indicator (blue dot)
- **Read State Visual**: 
  - Unread: White text, blue dot, subtle background highlight
  - Read: Gray text, no dot, transparent background
- **Click Action**: Clicking an unread notification marks it as read

**Footer** (only visible when notifications exist):
- Shows count: "Showing X notification(s)"

**Empty State:**
- Bell emoji icon (🔔)
- Message: "No notifications"
- Subtext: "Notifications will appear here when they arrive"

#### Behavior

- **Opening**: Loads notification history from `/api/notifications/history` (limit 50) on first open
- **Closing**: Click backdrop, X button, or press Escape key
- **Animation**: Slides in from right with fade (0.3s ease-out)
- **History Loading**: 
  - Only loads once per session
  - Merges with live notifications from SSE stream
  - Deduplicates by notification ID
  - History items marked as "already read" by default

---

### 3. Enhanced Notification Context

The `NotificationContext` has been significantly enhanced to support the drawer UI.

#### New State

```typescript
interface NotificationWithReadState extends Notification {
  read: boolean; // Client-side read status
}
```

#### New Methods

- **`markAsRead(id: string)`** – Mark single notification as read
- **`markAllAsRead()`** – Mark all notifications as read (clears unread badge)
- **`clearAll()`** – Remove all notifications from client (does NOT delete server history)
- **`loadHistory()`** – Fetch notification history from server API
- **`unreadCount: number`** – Computed count of unread notifications (used by bell badge)

#### Behavior Changes

- **New Notifications**: Arrive via SSE stream and are marked `read: false` by default
- **Prepending**: New notifications are prepended (newest first) instead of appended
- **History Notifications**: Loaded from `/api/notifications/history` and marked `read: true` by default (considered "already seen")
- **Auto-Dismiss**: Existing 10-second auto-dismiss still applies to toast notifications (separate from drawer)

---

## Architecture & Technical Details

### Component Structure

```
apps/web/
  ├── components/
  │   ├── NotificationBell.tsx      ← New: Bell icon with badge + drawer toggle
  │   ├── NotificationDrawer.tsx    ← New: Sliding panel UI
  │   └── NotificationToast.tsx     ← Existing: Toast notifications (unchanged)
  ├── context/
  │   └── NotificationContext.tsx   ← Enhanced: Read/unread tracking, history loading
  └── app/
      └── layout.tsx                ← Updated: Added NotificationBell to header
```

### Data Flow

```
Server (v6.0.0)
  ├── POST /api/notifications/schedule  ← Schedule new notifications
  ├── GET /api/notifications/stream     ← SSE: Real-time notification delivery
  └── GET /api/notifications/history    ← Fetch past notifications (limit, offset, type filter)

Client (v6.1.0)
  ├── NotificationProvider
  │   ├── Connects to SSE stream
  │   ├── Maintains notifications array (with read state)
  │   ├── Loads history on demand (loadHistory)
  │   └── Exposes: markAsRead, markAllAsRead, clearAll, unreadCount
  ├── NotificationToast (v6.0.0)
  │   └── Shows transient toasts (10s auto-dismiss)
  ├── NotificationBell (v6.1.0)
  │   └── Shows badge (unreadCount > 0)
  └── NotificationDrawer (v6.1.0)
      └── Displays all notifications (history + live)
```

### State Management

- **Client-Side Only**: Read/unread state is NOT persisted to server
- **Session-Based**: Clearing state will reset read status on page refresh
- **History Loading**: Single-load strategy (only fetches history once per session to avoid redundant API calls)
- **Deduplication**: Notifications are deduplicated by ID when merging history with live notifications

---

## User Experience

### Typical Workflow

1. **New Notification Arrives**: 
   - Toast appears (10 seconds)
   - Bell badge updates (e.g., "1")
   - Notification added to drawer (unread)

2. **User Opens Drawer**:
   - Click bell icon
   - Drawer slides in from right
   - History loaded (if not already loaded)
   - Sees unread notification(s) highlighted

3. **User Reviews Notifications**:
   - Click individual notification → Marks as read
   - OR click "Mark all as read" → All marked as read
   - Badge disappears when all notifications are read

4. **User Clears Drawer**:
   - Click "Clear all" → Removes all notifications from client
   - Does NOT delete from server history
   - Drawer shows empty state

### Accessibility

- **Keyboard Navigation**:
  - Tab to bell icon
  - Enter/Space to open drawer
  - Escape to close drawer
- **ARIA Labels**:
  - Bell button: `aria-label="Open notifications"`, `aria-expanded` state
  - Drawer: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="notification-drawer-title"`
  - Unread badge: `aria-label="Unread"` on dot indicator
- **Focus Management**: Drawer backdrop is clickable and dismisses drawer

---

## Design & Styling

### Visual Consistency

- **Colors**: Uses Jarvis V6 theme tokens (`--jarvis-accent`, `--jarvis-surface`)
- **Dark Mode**: Black background (`#0b0f14`), white text with opacity variants
- **Glassmorphism**: Subtle backdrop blur on drawer overlay
- **Borders**: White/10 opacity for panel borders
- **Rounded Corners**: `rounded-2xl` for panel, `rounded-lg` for buttons

### Animation

- **Slide-in-right**: 0.3s ease-out animation for drawer entrance
- **Hover Effects**: Button backgrounds lighten on hover
- **Badge Pulse** (future enhancement idea): Could add pulse animation when new notifications arrive

### Responsive Design

- **Mobile**: Full-screen drawer (width 100%)
- **Desktop**: 480px-wide drawer from right side
- **Tablet**: Drawer adapts between mobile/desktop breakpoint (sm: 640px)

---

## Backward Compatibility

### ✅ Fully Backward Compatible

- **Existing Notifications**: All v6.0.0 notification features remain unchanged
- **Toast Notifications**: Still auto-dismiss after 10 seconds
- **SSE Stream**: No changes to real-time delivery
- **Server APIs**: No new endpoints required (uses existing `/api/notifications/history`)
- **Settings**: Notification preferences (toggle by type) still work

### Migration

- **No Migration Required**: v6.1.0 is a pure UI enhancement
- **Existing Users**: Will see new bell icon and drawer immediately on upgrade
- **Notification History**: Past notifications will appear in drawer when history is loaded

---

## Quality Assurance

### TypeScript

- ✅ **0 Errors**: All new components and context changes are fully typed
- ✅ **Strict Mode**: Uses strict TypeScript configuration
- ✅ **Type Safety**: `NotificationWithReadState` extends `Notification` with read flag

### Build

- ✅ **Production Build**: Successfully compiles with Next.js 14.2.3
- ✅ **Bundle Size**: No significant increase (drawer adds ~3KB gzipped)
- ✅ **Route Count**: Still 20 routes (no new routes added)
- ✅ **First Load JS**: 87.1 kB shared bundle (unchanged)

### Smoke Tests

- ✅ **15/15 Checks Pass**: All CI smoke tests pass
- ✅ **Pages**: Home, Settings, Chat, Menu, Holomat all 200 OK
- ✅ **APIs**: 
  - `POST /api/notifications/schedule` → 200
  - `GET /api/notifications/stream` → SSE connected
  - `GET /api/notifications/history` → 200 (implicit test via drawer)
- ✅ **Notification SSE**: Real-time delivery confirmed

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **Client-Side Read State**: Read/unread status is NOT persisted to server
   - Refreshing the page will reset all notifications to "read" (history items)
   - New live notifications will still show as unread

2. **History Pagination**: Drawer loads max 50 notifications
   - No "load more" button yet (can be added in v6.2.0+)

3. **Clear All**: Only clears client state, does NOT delete from server history
   - Server history remains intact for audit/debugging purposes

4. **No Notification Actions**: Clicking a notification only marks it as read
   - Future: Could add "Open" action to navigate to related feature

### Future Enhancement Ideas (v6.2.0+)

- **Persistent Read State**: Store read status on server (`readAt` field already exists in schema)
- **Notification Actions**: Add action buttons (e.g., "View Event", "Dismiss Forever")
- **History Pagination**: Add "Load More" to fetch older notifications
- **Delete from History**: Allow user to permanently delete specific notifications
- **Notification Filtering**: Filter by type (Calendar, Printer, Camera, etc.) in drawer
- **Search**: Add search input to filter notifications by text
- **Notification Sound**: Optional sound/vibration when new notification arrives
- **Badge Animation**: Pulse or bounce animation when unread count updates

---

## Testing Recommendations

### Manual UI Testing

1. **Bell Icon & Badge**:
   - Open Jarvis UI
   - Verify bell icon appears in top-right corner
   - Schedule a notification (via Settings or API test endpoint)
   - Verify badge appears with count "1"
   - Open drawer, mark as read
   - Verify badge disappears

2. **Notification Drawer**:
   - Click bell icon → Drawer slides in from right
   - Verify header shows "Notifications (X)"
   - Verify action buttons appear ("Mark all as read", "Clear all")
   - Click individual notification → Verify it marks as read (blue dot disappears)
   - Click "Mark all as read" → Verify all notifications update
   - Click "Clear all" → Verify drawer shows empty state
   - Click backdrop or X button → Verify drawer closes
   - Press Escape key → Verify drawer closes

3. **History Loading**:
   - Clear browser cache
   - Open Jarvis UI
   - Open drawer for first time
   - Verify spinner/loading state (if history is large)
   - Verify past notifications appear (marked as read)
   - Close and reopen drawer
   - Verify history is NOT fetched again (cached)

4. **Live Notifications + Drawer**:
   - Open drawer
   - Schedule a new notification (trigger now)
   - Verify notification appears in drawer instantly (prepended, unread)
   - Verify toast also appears (separate behavior)
   - Verify badge updates

### Automated Testing (Future)

- **Unit Tests**: Test `NotificationContext` methods (`markAsRead`, `markAllAsRead`, etc.)
- **Component Tests**: Test `NotificationDrawer` rendering and interactions
- **E2E Tests**: Playwright test for end-to-end notification flow (schedule → toast → drawer → read)

---

## Developer Notes

### Component API

**`<NotificationBell />`**
- Props: None (reads from context)
- State: `isDrawerOpen` (local toggle state)
- Renders: Bell icon + badge + `<NotificationDrawer>`

**`<NotificationDrawer />`**
- Props: `isOpen: boolean`, `onClose: () => void`
- Features:
  - Loads history on mount (if `isOpen` and not already loaded)
  - Sorts notifications newest-first
  - Handles Escape key
  - Renders backdrop overlay

### Context Usage

```typescript
import { useNotifications } from '@/context/NotificationContext';

function MyComponent() {
  const {
    notifications,     // NotificationWithReadState[]
    unreadCount,       // number
    markAsRead,        // (id: string) => void
    markAllAsRead,     // () => void
    clearAll,          // () => void
    loadHistory,       // () => Promise<void>
  } = useNotifications();

  return (
    <div>
      Unread: {unreadCount}
      <button onClick={markAllAsRead}>Mark all read</button>
    </div>
  );
}
```

### Styling Classes

- **Animation**: `.animate-slide-in-right` (defined in `globals.css`)
- **Theme Tokens**: `--jarvis-accent`, `--jarvis-surface`, `--jarvis-border`
- **Tailwind**: Uses standard Tailwind utilities (`bg-white/5`, `border-white/10`, etc.)

---

## Summary

Jarvis V6.1.0 completes the notification experience by adding a **modern, accessible, and theme-consistent UI** on top of the notification foundation built in v6.0.0. Users can now:

- **See unread notifications** at a glance (bell badge)
- **Review full notification history** in a dedicated drawer
- **Manage read/unread state** with intuitive controls
- **Clear notifications** without losing server history

This release maintains **full backward compatibility** with v6.0.0 and requires **no database migrations or server changes**. All new features are client-side enhancements that work seamlessly with the existing notification backend.

---

**Next Steps:**
- v6.2.0: Persistent read state, notification actions, and history pagination
- v7.0.0: Advanced notification management (filters, search, deletion, custom actions)

---

**For Questions or Issues:**
- See: `JARVIS_V6_TEST_PLAN.md` for detailed test cases
- See: `JARVIS_V6_REPO_OVERVIEW.md` for architecture overview
- See: `README.md` for quick start and feature list
