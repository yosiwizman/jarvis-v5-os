# Production Verification Checklist (Canonical Host)

Use this checklist immediately after deploys to confirm the **canonical LAN server** matches `main` and the routing contract is enforced.

## Targets

Replace `<CANONICAL_IP>` with the value from `docs/ops/canonical-host.md`.

## Server-side verification (run on the server)

```bash
# 1) Health (must be 200, ok:true)
curl -sS http://localhost:80/api/health

# 2) Build info (must include git_sha matching main)
curl -sS http://localhost:80/api/health/build

# 3) SSE notifications (must be 200 with text/event-stream)
curl -sS -i --max-time 5 http://localhost:80/api/notifications/stream | head -n 20

# 4) Conversations list (200, empty list is OK)
curl -sS "http://localhost:80/api/conversations?limit=1&offset=0"
```

## LAN client verification (run from any LAN machine)

```bash
# 1) HTTPS Health
curl -sSk https://akior.local/api/health

# 2) HTTPS Build (git_sha must match main)
curl -sSk https://akior.local/api/health/build

# 3) HTTP redirect check (expect 301/308 to https://akior.local)
curl -sI http://akior.local | head -n 5

# 4) SSE notifications (text/event-stream)
curl -sSk -i --max-time 5 https://akior.local/api/notifications/stream | head -n 20

# 5) Conversations list
curl -sSk "https://akior.local/api/conversations?limit=1&offset=0"
```

## Expected output (minimum)

### /api/health
```json
{"ok":true,...}
```

### /api/health/build
```json
{"ok":true,"git_sha":"<SHA>","build_time":"<ISO>",...}
```

### /api/notifications/stream (headers)
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
X-Accel-Buffering: no
```

### /api/conversations?limit=1&offset=0
```json
{"ok":true,"conversations":[],"total":0,"limit":1,"offset":0}
```

## Routing contract sanity check

Ensure the reverse proxy **does not strip** `/api`:
- Caddy must use `handle /api/* { reverse_proxy server:1234 }`
- **Do NOT** use `uri strip_prefix /api` or `handle_path /api/*`
