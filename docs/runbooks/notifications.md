# Notifications Subsystem Runbook

This document describes the architecture, configuration, and troubleshooting procedures for the Jarvis V5 notifications subsystem.

## Architecture Overview

The notifications system uses Server-Sent Events (SSE) to deliver real-time notifications from the server to connected clients.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Notification   │     │    Backend      │     │     Client      │
│   Scheduler     │────▶│  SSE Endpoint   │────▶│ NotificationCtx │
│  (Fastify)      │     │ /api/notif/str  │     │  (EventSource)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  scheduleEvent()      │  heartbeat (15s)      │  exponential
        │  fireEvent()          │  notifications        │  backoff
        └───────────────────────┴───────────────────────┘
```

### Components

1. **NotificationScheduler** (`apps/server/src/notificationScheduler.ts`)
   - Schedules events with ISO timestamps
   - Persists events to `data/scheduled-events.json`
   - Event loop checks every 60 seconds for due events
   - Broadcasts fired events to all connected SSE clients
   - Sends heartbeat every 15 seconds to keep connections alive

2. **SSE Endpoint** (`/api/notifications/stream`)
   - Backend: Fastify handler in `apps/server/src/index.ts`
   - Frontend: Next.js Edge route in `apps/web/app/api/notifications/stream/route.ts`
   - Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`

3. **NotificationContext** (`apps/web/context/NotificationContext.tsx`)
   - React context providing notification state to the app
   - Establishes SSE connection with exponential backoff
   - Tracks connection health state (status, lastHeartbeatAt, consecutiveFailures)
   - Resets backoff on successful heartbeat

4. **Health Endpoint** (`/api/health/notifications`)
   - Returns SSE health status
   - Fields: `ok`, `sse.enabled`, `sse.heartbeat_interval_sec`, `sse.last_heartbeat_age_ms`, `sse.connected_clients`

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_HTTPS` | `false` | Set to `true` for CI/HTTP-only mode |
| `BACKEND_URL` | `https://localhost:1234` | Backend server URL for Next.js rewrites |

### SSE Parameters (Constants)

| Parameter | Value | Location |
|-----------|-------|----------|
| Heartbeat interval | 15 seconds | `notificationScheduler.ts` |
| Event check interval | 60 seconds | `notificationScheduler.ts` |
| Max retry delay | 30 seconds | `NotificationContext.tsx` |
| Base retry delay | 1 second | `NotificationContext.tsx` |

## Troubleshooting

### Symptom: "Connecting to SSE… Closing SSE connection" loop

**Possible causes:**
1. Proxy buffering - reverse proxy buffering SSE responses
2. Connection timeout - server or proxy closing connection early
3. CORS issues - cross-origin blocking

**Resolution:**
1. Verify `X-Accel-Buffering: no` header is present
2. Check proxy configuration (nginx, cloudflare, etc.) for SSE compatibility
3. Verify CORS headers allow the client origin

### Symptom: Heartbeat not received within 20 seconds

**Possible causes:**
1. Heartbeat timer not started on server
2. Connection dropped but not detected
3. Proxy buffering delaying messages

**Resolution:**
1. Check server logs for `[NotificationScheduler] Heartbeat started`
2. Verify health endpoint: `curl http://localhost:1234/api/health/notifications`
3. Check `last_heartbeat_age_ms` in health response

### Symptom: Console spam with reconnection attempts

**Possible causes:**
1. Server returning errors
2. Connection immediately closing
3. Exponential backoff not resetting

**Resolution:**
1. Check server logs for errors on `/api/notifications/stream`
2. Verify HTTP 200 response with correct headers
3. Confirm heartbeat resets backoff (check client health state)

### Symptom: Notifications not appearing

**Possible causes:**
1. User preferences filtering notification type
2. SSE connection not established
3. Notification not fired (still scheduled)

**Resolution:**
1. Check user settings for notification preferences
2. Verify SSE connection status via `window.__notifDebug.getHealth()` (dev mode)
3. Check notification history: `curl http://localhost:1234/api/notifications/history`

## Testing

### Running Tests Locally

```bash
# Contract tests (requires server running)
npm run start:ci &
npm run test:notifications

# E2E tests with Playwright
npm run test:e2e

# All CI tests
npm run ci:smoke
```

### Running in CI

The CI pipeline runs:
1. **Contract Tests** (`contract-tests-notifications` job) - validates SSE headers and heartbeat
2. **E2E Tests** (`e2e-smoke` job) - validates client-side connection and notifications API

### Manual Testing

1. **Health check:**
   ```bash
   curl http://localhost:1234/api/health/notifications
   ```
   Expected: `{"ok":true,"sse":{"enabled":true,"heartbeat_interval_sec":15,...}}`

2. **SSE stream test:**
   ```bash
   curl -N http://localhost:1234/api/notifications/stream
   ```
   Expected: `data: {"type":"connection",...}` followed by heartbeats every 15s

3. **Browser console (dev mode):**
   ```javascript
   window.__notifDebug.getHealth()
   // Expected: {status: "connected", lastHeartbeatAt: Date, ...}
   ```

## Monitoring

### Key Metrics to Watch

1. **SSE connected clients** - via health endpoint `sse.connected_clients`
2. **Last heartbeat age** - via health endpoint `sse.last_heartbeat_age_ms`
3. **Consecutive failures** - via client health state (dev mode)

### Alert Conditions

- `last_heartbeat_age_ms > 30000` - heartbeat delayed/missing
- `connected_clients = 0` when app is active - no clients connected
- `consecutiveFailures >= 3` - connection degraded

## Changelog

- **2024-01-30**: Initial runbook created
  - Added heartbeat to Fastify SSE endpoint
  - Added health endpoint `/api/health/notifications`
  - Hardened NotificationContext with backoff reset on heartbeat
  - Added contract tests and E2E tests
