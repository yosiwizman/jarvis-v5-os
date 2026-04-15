/**
 * Assistant Routes
 *
 * Handles briefing intake and approval lifecycle for the AKIOR assistant:
 * - POST /api/assistant/briefings         — ingest a new briefing
 * - GET  /api/assistant/briefings         — list all briefings (newest first)
 * - GET  /api/assistant/briefings/:id     — get a single briefing by id
 * - GET  /api/assistant/approvals         — list pending approvals
 * - POST /api/assistant/approvals/:id/approve — approve a briefing
 * - POST /api/assistant/approvals/:id/reject  — reject a briefing
 * - GET  /api/assistant/activity          — list activity (optional ?briefingId=)
 *
 * All routes are admin-guarded. No external side-effects — pure store operations.
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "./auth.routes.js";
import {
  createBriefing,
  listBriefings,
  getBriefingById,
  listPendingApprovals,
  setApprovalStatus,
  listActivity,
  type BriefingState,
} from "../storage/assistantStore.js";

// ─── Classifier ───────────────────────────────────────────────────────────────

const RISKY_VERBS = [
  // write-side communication
  "send", "reply", "email", "text", "message", "dm", "post", "tweet", "publish",
  // commerce / commitment
  "buy", "book", "purchase", "order", "pay", "charge", "subscribe", "commit",
  // destructive
  "delete", "remove", "cancel", "unsubscribe", "refund",
  // sharing / delegation
  "share", "invite", "forward", "contact on my behalf", "tell them", "reach out",
];

const SAFE_VERBS = [
  "watch", "monitor", "check", "look", "scan", "summarize", "summarise",
  "remind me", "alert me", "notify me when", "report", "track", "keep an eye",
  "list", "show", "tell me", "what's", "what is", "when is",
];

const UNSUPPORTED_MARKERS = [
  "hack", "phish", "scam", "illegal", "bypass", "break into",
  "without permission", "forge",
];

interface ClassificationResult {
  state: BriefingState;
  stateReason: string;
  approvalRequired: boolean;
}

function classifyBriefing(rawText: string, requestedStartTime: string | null): ClassificationResult {
  const text = rawText.trim();
  if (text.length === 0) {
    return { state: "blocked", stateReason: "Empty briefing.", approvalRequired: false };
  }
  const lower = text.toLowerCase();

  // Rule 1: explicitly unsupported
  for (const marker of UNSUPPORTED_MARKERS) {
    if (lower.includes(marker)) {
      return {
        state: "blocked",
        stateReason: `Request contains unsupported/out-of-bounds language ("${marker}"). AKIOR will not act on this.`,
        approvalRequired: false,
      };
    }
  }

  // Rule 2: risky verb → needs_approval
  const matchedRisky = RISKY_VERBS.find((v) => lower.includes(v));
  if (matchedRisky) {
    return {
      state: "needs_approval",
      stateReason: `Risky action detected ("${matchedRisky}") — AKIOR will not act without explicit approval.`,
      approvalRequired: true,
    };
  }

  // Rule 3: ambiguity — short briefing without a verb or without target
  const tokens = text.split(/\s+/).filter(Boolean);
  const matchedSafe = SAFE_VERBS.find((v) => lower.includes(v));
  if (tokens.length <= 3 && !matchedSafe) {
    return {
      state: "needs_clarification",
      stateReason: "Briefing is too short or missing a clear action. Please provide more detail (what to do, who/what is the target).",
      approvalRequired: false,
    };
  }

  // Rule 4: explicit time reference or requestedStartTime provided
  const hasTimeWord = /\b(at|in|tomorrow|today|tonight|morning|afternoon|evening|noon|midnight|\d+\s*(am|pm|h|hr|hrs|hour|hours|minute|minutes|min))\b/i.test(text);
  const hasSafeVerb = !!matchedSafe;

  if (hasSafeVerb) {
    return {
      state: "safe_to_do_automatically",
      stateReason: `Safe monitoring/reporting request ("${matchedSafe}"). AKIOR can watch/record and surface results; no external action will be taken until explicitly approved.`,
      approvalRequired: false,
    };
  }

  // No safe verb, no risky verb, no clear time indicator → ambiguous
  if (!hasTimeWord && !requestedStartTime) {
    return {
      state: "needs_clarification",
      stateReason: "Briefing is missing a clear requested action or time. Please clarify what AKIOR should do and when.",
      approvalRequired: false,
    };
  }

  // Fallback: treat as safe monitoring when no risk signal and some context exists
  return {
    state: "safe_to_do_automatically",
    stateReason: "No risky action detected. AKIOR will track this briefing passively; no external action will be taken.",
    approvalRequired: false,
  };
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CreateBriefingSchema = z.object({
  rawText: z.string(),
  sourceChannel: z.string().nullable().optional(),
  requestedStartTime: z.string().nullable().optional(),
});

const ApprovalNoteSchema = z.object({
  note: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export function registerAssistantRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/assistant/briefings
   *
   * Ingest a new briefing. Runs deterministic classifier and persists the record.
   */
  fastify.post("/api/assistant/briefings", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const body = CreateBriefingSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ ok: false, error: "Invalid request body" });
    }

    const { rawText, sourceChannel, requestedStartTime } = body.data;

    const classification = classifyBriefing(rawText, requestedStartTime ?? null);

    const briefing = await createBriefing({
      rawText,
      sourceChannel: sourceChannel ?? null,
      requestedStartTime: requestedStartTime ?? null,
      state: classification.state,
      stateReason: classification.stateReason,
      approvalRequired: classification.approvalRequired,
    });

    return reply.status(201).send({ ok: true, briefing });
  });

  /**
   * GET /api/assistant/briefings
   *
   * Returns all briefings, newest first.
   */
  fastify.get("/api/assistant/briefings", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const all = await listBriefings();
    // newest first
    const briefings = [...all].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return reply.send({ ok: true, briefings });
  });

  /**
   * GET /api/assistant/briefings/:id
   *
   * Returns a single briefing by id or 404.
   */
  fastify.get<{ Params: { id: string } }>("/api/assistant/briefings/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const briefing = await getBriefingById(req.params.id);
    if (!briefing) {
      return reply.status(404).send({ ok: false, error: "not found" });
    }

    return reply.send({ ok: true, briefing });
  });

  /**
   * GET /api/assistant/approvals
   *
   * Returns all briefings with approvalStatus === 'pending'.
   */
  fastify.get("/api/assistant/approvals", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const approvals = await listPendingApprovals();
    return reply.send({ ok: true, approvals });
  });

  /**
   * POST /api/assistant/approvals/:id/approve
   *
   * Approve a pending briefing. Flips approvalStatus only; state is immutable.
   * No external actions triggered — pure store operation.
   */
  fastify.post<{ Params: { id: string } }>("/api/assistant/approvals/:id/approve", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const body = ApprovalNoteSchema.safeParse(req.body);
    const note = body.success ? body.data.note : undefined;

    const briefing = await setApprovalStatus(req.params.id, "approved", note);
    if (!briefing) {
      return reply.status(404).send({ ok: false, error: "not found" });
    }

    return reply.send({ ok: true, briefing });
  });

  /**
   * POST /api/assistant/approvals/:id/reject
   *
   * Reject a pending briefing. Mirrors approve with 'rejected' status.
   * No external actions triggered — pure store operation.
   */
  fastify.post<{ Params: { id: string } }>("/api/assistant/approvals/:id/reject", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const body = ApprovalNoteSchema.safeParse(req.body);
    const note = body.success ? body.data.note : undefined;

    const briefing = await setApprovalStatus(req.params.id, "rejected", note);
    if (!briefing) {
      return reply.status(404).send({ ok: false, error: "not found" });
    }

    return reply.send({ ok: true, briefing });
  });

  /**
   * GET /api/assistant/activity
   *
   * Returns activity log entries. Optional ?briefingId= filter.
   */
  fastify.get("/api/assistant/activity", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const query = req.query as Record<string, string | undefined>;
    const briefingId = query["briefingId"] ?? undefined;

    const activity = await listActivity(briefingId);
    return reply.send({ ok: true, activity });
  });
}
