import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deleteSecret, readSecrets, upsertSecret } from '../storage/secretStore.js';
import { requireAdmin } from './auth.routes.js';
import { isPinConfigured } from '../auth/index.js';
import { isLLMConfigured } from '../storage/llmConfigStore.js';

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
  fastify.put('/api/admin/keys', async (req, reply) => {
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
    
    const body = PutSchema.parse(req.body ?? {});
    let updated = false;
    for (const [name, value] of Object.entries(body)) {
      if (value) {
        upsertSecret(name as 'meshy' | 'openai', value);
        updated = true;
      }
    }
    const meta = toMeta();
    if (updated) {
      io.emit('keys:update', meta);
    }
    return reply.send({ ok: true, meta });
  });

  // Note: /meta is intentionally accessible without auth for setup page
  // It only returns boolean presence flags, not actual key values
  fastify.get('/api/admin/keys/meta', async (_, reply) => {
    const meta = toMeta();
    return reply.send({ ok: true, meta });
  });

  fastify.delete('/api/admin/keys/:name', async (req, reply) => {
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
    
    const params = req.params as { name: 'meshy' | 'openai' };
    deleteSecret(params.name);
    const meta = toMeta();
    io.emit('keys:update', meta);
    return reply.send({ ok: true, meta });
  });
}
