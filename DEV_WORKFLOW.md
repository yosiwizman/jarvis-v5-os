# Jarvis V5 Development Workflow

This document explains how we manage code changes, CI, and releases for the Jarvis V5 OS repository.

---

## 1. Current Mode: Solo Dev, Direct-to-Main

### How It Works

Jarvis V5 currently uses a **direct-to-main workflow** optimized for a single primary developer:

- **Local feature branches** are used during development (e.g., `feature/v5-theme-backgrounds`, `feature/v5-web-search-integration`)
- **Local merges** happen on the developer's machine (not on GitHub)
- **Only `main` is pushed** to GitHub, along with version tags like `v5.2.0`, `v5.3.0`, `v5.4.0`
- **GitHub Actions CI** runs automatically on every push to `main` via the `Jarvis V5 CI` workflow
- **No pull requests** are created on GitHub — all merge decisions happen locally

### CI Pipeline

Every push to `main` triggers `.github/workflows/jarvis-ci.yml`, which runs:

1. `npm install` — Install dependencies
2. `npm run typecheck` — TypeScript compilation (0 errors expected)
3. `npm run build` — Production build (19 routes expected)
4. `npm run ci:smoke` — Smoke tests (8/8 checks expected)

If CI fails, the developer fixes issues locally and pushes again. The GitHub commit history shows a linear sequence of commits with green CI badges.

### When This Is Okay

Direct-to-main works well when:

- **Single owner / single primary developer** — One person makes all decisions
- **High trust in CI** — Strong automated testing catches issues before push
- **Fast iteration priority** — Speed matters more than formal code review
- **Personal project or early-stage startup** — Team size doesn't justify PR overhead

### Example Flow

```bash
# Create a local feature branch
git checkout -b feature/v5-local-llm

# Make changes, commit locally
git add .
git commit -m "feat(v5): add Local LLM integration"

# Run quality checks locally
npm run typecheck
npm run build
npm run ci:smoke

# Merge to main locally
git checkout main
git merge --no-ff feature/v5-local-llm

# Push to GitHub (triggers CI)
git push origin main

# Tag release after CI passes
git tag -a v5.4.0 -m "Jarvis V5.4.0 – Local LLM & Web Search"
git push origin v5.4.0
```

---

## 2. Future Mode: PR-Driven Workflow (For a Larger Team)

### When to Switch to PRs

As the team grows or when you start accepting external contributions, switch to a **pull request (PR) workflow**:

- **Multiple developers** working on different features simultaneously
- **External contributors** submitting changes from forks
- **Need for code review** with discussion threads and approval tracking
- **Stronger safety** around production changes with branch protection

### Recommended Setup

#### Step 1: Enable Branch Protection

On GitHub, configure `main` branch protection:

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - ☑️ **Require a pull request before merging**
   - ☑️ **Require status checks to pass before merging**
     - Add: `Jarvis V5 CI` (from `.github/workflows/jarvis-ci.yml`)
   - ☑️ **(Optional) Require approvals** — Set to 1 for small teams, 2+ for larger teams
   - ☑️ **Require linear history** — Prevents messy merge commits
4. Save changes

#### Step 2: Branch Naming Convention

Use consistent branch names for easy filtering:

- **`feature/...`** — New features (e.g., `feature/v5-spotify-integration`)
- **`fix/...`** — Bug fixes (e.g., `fix/camera-stream-timeout`)
- **`release/...`** — Release preparation (e.g., `release/v5.5.0`)
- **`docs/...`** — Documentation updates (e.g., `docs/update-readme`)

#### Step 3: PR Workflow

```bash
# Create a branch for your change
git checkout -b feature/v5-spotify-integration

# Make changes, commit regularly
git add .
git commit -m "feat(v5): add Spotify integration UI"

# Push branch to GitHub
git push origin feature/v5-spotify-integration

# Open a PR on GitHub:
# - Base: main
# - Compare: feature/v5-spotify-integration
# - Add description, screenshots, testing notes

# CI runs automatically on the PR
# Wait for green checkmarks

# Request review (if team has multiple members)
# Address feedback, push additional commits

# Once approved and CI is green, merge:
# - Prefer "Squash and merge" for clean history
# - Or "Rebase and merge" if commit history is already clean
# - Avoid "Merge commit" to prevent clutter

# Delete the branch after merging
```

