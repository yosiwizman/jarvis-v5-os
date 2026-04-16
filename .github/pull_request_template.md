<!--
AKIOR Pull Request Template — governance enforcement layer.
Every field below is required. PRs missing Reservation ID, depends_on_sha,
the Founder-Safe Auth Check, or the Merge Checklist are rejected by the
merge sheriff (T7). See docs/governance.md and
docs/governance/RESERVATIONS.md for the full rules.

Slice taxonomy — pick ONE for Slice ID:
  - M-CP-<n>   (control-plane mandatory slice)
  - M-PS-<n>   (product-surface mandatory slice)
  - WRAP-<n>   (runtime thin wrapper)
  - QA-<n>     (e2e / contract / smoke work)
  - CONTRACT-<n> (packages/shared/** or registry typeshape)
  - RESEARCH-<n> (admission / research; no code mutation)
-->

## Reservation
- Reservation ID: <!-- R-YYYYMMDD-NN -->
- Team: <!-- T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 -->
- Slice ID: <!-- M-CP-<n> | M-PS-<n> | WRAP-<n> | QA-<n> | CONTRACT-<n> | RESEARCH-<n> -->
- Branch: <!-- per docs/governance.md branch-naming table -->

## Scope
- Files added:
- Files edited:
- Files explicitly NOT touched:
- Contract-frozen files touched? yes / no
- T1 freeze-ref (required if yes):

## Proof
- typecheck: pass / fail (command + exit code)
- build: pass / fail
- lint: pass / fail
- unit / contract: pass / fail
- e2e smoke spec added or updated: yes / no — path:
- runtime receipts (curl / HTTPS probes): inline, or artifact path:
- UI proof (only if UI changed): Playwright spec + screenshot path:

## Dependency Declaration
- depends_on_sha: <!-- main SHA at branch point -->
- depends_on_reservation: <!-- [R-...] or none -->
- downstream_consumers: <!-- [R-...] or none -->
- Is this the single active shared-contract coding lane? yes / no

## Founder-Safe Auth Check
- Does this PR add any founder-visible auth step? yes / no
- If yes, is the ONLY founder affordance a UI "Connect [Service]" → browser OAuth / QR? yes / no
- Credential files added? must be no
- Developer-console instructions to founder? must be no

## Founder Approval Flag
- Requires founder approval? yes / no — reason:
- Approval ref (link to approval or "n/a"):

## Scope Guardrails
- No runtime install / promotion: confirmed
- No governance edits (unless sheriff lane): confirmed
- No Google Workspace write / send / delete: confirmed
- No widen-into-marketplace / package-manager / orchestrator: confirmed

## Merge Checklist
- [ ] All required CI checks green
- [ ] CODEOWNERS approval
- [ ] Sheriff reservation closed
- [ ] Main fast-forwardable after rebase if required
