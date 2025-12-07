# Jarvis V5 OS – Repo Overview

This document is your single source of truth for understanding, versioning, and managing the Jarvis V5 OS repository. It's designed for Mr W (the owner) and future collaborators who need to understand how this codebase is organized and how to work with versions and releases.

---

## What this repo contains

**Jarvis V5 OS** is a local AI operating system that runs entirely on your machine. It includes:

- **Jarvis AI Assistant** – Voice and UI-based assistant with chat and function calling
- **Holomat Apps Deck** – Radial UI launcher with interactive app cards (Clock, Calendar, Calculator, 3D Creator/Viewer, Files, Security, and more)
- **3D Tools** – Model creation, viewing, and printing integration
- **Camera & Security Dashboard** – Local camera monitoring and security controls
- **Local Backend + Frontend** – Fastify HTTPS server (with TLS + Socket.IO) and Next.js 14 frontend UI

Everything runs locally with secure HTTPS via mkcert and a dev TLS proxy.

**For detailed technical architecture**, see `JARVIS_V5_ARCHITECTURE.md` in this repo.

**For Ubuntu shell integration and kiosk mode**, see `JARVIS_V5_UBUNTU_SHELL_PLAN.md` for the architecture and migration plan.

---

## Folder map (high level)

Here's what each major folder does:

- **`apps/server/`** – Fastify API server with Socket.IO, settings management, and API routes (3D printing, keys, etc.)
- **`apps/web/`** – Next.js 14 UI with all pages: Jarvis dashboard, Holomat, 3D viewer, chat, camera, security, settings, etc.
- **`packages/shared/`** – Shared TypeScript types and settings used by both server and web
- **`assets/`** and **`Screenshots/`** – UI assets, images, and reference screenshots
- **`infra/`** – TLS certificates, dev proxy scripts, and local infrastructure helpers

---

## Branch and version model

This repo uses a simple and clear versioning approach:

### What is `main`?

- **`main`** is the latest development snapshot. It contains the most recent work and may include new features, fixes, or experiments.
- `main` is always moving forward as we build new capabilities.

### What are version tags?

- **Version tags** (like `v5.0.0`, `v5.1.0`, `v5.2.0`, `v5.3.0`, `v5.4.0`, `v5.5.0`) are **frozen restore points**.
- Each tag represents a specific, stable state of the codebase that has been tested and confirmed working.
- Tags never change. Once created, a tag like `v5.0.0` always points to the exact same code.

### Why use tags?

- **To mark milestones**: When a set of features is complete and stable, we tag it (e.g., `v5.0.0`).
- **To roll back if needed**: If something breaks on `main`, you can always go back to a known-good tagged version.
- **To track history**: Tags make it easy to see what was included in each release.

---

## What's in v5.0.0 (our first baseline)

**`v5.0.0`** is the initial frozen baseline of Jarvis V5 OS. This tag includes:

- ✅ **Holomat apps deck** visible and clickable with radial layout
- ✅ **App windows** open and are draggable (Clock, Calendar, Calculator, Creator, Viewer, Files, Security)
- ✅ **Settings system** working (server-side storage, UI loads settings on startup)
- ✅ **Full local HTTPS setup** with mkcert + dev TLS proxy
- ✅ **Jarvis UI, chat, camera, 3D tools** all wired and functional
- ✅ **Architecture documentation** (`JARVIS_V5_ARCHITECTURE.md`) committed and pushed

This is your **"last known good"** state. If anything goes wrong in future development, you can always return to `v5.0.0`.

---

## Version History

Here's a summary of each major version released:

- **v5.0.0** (June 2025) – Initial baseline: Holomat, Jarvis UI, 3D tools, camera/security, local HTTPS
- **v5.2.0** (November 2025) – Theming system, HUD with live metrics, Weather integration, Integrations cockpit
- **v5.3.0** (November 2025) – Web Search integration (Tavily, SerpAPI support)
- **v5.4.0** (December 2025) – Local LLM integration (Ollama, custom HTTP, intelligent routing with fallback)
- **v5.5.0** (December 2025) – ElevenLabs TTS integration (voice playback for assistant messages)
- **v5.6.0** (December 2025) – Azure TTS integration (multi-provider TTS architecture with ElevenLabs + Azure)
- **v5.7.0** (December 2025) – Spotify integration (Client Credentials Flow, backend track search endpoint, Settings configuration card)
- **v5.8.0** (December 2025) – Gmail integration skeleton (OAuth2 refresh token config, backend test endpoint, Settings card, CI smoke test)
- **v5.9.0** (December 2025) – Google Calendar integration skeleton (OAuth2 refresh token config, upcoming events fetch endpoint, Settings card with calendar ID, CI smoke test)

