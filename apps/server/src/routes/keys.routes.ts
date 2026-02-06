import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deleteSecret, readSecrets, upsertSecret } from '../storage/secretStore.js';
import { requireAdmin } from './auth.routes.js';
import { isPinConfigured } from '../auth/index.js';
import { isLLMConfigured } from '../storage/llmConfigStore.js';
import {
  RateLimitPresets,
  checkRateLimit,
  getClientIp,
  requireCsrf,
  audit,
} from '../security/index.js';

const PutSchema = z.object({
  meshy: z.string().optional(),
  openai: z.string().optional()
});

type SocketServer = {
  emit: (event: string, payload: any) => void;
};

type SecretsMeta = {
  meshy: { present: boolean };
  openai: { present: boolean };
};

function toMeta() {
  const secrets = readSecrets();
  return {
    meshy: { present: Boolean(secrets.meshy) },
    openai: { present: Boolean(secrets.openai) }
  } satisfies SecretsMeta;
}

export function registerKeyRoutes(fastify: FastifyInstance, io: SocketServer) {
  /**
   * PUT /api/admin/keys
   * 
   * SECURITY:
   * - 428 if setup incomplete
   * - 401 if not authenticated
   * - 429 if rate limited
   * - 403 if CSRF invalid
   */
  fastify.put('/api/admin/keys', async (req, reply) => {
    const ip = getClientIp(req);
    
    // Check if setup is complete (only PIN check - keys themselves are being set here)
    const pinConfigured = isPinConfigured();
    if (!pinConfigured) {
      return reply.status(428).send({
        ok: false,
        error: {
          code: 'SETUP_REQUIRED',
          message: 'Owner PIN must be configured first'
        },
        setup: {
          ownerPin: false,
          llm: isLLMConfigured().configured
        }
      });
    }
    
    // Require admin authentication
    if (!requireAdmin(req, reply)) return;
    
    // Rate limit
    const rateCheck = checkRateLimit({ ...RateLimitPresets.ADMIN_MODERATE, routeKey: 'admin-keys-put' }, ip);
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header('Retry-After', String(rateCheck.response.retryAfterSec))
        .header('Cache-Control', 'no-store')
        .send(rateCheck.response);
    }
    
    // CSRF protection
    if (!(await requireCsrf(req, reply))) return;
    
    const body = PutSchema.parse(req.body ?? {});
    let updated = false;
    const updatedKeys: string[] = [];
    for (const [name, value] of Object.entries(body)) {
      if (value) {
        upsertSecret(name as 'meshy' | 'openai', value);
        updated = true;
        updatedKeys.push(name);
      }
    }
    const meta = toMeta();
    if (updated) {
      io.emit('keys:update', meta);
      // Audit log each key set
      for (const keyName of updatedKeys) {
        await audit.adminKeySet(ip, keyName);
      }
    }
    return reply.send({ ok: true, meta });
  });

  // Note: /meta is intentionally accessible without auth for setup page
  // It only returns boolean presence flags, not actual key values
  fastify.get('/api/admin/keys/meta', async (_, reply) => {
    const meta = toMeta();
    return reply.send({ ok: true, meta });
  });

  /**
   * DELETE /api/admin/keys/:name
   * 
   * SECURITY:
   * - 428 if setup incomplete
   * - 401 if not authenticated
   * - 429 if rate limited
   * - 403 if CSRF invalid
   */
  fastify.delete('/api/admin/keys/:name', async (req, reply) => {
    const ip = getClientIp(req);
    
    // Check if setup is complete
    const pinConfigured = isPinConfigured();
    const llmConfigured = isLLMConfigured();
    if (!pinConfigured || !llmConfigured.configured) {
      return reply.status(428).send({
        ok: false,
        error: {
          code: 'SETUP_REQUIRED',
          message: 'Setup must be completed before deleting keys'
        },
        setup: {
          ownerPin: pinConfigured,
          llm: llmConfigured.configured
        }
      });
    }
    
    // Require admin authentication
    if (!requireAdmin(req, reply)) return;
    
    // Rate limit
    const rateCheck = checkRateLimit({ ...RateLimitPresets.ADMIN_MODERATE, routeKey: 'admin-keys-delete' }, ip);
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header('Retry-After', String(rateCheck.response.retryAfterSec))
        .header('Cache-Control', 'no-store')
        .send(rateCheck.response);
    }
    
    // CSRF protection
    if (!(await requireCsrf(req, reply))) return;
    
    const params = req.params as { name: 'meshy' | 'openai' };
    deleteSecret(params.name);
    const meta = toMeta();
    io.emit('keys:update', meta);
    
    // Audit log
    await audit.adminKeyDelete(ip, params.name);
    
    return reply.send({ ok: true, meta });
  });
}
