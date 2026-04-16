/**
 * Auth/Connect Orchestrator Routes — M-CP-4.
 *
 * Admin-guarded control-plane surface. No runtime provider work, no external
 * fetch, no secret handling — only orchestration-record CRUD + founder-safe
 * method enumeration.
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "./auth.routes.js";
import {
  createSession,
  listSessions,
  getSessionById,
  cancelSession,
  type AuthConnectMethod,
} from "../storage/authConnectStore.js";
import {
  listProviderMethodSummaries,
  classifyOrchestrationRequest,
} from "../services/authConnectOrchestrator.js";

const ADMISSIBLE_METHODS: AuthConnectMethod[] = ["browser_oauth", "qr"];

// NOTE: the schema deliberately enumerates only `provider` and `method`.
// Any extra keys on the payload are passed through to
// classifyOrchestrationRequest's founder-safety check so smuggled
// clientSecret / token / credentialsFile fields are caught and rejected at
// the service layer, then persisted as a "blocked" record for audit.
const CreateSessionSchema = z.object({
  provider: z.string().min(1),
  method: z.enum(ADMISSIBLE_METHODS as [AuthConnectMethod, ...AuthConnectMethod[]]),
});

const CancelSchema = z.object({
  reason: z.string().optional(),
});

const ACTOR = "founder";

export function registerAuthConnectRoutes(fastify: FastifyInstance) {
  const base = "/api/auth-connect";

  fastify.get(`${base}/providers`, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const providers = listProviderMethodSummaries();
    return reply.send({ ok: true, providers, admissibleMethods: ADMISSIBLE_METHODS });
  });

  fastify.post(`${base}/sessions`, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = CreateSessionSchema.safeParse(body);

    // Founder-safety must be checked BEFORE shape validation so a smuggled
    // secret field with a missing/invalid method still produces a truthful
    // "blocked" record instead of a plain 400.
    const classification = classifyOrchestrationRequest({
      provider: typeof body.provider === "string" ? (body.provider as string) : "",
      method: (typeof body.method === "string" ? (body.method as AuthConnectMethod) : "browser_oauth"),
      body,
    });

    if (classification.state === "blocked" && !classification.founderSafe) {
      const session = await createSession({
        provider: typeof body.provider === "string" ? (body.provider as string) : "(unknown)",
        method: (typeof body.method === "string" && (body.method === "browser_oauth" || body.method === "qr"))
          ? (body.method as AuthConnectMethod)
          : "browser_oauth",
        state: classification.state,
        stateReason: classification.stateReason,
        founderSafe: classification.founderSafe,
        forbiddenReason: classification.forbiddenReason,
        requestedBy: ACTOR,
      });
      return reply.status(400).send({
        ok: false,
        error: "founder-unsafe payload rejected",
        forbiddenReason: classification.forbiddenReason,
        session,
      });
    }

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ ok: false, error: "Invalid request body", details: parsed.error.flatten() });
    }

    const session = await createSession({
      provider: parsed.data.provider,
      method: parsed.data.method,
      state: classification.state,
      stateReason: classification.stateReason,
      founderSafe: classification.founderSafe,
      forbiddenReason: classification.forbiddenReason,
      requestedBy: ACTOR,
    });
    return reply.status(201).send({ ok: true, session });
  });

  fastify.get(`${base}/sessions`, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const sessions = await listSessions();
    return reply.send({ ok: true, sessions });
  });

  fastify.get<{ Params: { id: string } }>(
    `${base}/sessions/:id`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const session = await getSessionById(req.params.id);
      if (!session) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      return reply.send({ ok: true, session });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    `${base}/sessions/:id/cancel`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const body = CancelSchema.safeParse(req.body ?? {});
      const reason = body.success ? body.data.reason ?? "" : "";
      const updated = await cancelSession(req.params.id, reason);
      if (!updated) {
        return reply.status(404).send({ ok: false, error: "not found" });
      }
      return reply.send({ ok: true, session: updated });
    },
  );
}
