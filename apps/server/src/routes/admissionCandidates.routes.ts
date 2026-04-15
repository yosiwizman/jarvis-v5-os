/**
 * Admission Candidates Routes — M-CP-10 SUPPLY-CHAIN-ADMISSION-GATE
 *
 * Control-plane admission gate for supply-chain candidates. Admin-guarded.
 * No runtime install, no promotion, no external fetch — pure store operations.
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "./auth.routes.js";
import {
  createCandidate,
  listCandidates,
  getCandidateById,
  updateCandidate,
  submitCandidate,
  approveCandidate,
  rejectCandidate,
  listActivity,
  evaluateApprovalGate,
  type CandidateType,
  type SourceKind,
  type ProvenanceStatus,
  type InstallCountStatus,
  type SecurityReviewStatus,
  type OwnershipMapStatus,
  type FinalVerdict,
} from "../storage/admissionCandidateStore.js";

const CANDIDATE_TYPES: CandidateType[] = [
  "skill",
  "repo",
  "runtime",
  "package",
  "other",
];
const SOURCE_KINDS: SourceKind[] = [
  "local_openclaw",
  "macmini_reference",
  "community",
  "current_akior",
  "other",
];
const PROVENANCE_STATUSES: ProvenanceStatus[] = [
  "unknown",
  "documented",
  "verified",
];
const INSTALL_COUNT_STATUSES: InstallCountStatus[] = [
  "unknown",
  "insufficient",
  "acceptable",
];
const SECURITY_REVIEW_STATUSES: SecurityReviewStatus[] = [
  "not_started",
  "in_progress",
  "acceptable",
  "rejected",
];
const OWNERSHIP_MAP_STATUSES: OwnershipMapStatus[] = [
  "unknown",
  "partial",
  "complete",
];
const FINAL_VERDICTS: Exclude<FinalVerdict, null>[] = [
  "READY_FOR_THIN_INTEGRATION",
  "READY_AFTER_CONTROL_PLANE_GAP_CLOSE",
  "READY_AFTER_UI_STATUS_GAP_CLOSE",
  "READY_AFTER_AUTH_POLICY_GAP_CLOSE",
  "NOT_READY",
  "DEFERRED",
];

const CreateSchema = z.object({
  candidateName: z.string().min(1),
  candidateType: z.enum(CANDIDATE_TYPES as [CandidateType, ...CandidateType[]]),
  sourceKind: z.enum(SOURCE_KINDS as [SourceKind, ...SourceKind[]]),
  sourceUrlOrPath: z.string().min(1),
  sourceSlugOrRepo: z.string(),
  purposeMapping: z.string().min(1),
});

const UpdateSchema = z.object({
  provenanceStatus: z.enum(PROVENANCE_STATUSES as [ProvenanceStatus, ...ProvenanceStatus[]]).optional(),
  installPathKnown: z.boolean().optional(),
  installCountStatus: z.enum(INSTALL_COUNT_STATUSES as [InstallCountStatus, ...InstallCountStatus[]]).optional(),
  securityReviewStatus: z.enum(SECURITY_REVIEW_STATUSES as [SecurityReviewStatus, ...SecurityReviewStatus[]]).optional(),
  ownershipMapStatus: z.enum(OWNERSHIP_MAP_STATUSES as [OwnershipMapStatus, ...OwnershipMapStatus[]]).optional(),
  readinessGaps: z.string().optional(),
  readinessGapsReviewed: z.boolean().optional(),
  curatedSource: z.boolean().optional(),
  vettedSource: z.boolean().optional(),
  founderSafeAuthApproved: z.boolean().optional(),
  purposeMapping: z.string().optional(),
  decisionReason: z.string().optional(),
  finalVerdict: z.enum(FINAL_VERDICTS as [typeof FINAL_VERDICTS[0], ...typeof FINAL_VERDICTS]).nullable().optional(),
});

const ApproveSchema = z.object({
  finalVerdict: z.enum(FINAL_VERDICTS as [typeof FINAL_VERDICTS[0], ...typeof FINAL_VERDICTS]).optional(),
  decisionReason: z.string().optional(),
});

const RejectSchema = z.object({
  decisionReason: z.string().min(1, "rejection reason is required"),
});

const ACTOR = "founder";

export function registerAdmissionCandidateRoutes(fastify: FastifyInstance) {
  const base = "/api/control-plane/admission-candidates";

  fastify.post(base, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = CreateSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ ok: false, error: "Invalid request body", details: body.error.flatten() });
    }
    const candidate = await createCandidate({ ...body.data, actor: ACTOR });
    return reply.status(201).send({ ok: true, candidate });
  });

  fastify.get(base, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const candidates = await listCandidates();
    return reply.send({ ok: true, candidates });
  });

  fastify.get<{ Params: { id: string } }>(
    `${base}/:id`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const candidate = await getCandidateById(req.params.id);
      if (!candidate) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      const gate = evaluateApprovalGate(candidate);
      return reply.send({ ok: true, candidate, gate });
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    `${base}/:id`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const body = UpdateSchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ ok: false, error: "Invalid request body" });
      }
      const updated = await updateCandidate(req.params.id, body.data, ACTOR);
      if (!updated) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      return reply.send({ ok: true, candidate: updated });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    `${base}/:id/submit`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const updated = await submitCandidate(req.params.id, ACTOR);
      if (!updated) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      return reply.send({ ok: true, candidate: updated });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    `${base}/:id/approve`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const body = ApproveSchema.safeParse(req.body ?? {});
      const finalVerdict = (body.success ? body.data.finalVerdict : undefined) ?? "READY_FOR_THIN_INTEGRATION";
      const decisionReason = (body.success ? body.data.decisionReason : undefined) ?? "";
      const result = await approveCandidate(
        req.params.id,
        ACTOR,
        finalVerdict,
        decisionReason,
      );
      if (result.notFound) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      if (result.blocked) {
        return reply.status(409).send({
          ok: false,
          error: "approval blocked by admission gate",
          blockingReasons: result.blockingReasons,
          candidate: result.candidate,
        });
      }
      return reply.send({ ok: true, candidate: result.candidate });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    `${base}/:id/reject`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const body = RejectSchema.safeParse(req.body ?? {});
      if (!body.success) {
        return reply
          .status(400)
          .send({ ok: false, error: "rejection reason is required" });
      }
      const updated = await rejectCandidate(
        req.params.id,
        ACTOR,
        body.data.decisionReason,
      );
      if (!updated) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      return reply.send({ ok: true, candidate: updated });
    },
  );

  fastify.get("/api/control-plane/admission-activity", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = req.query as Record<string, string | undefined>;
    const candidateId = q["candidateId"];
    const activity = await listActivity(candidateId);
    return reply.send({ ok: true, activity });
  });
}
