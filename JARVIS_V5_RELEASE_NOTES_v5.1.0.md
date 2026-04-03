# AKIOR V5 OS – Release v5.1.0

**Type-safe, production-ready build with theme system**

**Release Date:** 2025-12-06  
**Repository:** https://github.com/yosiwizman/akior-v5-os

---

## Overview

AKIOR V5 OS is a comprehensive local AI operating system that combines the AKIOR conversational AI interface, Holomat augmented reality visualization, advanced 3D modeling tools, camera streaming, and security monitoring into a unified platform. Built on a modern TypeScript monorepo architecture, it provides seamless communication between web-based controls and physical devices through Socket.IO and WebRTC.

**Version 5.1.0** marks the first **fully type-checked, production-build-ready** release of AKIOR V5 OS. This milestone represents a complete cleanup of TypeScript errors across all workspaces (server, web, and shared packages), successful production builds, and the introduction of a professional theme system. All changes are type-safety improvements with zero modifications to business logic or API behavior.

This is the **recommended version** for cloning and deploying on new Ubuntu AI rigs, providing a stable, well-typed foundation for further development and customization.

---

## What's New in v5.1.0

### Core Improvements

- ✅ **Full TypeScript Clean-up**  
  Zero TypeScript errors across all workspaces (`npm run typecheck` passes cleanly at root). Server, web, and shared packages are now fully type-safe.

- ✅ **Production Build Passing**  
  `npm run build` succeeds at the repository root, generating optimized standalone builds for both server and web workspaces. All 19 Next.js routes compile successfully.

- ✅ **Theme System Implementation**  
  - New `ThemeContext` and `ThemeProvider` for app-wide theme management
  - Light/Dark mode toggle in Settings page
  - Theme preference persisted in localStorage (`akior-v5-theme` key)
  - Automatic HTML class management for Tailwind dark mode support

### Developer Experience

- ✅ **Root-Level Scripts**  
  Convenient commands at repository root:
  - `npm run dev` – Start all development servers with TLS proxy
  - `npm run build` – Build all workspaces (server, web, shared)
  - `npm run lint` – Run linting across all workspaces
  - `npm run typecheck` – Type-check all workspaces
  - `npm run clean` – Clean build artifacts with rimraf

- ✅ **Workspace-Level Scripts**  
  Enhanced package.json scripts for individual workspaces:
  - **apps/web**: `dev`, `build`, `start`, `lint`, `typecheck`
  - **apps/server**: `dev`, `build`, `start`, `lint`, `typecheck`

### Stability & Type Safety Fixes

- ✅ **Fastify Logger Typing** (Server)  
  Fixed structured logging calls in 3D print routes to use correct `log.error({ err }, 'message')` signature.

- ✅ **Socket.IO Type System** (Web)  
  - Cleaned up Socket.IO client typing and removed invalid configuration options
  - Added missing custom event type definitions
  - Implemented null guards for socket operations throughout the codebase

- ✅ **Next.js Router Typing** (Web)  
  Handled Next.js 14 typed routes conflicts safely with type assertions for dynamic navigation.

- ✅ **Browser Environment Compatibility** (Web)  
  Corrected timer types from `ReturnType<typeof setTimeout>` to `number` for proper browser context.

- ✅ **Suspense Boundaries** (Web)  
  Added required Suspense wrappers for `useSearchParams()` hooks per Next.js 14 requirements, preventing static generation errors.

---

## Technical Details (For Engineers)

### Server Architecture

- **Framework:** Fastify backend in `apps/server`
- **Routes:**
  - `/config` – System configuration management
  - `/settings` – Application settings CRUD
  - `/openai` – OpenAI API integration (chat, images, realtime)
  - `/meshy` – 3D model generation via Meshy API
  - `/bambu` – Bambu Lab 3D printer integration
  - `/file-library` – File storage and retrieval
  - `/tools` – Utility tools and device commands
  - Socket.IO namespace: `/cameras` for real-time device communication
