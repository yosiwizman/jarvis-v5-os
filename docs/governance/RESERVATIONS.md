# AKIOR Reservation Ledger

Companion to [`docs/governance.md`](../governance.md). This file is the
single source of truth for active branch reservations across the 8-team
AKIOR engineering org.

## Purpose

AKIOR has a small number of shared mutable surfaces (see
`docs/governance.md` Collision-Prevention Rules). Opening more than one
concurrent branch against any of them produces silent merge collisions
that CI cannot distinguish from legitimate drift. Reservations make that
overlap impossible by requiring every lane to declare — up front and in
writing — exactly which files it will write, which SHA it is based on,
and which other reservations it depends on.

Reservation precedes branching. No reservation = no branch.

## How to open a reservation

1. Draft a new entry under the **Active Reservations** section using the
   schema below. Use the next unused `R-YYYYMMDD-NN` id for today.
2. Open a docs-only PR against `main` that adds the entry.
3. The merge sheriff (T7) reviews against the reservation rules,
   rejects on overlap or stale base, and merges when clean.
4. Only after that docs-only PR merges may the reserving team create the
   working branch named in the entry.
5. When the working branch merges, T7 moves the entry from **Active
   Reservations** to **Closed Reservations** with the final merge SHA
   and date.

## Reservation schema

Every entry must include all of these fields:

```yaml
- id: R-YYYYMMDD-NN              # monotonic per day
  team: T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8
  branch: <per docs/governance.md branch-naming table>
  slice_id: M-CP-<n> | M-PS-<n> | WRAP-<n> | QA-<n> | CONTRACT-<n> | RESEARCH-<n>
  files_reserved:                # EXCLUSIVE write lock on each path/tree
    - <path/file>
    - <path/dir/>
  files_shared_wiring_only:      # tightly bounded wiring-only edits
    - <path/file>                # see wiring-only rule below
  depends_on_sha: <commit SHA this lane is based on>
  depends_on_reservation:        # upstream locks that must merge first
    - R-...
  downstream_consumers:          # locks that must wait on this one
    - R-...
  contract_freeze_ref: <T1 freeze PR/commit> | n/a
  founder_approval_ref: <link to approval> | n/a
  opened_at: <ISO 8601 UTC>
  expires_at: <ISO 8601 UTC>     # hard max 5 days from opened_at
```

## Reservation rules

1. **Reserve before branching.** Any branch created without an active,
   merged reservation is rejected by the sheriff and must be closed.
2. **Only T7 merges reservations.** Any team may draft and open. Only
   T7 approves overlap resolution, dependency chains, and expiries.
3. **Overlap rejection.** If a new reservation's `files_reserved` tree
   intersects any open reservation's `files_reserved` **or**
   `files_shared_wiring_only`, T7 rejects unless both teams explicitly
   agree on a serial order (first merges, second rebases).
4. **Stale-base rejection.** If `depends_on_sha` is more than one
   merged PR behind `main` at merge time, T7 requires a rebase before
   accepting the merge.
5. **Shared-shell files are wiring-only.**
   `apps/server/src/index.ts` and `apps/web/app/settings/page.tsx` may
   **only** appear in `files_shared_wiring_only`, never in
   `files_reserved`. Wiring-only edits mean ≤20 lines, zero logic
   changes (e.g. a new `registerXxxRoutes(fastify)` call, an `await
   initXxxStore()` line). Logic belongs in a new
   `routes/*.routes.ts` / `storage/*Store.ts` / `services/*.ts` file.
6. **Contract freeze.** Any reservation touching
   `packages/shared/src/**` or the shape of
   `apps/server/src/channels/registry.ts` pauses downstream coding
   reservations until it merges. T1 owns the freeze ref.
7. **Expiry.** Reservations expire 5 days after `opened_at`. Expired
   reservations are closed by T7 and must be re-justified and
   re-opened; they do not auto-renew.
8. **Research isolation.** `RESEARCH-<n>` reservations must not list
   any `apps/**`, `packages/**`, `.github/**`, `scripts/**`, or
   `e2e/**` path under `files_reserved`. Violations are auto-closed.
9. **At most one active shared-contract coding lane.** Across all
   active reservations, at most one may set "Is this the single active
   shared-contract coding lane? yes" in its PR. T7 enforces this count.
10. **Ceiling.** At most three simultaneously-open coding PRs across
    the org. Prep / proof / research / QA / wrapper lanes against
    non-shared files are uncapped but still require a reservation.

## Active Reservations

No active reservations yet.

## Closed Reservations

```yaml
- id: R-20260416-03
  team: T3
  branch: ps/m-ps-7-auth-connect-surface-01
  slice_id: M-PS-7
  files_reserved:
    - apps/web/app/settings/auth-connect/page.tsx
  files_shared_wiring_only: []
  depends_on_sha: 393f2e47df49e34c27fb8971855648afeb98f429
  depends_on_reservation:
    - R-20260416-01
    - R-20260416-02
  downstream_consumers: []
  contract_freeze_ref: n/a
  founder_approval_ref: founder approval for bounded M-PS-7 auth-connect product-surface lane
  opened_at: 2026-04-16T00:00:00Z
  expires_at: 2026-04-21T00:00:00Z
  merged_sha: 2248d66ccf922947e4f6fa07c94d7fac6b1ffda5
  merged_pr: "#141"
  closed_at: 2026-04-16T00:00:00Z
```

```yaml
- id: R-20260416-01
  team: T2
  branch: cp/m-cp-4-auth-connect-orchestrator-01
  slice_id: M-CP-4
  files_reserved:
    - apps/server/src/storage/authConnectStore.ts
    - apps/server/src/services/authConnectOrchestrator.ts
    - apps/server/src/routes/authConnect.routes.ts
  files_shared_wiring_only:
    - apps/server/src/index.ts
  depends_on_sha: eaacdfd2a1085b410dd64b6512ccd50efb84e778
  depends_on_reservation: []
  downstream_consumers: []
  contract_freeze_ref: n/a
  founder_approval_ref: founder approval for bounded M-CP-4 auth/connect orchestrator lane
  opened_at: 2026-04-16T00:00:00Z
  expires_at: 2026-04-21T00:00:00Z
  merged_sha: 97a8c5d5e5cb5f385d10701d1dc7fa3cc460c59a
  merged_pr: "#137"
  closed_at: 2026-04-16T00:00:00Z
```

```yaml
- id: R-20260416-02
  team: T2
  branch: cp/m-cp-3-unified-status-registry-01
  slice_id: M-CP-3
  files_reserved:
    - apps/server/src/storage/statusRegistryStore.ts
    - apps/server/src/services/statusRegistryService.ts
    - apps/server/src/routes/statusRegistry.routes.ts
  files_shared_wiring_only:
    - apps/server/src/index.ts
  depends_on_sha: a54922093f75ef44d5ccc7e81810e777d74c515f
  depends_on_reservation:
    - R-20260416-01
  downstream_consumers: []
  contract_freeze_ref: n/a
  founder_approval_ref: founder approval for bounded M-CP-3 unified status registry lane
  opened_at: 2026-04-16T00:00:00Z
  expires_at: 2026-04-21T00:00:00Z
  merged_sha: 9a790afae1be0f59f9b294a492da1ba350ea2748
  merged_pr: "#139"
  closed_at: 2026-04-16T00:00:00Z
```