#### Step 4: Merge Strategy

**Recommended:** **Squash and merge** (default for most PRs)

- Combines all commits in the PR into a single commit on `main`
- Keeps history clean and easy to navigate
- Good for features with many small "work-in-progress" commits

**Alternative:** **Rebase and merge** (for well-structured PRs)

- Replays PR commits on top of `main` without a merge commit
- Keeps individual commit messages
- Use when PR commits are already clean and meaningful

**Avoid:** **Merge commit** (creates clutter)

- Adds an extra "Merge branch..." commit
- Makes history harder to read
- Only use for special cases (e.g., merging long-lived branches)

### Example PR Workflow

```bash
# Developer A: Create feature branch
git checkout -b feature/v5-gmail-integration
git push origin feature/v5-gmail-integration

# Developer A: Open PR on GitHub
# Title: "feat(v5): add Gmail integration"
# Description: "Adds Gmail API client, settings UI, and inbox widget"

# CI runs automatically
# ✅ Typecheck: passed
# ✅ Build: passed
# ✅ Smoke tests: 8/8 passed

# Developer B: Review PR
# - Leave comments on code
# - Request changes or approve

# Developer A: Address feedback
git add .
git commit -m "fix: handle Gmail API rate limits"
git push origin feature/v5-gmail-integration

# CI runs again on updated PR
# ✅ All checks pass

# Developer B or A: Merge PR via GitHub UI
# - Click "Squash and merge"
# - Edit commit message if needed
# - Confirm merge

# GitHub automatically:
# - Merges to main
# - Runs CI on main
# - Closes the PR
# - Optionally deletes the branch
```

---

## 3. Tagging and Releases

### Current Tagging Strategy

Jarvis V5 uses **semantic versioning** with tags for each release:

- **Format:** `vMAJOR.MINOR.PATCH` (e.g., `v5.0.0`, `v5.2.0`, `v5.4.0`)
- **When to tag:** After a successful release commit on `main` with CI passing
- **Where to document:** Create a release notes file like `JARVIS_V5_RELEASE_NOTES_v5.4.0.md`

### Versioning Guidelines

- **Major version (v6.0.0):** Breaking changes, major architecture overhaul
- **Minor version (v5.5.0):** New features, backward-compatible changes
- **Patch version (v5.4.1):** Bug fixes, documentation updates

### Release Process

#### Direct-to-Main (Current)

```bash
# Ensure main is clean and CI is green
git checkout main
npm run typecheck && npm run build && npm run ci:smoke

# Create release notes
# (e.g., JARVIS_V5_RELEASE_NOTES_v5.5.0.md)

# Commit release notes
git add .
git commit -m "release(v5): add v5.5.0 release notes"
git push origin main

# Wait for CI to pass on GitHub

# Create annotated tag
git tag -a v5.5.0 -m "Jarvis V5.5.0 – Brief description"

# Push tag to GitHub
git push origin v5.5.0

# Optional: Create GitHub Release
# - Go to Releases → Draft a new release
# - Choose tag: v5.5.0
# - Add release notes summary
# - Publish release
```

#### PR-Based Workflow (Future)

```bash
# Create release branch
git checkout -b release/v5.5.0

# Bump version numbers, update docs
# (e.g., JARVIS_V5_RELEASE_NOTES_v5.5.0.md)

# Commit changes
git add .
git commit -m "release(v5): prepare v5.5.0"
git push origin release/v5.5.0

# Open PR: release/v5.5.0 → main
# Title: "Release v5.5.0"

# CI runs, team reviews

# Merge PR via GitHub (CI must be green)

# After merge, pull latest main locally
git checkout main
git pull origin main

# Create annotated tag
git tag -a v5.5.0 -m "Jarvis V5.5.0 – Brief description"

# Push tag to GitHub
git push origin v5.5.0

# Create GitHub Release (same as above)
```

