# Repository Governance

This document describes the development workflow and policies for the AKIOR V5 repository.

## Branching Model

- **`main`** - Production-ready code; protected branch.
- All changes to `main` must go through Pull Requests.
- Every working branch must map to an active merged entry in
  [`docs/governance/RESERVATIONS.md`](./governance/RESERVATIONS.md).
  No reservation = no branch.

### Branch Naming Convention

Supersedes the prior `feature/*` convention. `feature/*` is retained
only for unclassified one-offs and should be avoided for team work.

| Pattern | Use |
|---------|-----|
| `contract/<team>/<contract-name>-<nn>` | T1 edits to `packages/shared/**` or `apps/server/src/channels/registry.ts` type shape |
| `cp/<slice-id>-<short-description>-<nn>` | T2 control-plane slice (e.g. `cp/m-cp-1-founder-notification-sink-01`) |
| `ps/<slice-id>-<short-description>-<nn>` | T3 / T4 product-surface slice (e.g. `ps/m-ps-8-approval-inbox-01`) |
| `wrap/<channel-or-primitive>-<short-description>-<nn>` | T5 runtime thin wrapper work |
| `qa/<scope>-<short-description>-<nn>` | T6 e2e / contract / smoke additions |
| `sheriff/<change>-<nn>` | T7 governance / reservation / sheriff work |
| `research/<candidate>-<nn>` | T8 admission / research; must not mutate product |
| `codeql/<cluster>-<nn>` | Security patch clusters against a bounded surface |
| `fix/<scope>-<short-description>-<nn>` | Bounded bug fix, any team |
| `docs/<scope>-<short-description>-<nn>` | Docs-only change |
| `feature/<short-description>` | Legacy, unclassified one-offs only |

`<nn>` is a zero-padded per-lane index (`01`, `02`, …). One branch per
reservation. `cp/*` and its matching `ps/*` must cross-reference each
other in the PR body.

## Slice Taxonomy

All team work is classified under exactly one of these slice IDs:

| Tag | Meaning | Typical owner |
|-----|---------|---------------|
| `M-CP-<n>` | Control-plane mandatory slice | T2 |
| `M-PS-<n>` | Product-surface mandatory slice | T3 / T4 |
| `WRAP-<n>` | Runtime thin wrapper | T5 |
| `QA-<n>` | E2E / contract / smoke | T6 |
| `CONTRACT-<n>` | `packages/shared/**` or registry typeshape | T1 |
| `RESEARCH-<n>` | Admission / research; no code mutation | T8 |

The PR template requires a slice ID; the reservation ledger requires
one per entry.

## Required CI Checks

The following checks must pass before merging to `main`:

| Check | Description |
|-------|-------------|
| `Lint` | ESLint code quality (apps/web) |
| `Typecheck` | TypeScript type checking |
| `Build` | Production build verification |
| `Smoke Tests` | End-to-end smoke tests |
| `Secret Scan` | Gitleaks secret detection |
| `SCA (npm audit)` | Dependency vulnerability scan (critical level) |

### Informational Checks (non-blocking)
| Check | Description | Status |
|-------|-------------|--------|
| `CodeQL` | Static analysis | Skipped - requires GHAS for private repos |

## Local Development Commands

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Build all workspaces
npm run build

# Run smoke tests (requires server running)
npm run smoke

