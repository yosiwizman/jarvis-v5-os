/**
 * Remote Access Routes
 *
 * Admin-gated endpoints for optional Tailscale Serve remote access:
 * - GET /api/admin/remote-access/status - Get remote access status
 * - POST /api/admin/remote-access/enable - Enable remote access
 * - POST /api/admin/remote-access/disable - Disable remote access
 *
 * SECURITY:
 * - Admin PIN required for all endpoints
 * - authKey is NEVER logged or stored
 * - Only operational state is persisted
 * - No inbound WAN ports opened
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { execSync, exec } from 'child_process';
import { z } from 'zod';
import { requireAdmin } from './auth.routes.js';
import {
  getRemoteAccessConfig,
  enableRemoteAccess,
  disableRemoteAccess,
  type RemoteAccessMode,
} from '../storage/remoteAccessStore.js';
import { logger } from '../utils/logger.js';

// Environment variable to mock Tailscale in CI
const MOCK_TAILSCALE = process.env.MOCK_TAILSCALE === 'true' || process.env.CI === 'true';

// Default port for AKIOR web service
const DEFAULT_SERVE_PORT = parseInt(process.env.AKIOR_WEB_PORT || '3000', 10);

interface TailscaleStatus {
  installed: boolean;
  version?: string;
  up: boolean;
  tailscaleIp?: string;
  hostname?: string;
  magicDnsName?: string;
}

interface RemoteAccessStatus {
  ok: boolean;
  mode: RemoteAccessMode;
  tailscaleInstalled: boolean;
  tailscaleUp: boolean;
  serveEnabled: boolean;
  suggestedUrl?: string;
  tailscaleIp?: string;
  tailscaleHostname?: string;
}

const EnableBodySchema = z.object({
  mode: z.enum(['tailscale']),
  authKey: z.string().optional(),
});

/**
 * Get Tailscale status by running tailscale status command
 */
function getTailscaleStatus(): TailscaleStatus {
  if (MOCK_TAILSCALE) {
    // Return mock data for CI testing
    return {
      installed: true,
      version: '1.56.0-mock',
      up: false,
      tailscaleIp: undefined,
      hostname: undefined,
      magicDnsName: undefined,
    };
  }

  const status: TailscaleStatus = {
    installed: false,
    up: false,
  };

  try {
    // Check if tailscale is installed
    const versionOutput = execSync('tailscale version', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    status.installed = true;
    // Extract version from output like "1.56.1\n  go1.21.5\n  ..."
    const versionMatch = versionOutput.match(/^(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      status.version = versionMatch[1];
    }
  } catch (error) {
    // Tailscale not installed
    return status;
  }

  try {
    // Get detailed status
    const statusOutput = execSync('tailscale status --json', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const statusData = JSON.parse(statusOutput);
    
    // Check if connected to tailnet
    status.up = statusData.BackendState === 'Running';
    
    if (statusData.Self) {
      status.tailscaleIp = statusData.Self.TailscaleIPs?.[0];
      status.hostname = statusData.Self.HostName;
      status.magicDnsName = statusData.Self.DNSName?.replace(/\.$/, ''); // Remove trailing dot
    }
  } catch (error) {
    // tailscale status failed - likely not connected
    logger.debug({ error }, 'tailscale status failed');
  }

  return status;
}

/**
 * Check if tailscale serve is currently enabled
 */
function isTailscaleServeEnabled(): boolean {
  if (MOCK_TAILSCALE) {
    return false;
  }

  try {
    const serveStatus = execSync('tailscale serve status', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // If output contains port mappings, serve is enabled
    return serveStatus.includes('https://') || serveStatus.includes('http://');
  } catch (error) {
    // serve not enabled or error
    return false;
  }
}

/**
 * Run tailscale up with optional auth key
 * SECURITY: authKey is never logged
 */
async function runTailscaleUp(authKey?: string): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_TAILSCALE) {
    // Simulate success in mock mode
    logger.info('[MOCK] tailscale up simulated');
    return { ok: true };
  }

  return new Promise((resolve) => {
    const args = authKey ? `--authkey=${authKey}` : '';
    // SECURITY: Do not log the authKey
    logger.info('Starting tailscale up' + (authKey ? ' (with authkey)' : ''));

    exec(`tailscale up ${args}`.trim(), { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        // SECURITY: Redact any potential authkey from error messages
        const safeError = (stderr || error.message).replace(/--authkey=\S+/g, '--authkey=[REDACTED]');
        logger.error({ safeError }, 'tailscale up failed');
        resolve({ ok: false, error: safeError });
        return;
      }

      logger.info('tailscale up completed successfully');
      resolve({ ok: true });
    });
  });
}

/**
 * Enable tailscale serve to proxy to local AKIOR web port
 */
async function enableTailscaleServe(port: number): Promise<{ ok: boolean; error?: string; url?: string }> {
  if (MOCK_TAILSCALE) {
    logger.info({ port }, '[MOCK] tailscale serve enabled');
    return { ok: true, url: 'https://mock-device.tail12345.ts.net/' };
  }

  return new Promise((resolve) => {
    // Enable HTTPS serve on port 443 proxying to local web port
    const command = `tailscale serve --bg https:443 / http://127.0.0.1:${port}`;
    logger.info({ command }, 'Enabling tailscale serve');

    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        logger.error({ error: stderr || error.message }, 'tailscale serve failed');
        resolve({ ok: false, error: stderr || error.message });
        return;
      }

      // Get the serve URL
      const tailscale = getTailscaleStatus();
      const url = tailscale.magicDnsName ? `https://${tailscale.magicDnsName}/` : undefined;

      logger.info({ url }, 'tailscale serve enabled');
      resolve({ ok: true, url });
    });
  });
}