### Release Notes

Every release should have a corresponding release notes file:

- **Filename:** `JARVIS_V5_RELEASE_NOTES_vX.Y.Z.md`
- **Location:** Repository root
- **Contents:**
  - Summary of changes
  - What's new in this version
  - How to run/test
  - Known limitations
  - Migration notes (if applicable)

**Example:** See `JARVIS_V5_RELEASE_NOTES_v5.4.0.md` for reference.

---

## 4. CI Expectations

### Quality Gates

Every change (code or docs) must pass three quality gates:

1. **TypeScript compilation:** `npm run typecheck`
   - Expected: 0 errors
   - Checks: Type safety across all packages

2. **Production build:** `npm run build`
   - Expected: All packages build successfully
   - Checks: Next.js routes (19 expected), server compilation, shared types

3. **Smoke tests:** `npm run ci:smoke`
   - Expected: 8/8 checks pass
   - Checks:
     - 5 page routes (Home, Settings, Chat, Menu, Holomat)
     - 3 API endpoints (System metrics, 3D print status, Web search)

### CI Configuration

The CI pipeline is defined in `.github/workflows/jarvis-ci.yml`:

```yaml
name: Jarvis V5 CI

on:
  push:
    branches:
      - main
      - 'feature/**'
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm run ci:smoke
```

### When CI Runs

- **Direct-to-main (current):** On every push to `main`
- **PR-based (future):** On every push to PR branches + on merge to `main`

### If CI Fails

**Direct-to-main:**
1. Check GitHub Actions logs for errors
2. Fix issues locally
3. Run `npm run typecheck && npm run build && npm run ci:smoke` locally
4. Commit fixes
5. Push to `main` (CI runs again)

**PR-based:**
1. Check GitHub Actions logs on the PR
2. Fix issues locally
3. Run quality gates locally
4. Commit fixes
5. Push to PR branch (CI runs again on PR)
6. Merge only when CI is green

### Running CI Locally

Before pushing, run all quality gates locally to catch issues early:

```bash
# Run all checks in sequence
npm run typecheck && npm run build && npm run ci:smoke

# Or run individually:
npm run typecheck   # TypeScript compilation
npm run build       # Production build
npm run ci:smoke    # Start system, run smoke tests, stop system
```

**Note:** `npm run ci:smoke` starts the full stack (Next.js + Fastify), runs tests, then stops everything. It takes ~60-90 seconds.

---

## Summary

### Current Workflow (Direct-to-Main)

✅ **Works for:** Solo developer, fast iteration, high CI trust  
✅ **Process:** Local branches → local merge → push to `main` → CI runs → tag release  
✅ **CI:** Automatic on every push to `main`

### Future Workflow (PR-Based)

✅ **Works for:** Multiple developers, code review, external contributors  
✅ **Process:** Feature branch → push to GitHub → open PR → CI runs → review → merge → tag release  
✅ **CI:** Automatic on every PR push + every merge to `main`  
✅ **Protection:** Branch rules require CI to pass before merge

### Both Workflows

✅ **Tagging:** Semantic versioning (`v5.x.x`) after successful releases  
✅ **Release Notes:** Document every version in `JARVIS_V5_RELEASE_NOTES_vX.Y.Z.md`  
✅ **Quality Gates:** TypeScript, build, smoke tests must pass  
✅ **CI Config:** `.github/workflows/jarvis-ci.yml` (unchanged between workflows)

---

## 5. Notification & Event Loop Subsystem (v6.0 Foundation)

### Overview

As of **feature/v6-notification-foundation**, Jarvis V5 OS includes the foundational infrastructure for an internal notification and event scheduling system. This subsystem is designed to support future features like calendar reminders, printer alerts, security camera notifications, and system updates.

### Current Status: Foundation Only

