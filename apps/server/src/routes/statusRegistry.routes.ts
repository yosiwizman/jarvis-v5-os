/**
 * Status Registry Routes — M-CP-3.
 *
 * Admin-guarded control-plane surface exposing:
 *   GET  /api/status                                  — list all capabilities
 *   GET  /api/status/:capabilityId                    — single capability
 *   POST /api/status/:capabilityId/checkin            — record current status
 *
 * Pure store operations — no external fetch, no runtime probing, no history
 * timeline, no notification delivery, no scheduler coupling.
 */

import { FastifyInstance } from 'fastify';
import { requireAdmin } from './auth.routes.js';
import {
  listStatus,
  getStatusById,
  recordCheckIn,
} from '../storage/statusRegistryStore.js';
import {
  listKnownCapabilities,
  validateCheckInRequest,
} from '../services/statusRegistryService.js';

const ACTOR = 'founder';

export function registerStatusRegistryRoutes(fastify: FastifyInstance) {
  const base = '/api/status';

  fastify.get(base, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const capabilities = await listStatus();
    return reply.send({
      ok: true,
      capabilities,
      knownCapabilities: listKnownCapabilities(),
    });
  });

  fastify.get<{ Params: { capabilityId: string } }>(
    `${base}/:capabilityId`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const record = await getStatusById(req.params.capabilityId);
      if (!record) {
        return reply.status(404).send({ ok: false, error: 'not found' });
      }
      return reply.send({ ok: true, capability: record });
    },
  );

  fastify.post<{ Params: { capabilityId: string } }>(
    `${base}/:capabilityId/checkin`,
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const classification = validateCheckInRequest({
        capabilityId: req.params.capabilityId,
        status: body.status,
        statusReason: body.statusReason,
      });

      if (!classification.ok || classification.status === null || classification.statusReason === null) {
        return reply.status(400).send({
          ok: false,
          error: classification.reason ?? 'invalid check-in',
          forbiddenField: classification.forbiddenField,
        });
      }

      const updated = await recordCheckIn({
        capabilityId: req.params.capabilityId,
        status: classification.status,
        statusReason: classification.statusReason,
        actor: ACTOR,
      });
      if (!updated) {
        // Catalog knew the id but store did not; should be unreachable because
        // initStatusRegistryStore reconciles on boot. Surface truthfully.
        return reply.status(404).send({ ok: false, error: 'not found' });
      }
      return reply.send({ ok: true, capability: updated });
    },
  );
}