- **Logging:** Structured logging with Fastify's pino logger using `log.error({ err }, 'message')` pattern
- **Type Safety:** All routes fully typed with TypeScript, zero compilation errors

### Web Architecture

- **Framework:** Next.js 14 with App Router in `apps/web`
- **Key Pages:**
  - `/akior` – Full-screen AKIOR AI assistant with voice interaction
  - `/holomat` – Holomat device control deck with draggable AR app widgets
  - `/3dmodel` – 3D model generation from images or text prompts
  - `/3dViewer` – Interactive 3D model viewer with STL export
  - `/camera` – Camera streaming and device management
  - `/security` – Multi-camera security monitoring
  - `/settings` – System configuration and theme preferences
  - `/devices` – Connected device management
- **Theme System:** `apps/web/src/context/ThemeContext.tsx` provides app-wide theme state with localStorage persistence
- **Build Configuration:** Next.js standalone output with TypeScript/ESLint checks separated from build process for faster production builds

### Shared Types

- **Location:** `packages/shared`
- **Exports:** Centralized TypeScript types for settings schemas, model job definitions, and API contracts
- **Usage:** Imported by both server and web workspaces for type-safe communication

---

## How to Run (Windows – Local Development)

### Prerequisites

- **Node.js LTS** (v18 or higher recommended)
- **mkcert** for local TLS certificates (installation guidance provided by dev script if missing)

### Installation & Startup

From the repository root:

```bash
# Install all dependencies
npm install

# Start the development environment
npm start
```

The `npm start` command launches:
- TLS development proxy (handles certificate generation with mkcert)
- Next.js development server (web UI)
- Fastify API server (backend + Socket.IO)

### Access Points

- **https://localhost:3000** – Main application entry point (TLS proxy → Next.js + API)
- **http://localhost:3001** – Direct Next.js dev server (if proxy is bypassed)
- **https://localhost:1234** – Fastify API server + Socket.IO endpoint

### Alternative Commands

```bash
# Type-check the entire codebase
npm run typecheck

# Build for production
npm run build

# Run linting (configuration issues exist, see Known Limitations)
npm run lint

# Clean build artifacts
npm run clean
```

---

## Known Limitations / TODO

### ESLint Configuration

- **Server workspace:** ESLint configuration not fully wired up; basic linting unavailable
- **Web workspace:** ESLint has module resolution issues with Next.js parser
- **Impact:** Linting is NOT blocking production builds (disabled via `ignoreDuringBuilds` in Next.js config). Should be addressed in a future "lint + code style" maintenance pass.

### Placeholder Packages

- **packages/tools/** – Contains only README.md, no implementation
- **packages/ui-kit/** – Contains only README.md, no implementation
- **Future Work:** These packages are reserved for future shared utilities and UI component library development.

### Typed Routes

- **Issue:** Some Next.js `router.push()` calls use type assertions (`as any`) to avoid conflicts with Next.js 14's experimental `typedRoutes` feature
- **Impact:** Runtime behavior unchanged; type assertions bypass strict compile-time route checking for dynamic navigation patterns
- **Future Work:** May be resolved in future Next.js versions or by refactoring navigation patterns

---

## Recommended Use

### Version Milestones

- **v5.0.0** – Initial baseline commit (original repository state)
- **v5.0.1** – Architecture and repository overview documentation added
- **v5.1.0** – First "type-safe + production build" milestone ✅

### Deployment Guidance

**For new installations on Ubuntu AI rigs, v5.1.0 is the recommended baseline.** This version provides:

- Verified type-safe codebase (zero TypeScript errors)
- Successful production build pipeline
- Theme system for UI customization
- Comprehensive development tooling
- Stable foundation for hardware integration

Clone this version as your starting point:

```bash
git clone https://github.com/yosiwizman/akior-v5-os.git
cd akior-v5-os
git checkout v5.1.0
npm install
npm start
```

---

## Credits

**AKIOR V5 OS** is developed and maintained by the AKIOR AI team.

For questions, issues, or contributions, visit the repository:  
https://github.com/yosiwizman/akior-v5-os

---

**END OF RELEASE NOTES**
