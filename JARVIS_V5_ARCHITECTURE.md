# Jarvis V5 OS – Architecture Overview

Jarvis V5 OS is a local AI operating system. It provides a Jarvis assistant UI, the Holomat radial UI with an interactive apps deck, 3D tooling, camera and security dashboards, and chat. The system runs fully locally with a Fastify backend (TLS + Socket.IO) and a Next.js 14 frontend, with shared TypeScript packages for settings and types.

---

## High-Level System Diagram (text)

- Browser (Next.js app)
  - connects to → HTTPS Dev Proxy (mkcert)
    - listens on: https://localhost:3000
    - forwards to:
      - Next.js dev server: http://localhost:3001
      - Fastify HTTPS API + Socket.IO: https://localhost:1234
- Shared code used by both:
  - packages/shared → types + settings model

```
[Browser] ──HTTPS──> [:3000 Dev TLS Proxy]
   │                        ├─> [:3001 Next.js dev]
   └──HTTPS/WS──────────────└─> [:1234 Fastify (TLS) + Socket.IO]
                     ▲
                     └── uses shared types/settings from packages/shared
```

---

## Directory Layout (key folders)

- `apps/server`
  - Fastify HTTPS server entrypoint (`src/index.ts`), Socket.IO namespaces, and HTTP routes (e.g., `3dprint.routes.ts`, `keys.routes.ts`, `settings` endpoints). Secret/key storage and TLS config are handled here for local development.
- `apps/web`
  - Next.js 14 (App Router) UI: routes like `/menu`, `/jarvis`, `/holomat`, `/3dmodel`, `/3dViewer`, `/3dprinters`, `/chat`, `/camera`, `/files`, `/functions`, `/security`, `/settings`.
  - Holomat UI and apps deck components (radial launcher, draggable app windows), Jarvis assistant components, and 3D model viewer.
  - Dev scripts: `scripts/mkcert-dev.mjs` (mkcert helper) and `dev-proxy.mjs` (HTTPS proxy that fans out to Next and the API).
- `packages/shared`
  - Shared types and settings model consumed by both server and web (e.g., `settings.ts`, common helpers).
- `packages/tools`
  - Helper tools/placeholder package (documented; content may be minimal at this snapshot).
- `packages/ui-kit`
  - UI kit docs/placeholders for future shared UI components.
- `infra`
  - Local TLS artifacts and helpers (e.g., `infra/certs` for localhost cert/key used by the dev proxy and server during development).
- `assets` and `Screenshots`
  - Static assets and reference images/screenshots used by the project and docs.

---

## Runtime Flows

### Settings Flow
- UI boot → `apps/web` loads settings via shared helpers/types from `packages/shared` → Fastify server endpoint returns current settings (from local settings store, e.g., `settings.json`) → UI applies settings.

### Holomat Flow
- User navigates to `/holomat` → Holomat page renders the grid and radial AppLauncher → clicking an app card opens a draggable window (e.g., Clock, Calendar, Calculator, Model Viewer/Creator, Files, Security).

### 3D Tooling Flow
- User selects or generates a model → 3D Viewer displays it in the browser → server routes handle file library and (where applicable) print-related actions.

---

## Local Development (Windows)

1) Install dependencies

```bash
npm install
```

2) Start the full dev environment (TLS proxy + Next + server)

```bash
npm start
```

- Dev TLS proxy: https://localhost:3000 → forwards to Next (:3001) and API (:1234)
- Open:
  - Main UI: https://localhost:3000
  - Jarvis dashboard: https://localhost:3000/jarvis
  - Holomat: https://localhost:3000/holomat

Notes: On first run, mkcert may install a local CA; logs will show proxy/server startup and TLS usage.

---

## Versioning & Tags

- `v5.0.0` marks the initial working snapshot with the Holomat apps deck visible and functional.
- Future tagged releases (v5.1.0, v5.2.0, …) should be created when major features stabilize.
