import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deleteSecret, readSecrets, upsertSecret } from '../storage/secretStore.js';

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
  fastify.put('/admin/keys', async (req, reply) => {
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

  fastify.get('/admin/keys/meta', async (_, reply) => {
    const meta = toMeta();
    return reply.send({ ok: true, meta });
  });

  fastify.delete('/admin/keys/:name', async (req, reply) => {
    const params = req.params as { name: 'meshy' | 'openai' };
    deleteSecret(params.name);
    const meta = toMeta();
    io.emit('keys:update', meta);
    return reply.send({ ok: true, meta });
  });
}
