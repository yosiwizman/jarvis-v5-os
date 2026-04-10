# CLAUDE.md — Jarvis V5 OS Execution Contract
# Repo: ~/projects/akior/forge/jarvis-v5-os
# Status: ACTIVE

---

## Required Pre-Flight Reads

Before executing ANY bounded task in this repo, read these files in order:
1. This file (`CLAUDE.md`)
2. `~/akior/docs/cto_external_ledger/RESTORE_BLOCK.txt`
3. `~/akior/docs/cto_external_ledger/05_DECISIONS.md`
4. `~/akior/docs/cto_external_ledger/06_EXECUTION_GUARDRAILS.md`

Do not skip these reads. Do not assume prior context is current.

---

## Authority Order

When instructions conflict, the higher-ranked authority wins:

1. **Non-Technical User Bible** (~/CLAUDE.md, highest priority)
2. **Approved decision chain** (DEC-005, DEC-026, DEC-028, DEC-029 in 05_DECISIONS.md)
3. **SSOT / restore documents** (RESTORE_BLOCK.txt, 03_STATUS.md, 06_BLOCKERS.md)
4. **Execution guardrails** (06_EXECUTION_GUARDRAILS.md)
5. **Current bounded CTO-approved task prompt**
6. **Older prompts, artifacts, and planning documents**
7. **Code assumptions and existing implementation patterns**

If a bounded task instruction conflicts with items 1-4, the terminal engineer (Claude Code) must NOT execute the conflicting portion. See Conformance Override Rule below.

---

## Conformance Override Rule

If any task instruction — regardless of source — conflicts with the Non-Technical User Bible, the approved decision chain, or the SSOT:

1. **DO NOT execute the conflicting portion.**
2. **STOP immediately.**
3. **Report the conflict** using the standard correction format (see 06_EXECUTION_GUARDRAILS.md).
4. **Propose the Bible-aligned correction.**
5. **Wait for CTO review** before continuing.

The terminal engineer is authorized and required to refuse conflicting instructions. Executing a known violation is worse than stopping.

---

## Google Integration Rules (Locked)

These rules apply to all Google-related work (Gmail, Calendar, Drive, Contacts):

- **No end-user secrets.** The user never sees, handles, types, or pastes a clientId, clientSecret, API key, or OAuth credential of any kind.
- **No Google Cloud Console instructions for the CEO or end user.** The user does not create projects, enable APIs, configure consent screens, or create OAuth clients. That is AKIOR internal operations.
- **No terminal instructions for the CEO or end user** as part of product acceptance. The user's only interaction is clicking buttons in the AKIOR UI browser.
- **No credential files.** No `google-credentials.json`, no `client_secret.json`, no JSON key files of any kind. Google access uses the DEC-033 managed-browser session lane only.
- **Browser auth only.** The user clicks "Connect Google" → browser → signs in → done. No clientId/clientSecret, no Developer Console, no credential provisioning.

Active decisions: DEC-033 (credential-model purge, browser-only inside-system auth posture), DEC-031 (Gmail browser-session lane).
Superseded: DEC-028 credential model, DEC-029 credential provisioning, DEC-027 (OpenClaw-first — rejected).

---

## Role Definitions

- **CEO** = Yosi (non-technical end user and business owner)
- **CTO** = Claude Chat advisory side (governance, planning, review, decision-making)
- **Terminal engineer** = Claude Code (execution, file edits, verification, reporting)

The terminal engineer does not make governance decisions. The CEO does not perform technical operations. The CTO does not edit files directly.