/**
 * Disable tailscale serve
 */
async function disableTailscaleServe(): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_TAILSCALE) {
    logger.info('[MOCK] tailscale serve disabled');
    return { ok: true };
  }

  return new Promise((resolve) => {
    exec('tailscale serve --bg off', { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        // "off" might fail if nothing is served - that's ok
        logger.debug({ error: stderr || error.message }, 'tailscale serve off (may be already off)');
      }

      logger.info('tailscale serve disabled');
      resolve({ ok: true });
    });
  });
}

export function registerRemoteAccessRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/remote-access/status
   *
   * Get current remote access status.
   * Admin authentication required.
   */
  fastify.get('/api/admin/remote-access/status', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const config = getRemoteAccessConfig();
    const tailscale = getTailscaleStatus();
    const serveEnabled = isTailscaleServeEnabled();

    const status: RemoteAccessStatus = {
      ok: true,
      mode: config.mode,
      tailscaleInstalled: tailscale.installed,
      tailscaleUp: tailscale.up,
      serveEnabled,
      tailscaleIp: tailscale.tailscaleIp,
      tailscaleHostname: tailscale.hostname,
    };

    // Suggest URL if serve is enabled
    if (serveEnabled && tailscale.magicDnsName) {
      status.suggestedUrl = `https://${tailscale.magicDnsName}/`;
    } else if (config.tailscaleHostname) {
      status.suggestedUrl = `https://${config.tailscaleHostname}/`;
    }

    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return reply.send(status);
  });

  /**
   * POST /api/admin/remote-access/enable
   *
   * Enable remote access via Tailscale Serve.
   * Admin authentication required.
   *
   * SECURITY: authKey is never logged or stored
   */
  fastify.post('/api/admin/remote-access/enable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const parsed = EnableBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: 'invalid_request',
        message: 'Invalid request body. Expected { mode: "tailscale", authKey?: string }',
      });
    }

    const { mode, authKey } = parsed.data;
    // SECURITY: Never log authKey
    logger.info({ mode, hasAuthKey: !!authKey }, 'Remote access enable requested');

    // Check Tailscale installation
    const tailscale = getTailscaleStatus();
    if (!tailscale.installed) {
      return reply.status(400).send({
        ok: false,
        error: 'tailscale_not_installed',
        message: 'Tailscale is not installed on this system.',
        suggestion: 'Install Tailscale from https://tailscale.com/download and try again.',
      });
    }

    // If authKey provided and not connected, run tailscale up
    if (authKey && !tailscale.up) {
      const upResult = await runTailscaleUp(authKey);
      if (!upResult.ok) {
        return reply.status(500).send({
          ok: false,
          error: 'tailscale_up_failed',
          message: upResult.error || 'Failed to connect to Tailscale',
        });
      }
    }

    // Verify connection
    const updatedTailscale = getTailscaleStatus();
    if (!updatedTailscale.up) {
      return reply.status(400).send({
        ok: false,
        error: 'tailscale_not_connected',
        message: 'Tailscale is not connected to a tailnet.',
        suggestion: 'Provide an auth key or run "tailscale up" manually first.',
      });
    }

    // Enable serve
    const serveResult = await enableTailscaleServe(DEFAULT_SERVE_PORT);
    if (!serveResult.ok) {
      return reply.status(500).send({
        ok: false,
        error: 'tailscale_serve_failed',
        message: serveResult.error || 'Failed to enable Tailscale Serve',
      });
    }

    // Persist config (without authKey!)
    enableRemoteAccess(mode, DEFAULT_SERVE_PORT, updatedTailscale.magicDnsName);

    return reply.send({
      ok: true,
      mode,
      serveEnabled: true,
      suggestedUrl: serveResult.url,
      tailscaleHostname: updatedTailscale.hostname,
    });
  });

  /**
   * POST /api/admin/remote-access/disable
   *
   * Disable remote access (turns off Tailscale Serve).
   * Admin authentication required.
   */
  fastify.post('/api/admin/remote-access/disable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    logger.info('Remote access disable requested');

    // Disable serve
    const serveResult = await disableTailscaleServe();
    if (!serveResult.ok) {
      logger.warn({ error: serveResult.error }, 'Failed to disable serve (may be already off)');
    }

    // Update config
    disableRemoteAccess();

    return reply.send({
      ok: true,
      mode: 'disabled',
      serveEnabled: false,
    });
  });
}
