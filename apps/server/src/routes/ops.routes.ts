/**
 * Operations routes for deployment monitoring and drift detection.
 * 
 * These endpoints are read-only and safe to expose on LAN without authentication.
 * They provide visibility into deployment state without exposing secrets.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

/**
 * Drift detection response shape
 */
interface DriftResponse {
  ok: boolean;
  expectedSha: string;
  running: {
    server: string;
    web: string | null;
  };
  drift: boolean;
  driftDetails: string[];
  time: string;
}

/**
 * Get the expected SHA from the git repository.
 * In production, this is baked in at build time via GIT_SHA env var.
 * For drift detection on the host, use the drift-check.sh script instead.
 */
function getExpectedSha(): string {
  return process.env.GIT_SHA || 'unknown';
}

/**
 * Get the running server SHA (this process's build).
 */
function getServerSha(): string {
  return process.env.GIT_SHA || 'unknown';
}

export function registerOpsRoutes(app: FastifyInstance) {
  /**
   * GET /api/ops/drift
   * 
   * Deployment drift detection endpoint.
   * Compares the expected git SHA with running container SHAs.
   * 
   * This endpoint checks:
   * - Server container SHA (directly from this process)
   * - Web container SHA (fetched via internal health endpoint, if reachable)
   * 
   * Returns drift: true if any running container doesn't match expected SHA.
   * 
   * Note: For full drift detection including repo HEAD vs running containers,
   * use the host-side drift-check.sh script which has access to the git repo.
   */
  app.get('/api/ops/drift', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');

    const expectedSha = getExpectedSha();
    const serverSha = getServerSha();
    let webSha: string | null = null;
    const driftDetails: string[] = [];

    // Try to fetch web container's build info
    // In Docker Compose, web is accessible at http://web:3001
    try {
      const webHealthUrl = process.env.WEB_HEALTH_URL || 'http://web:3001/api/health/build';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const webResponse = await fetch(webHealthUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      
      if (webResponse.ok) {
        const webBuild = await webResponse.json() as { git_sha?: string };
        webSha = webBuild.git_sha || 'unknown';
      } else {
        logger.warn({ status: webResponse.status }, 'Failed to fetch web build info');
        webSha = 'unreachable';
        driftDetails.push('Web container health endpoint unreachable');
      }
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to fetch web build info');
      webSha = 'unreachable';
      driftDetails.push('Web container health endpoint unreachable');
    }

    // Check for drift
    let drift = false;
    
    if (expectedSha !== 'unknown') {
      if (serverSha !== expectedSha) {
        drift = true;
        driftDetails.push(`Server SHA mismatch: expected ${expectedSha}, got ${serverSha}`);
      }
      if (webSha && webSha !== 'unreachable' && webSha !== expectedSha) {
        drift = true;
        driftDetails.push(`Web SHA mismatch: expected ${expectedSha}, got ${webSha}`);
      }
    } else {
      driftDetails.push('Expected SHA unknown (GIT_SHA not set at build time)');
    }

    const response: DriftResponse = {
      ok: !drift,
      expectedSha,
      running: {
        server: serverSha,
        web: webSha,
      },
      drift,
      driftDetails,
      time: new Date().toISOString(),
    };

    logger.info({ drift, expectedSha, serverSha, webSha }, 'Drift check completed');
    
    return response;
  });

  /**
   * GET /api/ops/health
   * 
   * Simple health check for ops monitoring.
   * Returns basic health info without drift detection overhead.
   */
  app.get('/api/ops/health', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store');
    
    return {
      ok: true,
      service: 'server',
      git_sha: process.env.GIT_SHA || 'unknown',
      build_time: process.env.BUILD_TIME || 'unknown',
      uptime: process.uptime(),
      time: new Date().toISOString(),
    };
  });

  // Note: /api/health/build is registered in index.ts (not here) to avoid duplication

  logger.info('Ops routes registered: /api/ops/drift, /api/ops/health');
}