For detailed release notes, see `JARVIS_V5_RELEASE_NOTES_v5.X.0.md` files in the repository root.

---

## How we cut a new version

When a set of changes has been tested and is stable, the CTO (or owner) can create a new version tag. Here's the conceptual process:

1. **Confirm stability**: Make sure all features work, tests pass, and there are no critical bugs.
2. **Decide the version number**:
   - **Patch release** (bug fixes, small tweaks): `v5.3.1`, `v5.3.2`
   - **Minor release** (new features, backwards-compatible): `v5.4.0`, `v5.5.0`
   - **Major release** (big changes, breaking changes): `v6.0.0`
3. **Create the tag**: The CTO will run a command like this from the repo root:

   ```bash
   git tag -a v5.0.1 -m "Add security dashboard improvements and bug fixes"
   git push origin v5.0.1
   ```

   *(These commands are examples for human use, not for the AI agent to run.)*

4. **Optional**: Write a short release note describing what's new in `RELEASE_NOTES.md` or in the tag message itself.

Once the tag is pushed, **that version is frozen forever**. You can always return to it.

---

## How to roll back to a previous version (conceptual)

If something breaks on `main` and you need to go back to a stable version, here's how it works:

### To inspect or run an old version:

```bash
git checkout v5.0.0
npm install
npm start
```

This checks out the exact code from `v5.0.0` and lets you run it locally.

### To create a new branch from an old version (for hotfixes):

```bash
git checkout -b hotfix-v5.0.1 v5.0.0
# Make your fix, then commit and tag as v5.0.1
```

This creates a new branch starting from `v5.0.0`, so you can fix a critical bug without pulling in new development from `main`.

### To reset `main` to an old version (rare, use with caution):

```bash
git reset --hard v5.0.0
git push --force origin main
```

**Warning**: This erases all commits after `v5.0.0`. Only do this if you're certain you want to discard recent work.

*(All commands above are examples for humans, not for the AI agent to execute.)*

---

## Release checklist for each new version

Before creating a new version tag, make sure you've checked these items:

- [ ] **Local smoke test**: Run `npm install` and `npm start` successfully
- [ ] **UI loads correctly**: Open `https://localhost:3000`, `/jarvis`, and `/holomat` – no crashes or white screens
- [ ] **No critical console errors**: Check browser DevTools console for red errors
- [ ] **Holomat apps open and close**: Click at least 2-3 app cards and verify windows work
- [ ] **Settings load**: Confirm settings are fetched from the server on startup
- [ ] **Architecture doc is current**: `JARVIS_V5_ARCHITECTURE.md` still matches reality
- [ ] **This overview doc is current**: `JARVIS_V5_REPO_OVERVIEW.md` reflects any process changes
- [ ] **Version tag created and pushed**: Tag is created with a clear message and pushed to GitHub

Once all items are checked, the new version is ready to be tagged and released.

---

## Quick dev reminder

To run Jarvis V5 OS locally:

```bash
npm install
npm start
```

**What this does:**
- Installs all dependencies for the monorepo (server, web, shared packages)
- Starts the dev TLS proxy at `https://localhost:3000`
- Starts Next.js dev server at `http://localhost:3001`
- Starts Fastify API + Socket.IO server at `https://localhost:1234`
- Uses mkcert for local HTTPS certificates

**Where to go:**
- Main UI: `https://localhost:3000`
- Jarvis dashboard: `https://localhost:3000/jarvis`
- Holomat: `https://localhost:3000/holomat`

If you see certificate warnings on first run, mkcert may need to install the local CA (this is normal and safe for local development).

---

## Summary

**Key points to remember:**

- **`main`** = latest development snapshot (always moving forward)
- **Version tags** (e.g., `v5.0.0`, `v5.0.1`) = frozen restore points you can always return to
- **`v5.0.0`** is your first stable baseline with Holomat, Jarvis UI, settings, 3D tools, and full local HTTPS
- **To cut a new version**: Test thoroughly, create a tag with `git tag -a`, and push it
- **To roll back**: Use `git checkout <tag>` to inspect or run old versions
- **Before each release**: Complete the release checklist above

This document is designed to be simple and practical. For deep technical details, see `JARVIS_V5_ARCHITECTURE.md`.

**This file is now ready for the CTO to commit and push.**