**What's Implemented:**
- ✅ **Shared Types** (`packages/shared/src/notifications.ts`)
  - `Notification`, `ScheduledEvent`, `ScheduleNotificationRequest` types
  - Support for notification types: calendar_reminder, printer_alert, camera_alert, system_update, integration_error, custom
- ✅ **Backend Scheduler** (`apps/server/src/notificationScheduler.ts`)
  - Event storage in JSON file (`data/scheduled-events.json`)
  - Event loop checking every 60 seconds for due events
  - SSE client management for real-time notification delivery
  - Singleton `notificationScheduler` instance ready for integration

**Not Yet Implemented:**
- ⏳ Backend API endpoints (`POST /api/notifications/schedule`, `GET /api/notifications/stream`)
- ⏳ Frontend NotificationProvider (React context with SSE subscription)
- ⏳ NotificationToast component for displaying notifications
- ⏳ Integration into root layout
- ⏳ Smoke tests for notification scheduling and delivery

### Architecture

**Event Flow:**
1. External system (calendar, printer, camera, etc.) schedules a notification via API
2. Scheduler stores event with `triggerAt` ISO timestamp in JSON file
3. Event loop checks every minute for events where `triggerAt <= now`
4. When due, event fires and broadcasts to all connected SSE clients
5. Frontend receives notification via SSE stream and displays toast

**Storage:**
- File: `apps/server/data/scheduled-events.json`
- Format: Array of `ScheduledEvent` objects with `fired` boolean flag
- Persistence: Events persist across server restarts

**Event Loop:**
- Check interval: 60 seconds
- Startup behavior: Loads events from disk, fires any overdue events immediately
- Shutdown behavior: Stops interval timer cleanly

### Next Steps for v6.0 Completion

To complete the notification system, future development should:

1. **Add Backend Endpoints** (in `apps/server/src/index.ts`):
   ```typescript
   // Initialize scheduler on startup
   await notificationScheduler.initialize();
   
   // POST /api/notifications/schedule
   // GET /api/notifications/stream (Server-Sent Events)
   ```

2. **Create Frontend Components**:
   - `apps/web/context/NotificationContext.tsx` - React context + SSE subscription
   - `apps/web/components/NotificationToast.tsx` - Toast display component
   - Wrap root layout with `NotificationProvider`

3. **Add Tests**:
   - Smoke test for scheduling endpoint (returns 200 + eventId)
   - Smoke test for event delivery (schedule event 2s in future, verify SSE receipt)
   - Update `scripts/smoke.ts` with notification checks

4. **Integration Examples**:
   - Calendar: Schedule event reminders when syncing Google Calendar events
   - Printers: Fire alerts when print job completes or fails
   - Security: Notify when camera detects motion
   - System: Alert on available updates or low disk space

### Foundation Files

- **Types:** `packages/shared/src/notifications.ts` (71 lines)
- **Scheduler:** `apps/server/src/notificationScheduler.ts` (262 lines)
- **Documentation:** This section in `DEV_WORKFLOW.md`

### Design Decisions

- **Why SSE over WebSocket?** Simpler for one-way server→client push, no need for bidirectional communication
- **Why JSON file storage?** Sufficient for MVP, easy to debug, no DB dependency. Can migrate to SQLite/Postgres later
- **Why 60-second intervals?** Balances responsiveness with server load; minute-level precision is sufficient for most use cases
- **Why internal-only?** No external notification services (email, SMS, push) yet — focus on in-app notifications first

---

## References

- **CI Workflow:** `.github/workflows/jarvis-ci.yml`
- **Release Notes:** `JARVIS_V5_RELEASE_NOTES_v5.4.0.md` (example)
- **Test Plan:** `JARVIS_V5_TEST_PLAN.md`
- **Repository Overview:** `JARVIS_V5_REPO_OVERVIEW.md`
- **Notification Foundation:** `packages/shared/src/notifications.ts`, `apps/server/src/notificationScheduler.ts`

For questions or workflow improvements, open an issue or discussion on GitHub.