# Start development server
npm run dev
```

## Environment File Policy

**⚠️ NEVER commit `.env` files containing secrets.**

- Use `.env.example` files as templates
- Copy to `.env.local` for local development
- All `.env*` files (except `.env.example`) are gitignored
- Store production secrets in GitHub Secrets or your deployment platform

### Template Locations

- `apps/web/.env.example` - Frontend environment template
- `apps/server/.env.example` - Backend environment template

## Code Review Process

1. Create a feature branch from `main`
2. Make your changes with clear, atomic commits
3. Push and open a Pull Request
4. Ensure all CI checks pass
5. Request review from code owners (auto-assigned via CODEOWNERS)
6. Address review feedback
7. Merge after approval (squash or merge commit preferred)

## Release Process

1. All changes merged to `main` via PR
2. CI runs on every push to `main`
3. Manual tagging for version releases:
   ```bash
   git tag -a v<version> -m "Release v<version>"
   git push origin v<version>
   ```

## Security

- Dependabot monitors dependencies for vulnerabilities
- npm audit runs on every PR (reports critical/high vulnerabilities)
- Gitleaks prevents secret commits
- Report security issues privately to maintainers

### Known Security TODOs
- [x] ~~Upgrade Next.js to 14.2.35+ to resolve critical vulnerabilities~~ (Done)
- [x] ~~Make SCA a hard gate after Next.js upgrade~~ (Done)
- [ ] Enable GitHub Advanced Security for CodeQL (if plan allows)
- [ ] Address high-severity glob vulnerability when eslint-config-next updates

## Org-Launch Governance (8-team posture)

The sections below encode the current AKIOR engineering org posture.
They work together with [`docs/governance/RESERVATIONS.md`](./governance/RESERVATIONS.md)
and `.github/pull_request_template.md` and supersede any softer prior
guidance where they conflict.

### Merge Order and Dependency Rules

The following lane classes are **strictly serial** — at most one PR of
the class in flight at a time:

1. **Contract PRs** — any edit to `packages/shared/src/**` or the
   shape of `apps/server/src/channels/registry.ts`.
2. **Control-plane PRs** — any `M-CP-<n>` slice (T2).
3. **Any PR editing `apps/server/src/index.ts`** (wiring lines only;
   see Collision-Prevention Rules).
4. **Any PR editing `apps/web/app/settings/page.tsx`** (frozen until
   decomposed; see Collision-Prevention Rules).

Downstream UI (`M-PS-<n>`), wrapper (`WRAP-<n>`), inspector, and
wrapper-adjacent lanes may only open after the contract and/or
control-plane PR they depend on has merged. The canonical sequence
for a shared control-plane slice is:

1. T1 contract freeze (if the slice requires a shared-type change).
2. T2 `M-CP-<n>` control-plane slice.
3. T6 matching `QA-<n>` (e2e / contract spec).
4. T3 `M-PS-<n>` UI surface consuming (2).
5. T5 `WRAP-<n>` thin wrapper (if applicable).
6. T4 read-only inspector (if applicable).

T7 (merge sheriff) enforces squash merges and rebase-if-behind. No
merge commits. One slice = one squash commit on `main`.

### Collision-Prevention Rules

1. **Contract freeze.** Any PR editing `packages/shared/src/**` or
   `apps/server/src/channels/registry.ts` shape pauses all downstream
   coding lanes until it merges. T1 announces the freeze in the
   reservation ledger.
2. **Overlap rejection.** Two reservations whose `files_reserved` sets
   intersect are forced serial. No exceptions.
3. **Merge sheriff authority.** T7 may close any PR — even with green
   CI — if it violates a reservation, the contract freeze, or the
   founder-safe auth rule. T7 may not merge a PR with no reservation.
4. **Stale-base rejection.** A PR's `depends_on_sha` more than one
   merged PR behind `main` must rebase before merge.
5. **Hidden contract drift rejection.** A PR that edits files outside
   its reservation, or that edits `packages/shared/src/**` without a
   T1 freeze-ref, is rejected and must be resubmitted.
6. **Inline-route freeze in `apps/server/src/index.ts`.** No new
   `fastify.(get|post|patch|delete|put)` handlers may be added to
   `apps/server/src/index.ts`. All new routes must land as
   `apps/server/src/routes/*.routes.ts` + a
   `registerXxxRoutes(fastify)` call. `index.ts` may only be edited
   for plugin registration, startup init, and `registerXxxRoutes`
   wiring lines.
7. **Settings shell freeze in `apps/web/app/settings/page.tsx`.** No
   edits to this file until a decomposition plan is approved by the
   founder. New surfaces go to new `apps/web/app/settings/<domain>/page.tsx`
   folders (mirror of `/settings/assistant`, `/settings/channels`,
   `/settings/admission-candidates`).
8. **Research isolation.** `RESEARCH-<n>` reservations must not touch
   `apps/**`, `packages/**`, `.github/**`, `scripts/**`, or `e2e/**`.
   Violations are auto-closed by T7.

### Parallelism Cap (current)

Fixed by the current repo shape (`apps/server/src/index.ts` and
`apps/web/app/settings/page.tsx` remain large shared shells):

- **8 active teams now.**
- **1 active shared-contract coding lane** at a time.
- **Ceiling: at most 3 simultaneously-open coding PRs** across the
  org. Prep / proof / research / QA / non-colliding wrapper lanes are
  uncapped but still require a reservation.

Raising this ceiling requires an explicit follow-up governance lane
after the shell-decomposition gates close. Do not exceed this ceiling
without founder approval.

### Founder Approval Matrix

**Low-risk — approvable now** (founder assent tracked once per class by T7):

- T1 drafting a contract-freeze proposal for review.
- T2 opening a new `M-CP-<n>` slice in the
  `routes/*.routes.ts` + `storage/*Store.ts` pattern.
- T6 adding e2e / contract tests that hit only existing routes.
- T8 admission-candidate research entries (no repo mutation).
- A single T3 UI subpage under `apps/web/app/settings/<domain>/page.tsx`
  surfacing an already-merged control-plane route.

**Medium-risk — approvable later, per event (not per class):**

- T7 extending `CODEOWNERS` beyond a single approver.
- T1 non-additive change to `packages/shared/src/channels.ts`,
  `settings.ts`, `notifications.ts`, or `integrations.ts`.
- Any PR editing `apps/server/src/index.ts` beyond wiring lines (only
  as part of a T2 route-extraction lane with founder sign-off).
- Any PR decomposing `apps/web/app/settings/page.tsx`.
- Promotion of a READY-FOR-THIN-INTEGRATION capability
  (C3 / C6 / C11 / C12 / C18 / C19 consumer wiring).

**Explicitly NOT approvable yet:**

- Two `M-CP-<n>` coding lanes active at the same time.
- Opening any Google write / send / upload / share / delete lane.
- Any skill install, runtime promotion, or marketplace work.
- Reopening the closed Google Workspace browser-first bundle.
- Editing `CLAUDE.md` or `~/akior/docs/cto_external_ledger/**`
  content from a build session.
- Unfreezing the Layer 1 / 2 / 3 boundary without an explicit CTO
  decision.
- Any PR that places a credential file, client secret, or
  developer-console instruction anywhere in founder flow.
- Any "Light / Cloud / derivative product" lane.

### Anti-Pattern Blocks

Sheriff rejects, in order:

- **Fake parallelism** — multiple teams opening PRs that all touch
  `apps/server/src/index.ts` or `apps/web/app/settings/page.tsx` and
  calling it throughput.
- **Many branches touching unresolved shared contracts** — PRs
  editing `packages/shared/src/**` without a T1 freeze-ref.
- **Runtime / control-plane blur** — a PR claiming an `M-CP-<n>`
  slice while also fetching from an external service or installing a
  skill.
- **Research team mutating product** — any `RESEARCH-<n>` PR
  touching `apps/**`, `packages/**`, `.github/**`, `scripts/**`, or
  `e2e/**`.
- **UI-exists-therefore-backend-done** — claiming an `M-PS-<n>` is
  complete when the matching `M-CP-<n>` store/service does not yet
  exist on `main`.
- **Broad repo wandering** — PRs touching many unrelated
  directories; require a split or a justification.
- **Hidden contract edits** — a drive-by edit to
  `packages/shared/src/**` inside an unrelated PR.
- **Readiness claims without proof** — acceptance notes lacking
  typecheck / build / e2e / runtime-receipt evidence.
- **New inline routes in `index.ts`** — forbidden; forces
  `routes/*.routes.ts` modularization.
- **Founder-auth regressions** — reintroducing clientId / secret /
  credential-file / developer-console steps into founder flow.
  Hard block; escalate.
