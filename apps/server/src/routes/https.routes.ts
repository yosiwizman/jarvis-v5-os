/**
 * HTTPS Routes
 *
 * Admin-gated endpoints for HTTPS certificate management:
 * - GET /api/admin/https/ca - Download Caddy root CA certificate (PEM)
 * - GET /api/admin/https/status - Get HTTPS/CA status
 *
 * SECURITY:
 * - Admin PIN required for all endpoints
 * - Never returns private keys
 * - Certificate fingerprint computed server-side
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import * as crypto from "crypto";
import path from "path";
import { requireAdmin, requireAdminOrSetup } from "./auth.routes.js";
import { logger } from "../utils/logger.js";

// Common paths where Caddy stores its internal CA
const CADDY_CA_PATHS = [
  // Local development / direct install
  "/data/caddy/pki/authorities/local/root.crt",
  // Docker volume mount
  "/var/lib/caddy/pki/authorities/local/root.crt",
  // Relative to server (for testing)
  "./data/caddy/pki/authorities/local/root.crt",
];

// Environment variable for custom CA path
const CUSTOM_CA_PATH = process.env.CADDY_CA_PATH;

type HttpsMode = "lan-caddy-internal-ca" | "lan-custom-ca" | "disabled";

interface HttpsStatus {
  ok: boolean;
  caAvailable: boolean;
  caFingerprint?: string;
  httpsMode: HttpsMode;
  caSource?: string;
}

/**
 * Attempt to find the Caddy CA certificate file
 */
function findCaCertPath(): string | null {
  // Check custom path first
  if (CUSTOM_CA_PATH && existsSync(CUSTOM_CA_PATH)) {
    return CUSTOM_CA_PATH;
  }

  // Check known paths
  for (const candidatePath of CADDY_CA_PATHS) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

/**
 * Try to extract CA from Docker container if running in Docker environment
 */
function extractCaFromDocker(): Buffer | null {
  try {
    // Check if akior-caddy container is running
    const containerCheck = execSync(
      'docker ps --filter "name=akior-caddy" --format "{{.Names}}"',
      { encoding: "utf-8", timeout: 5000 },
    ).trim();

    if (!containerCheck) {
      return null;
    }

    // Extract certificate from container
    const certContent = execSync(
      "docker exec akior-caddy cat /data/caddy/pki/authorities/local/root.crt",
      { encoding: "utf-8", timeout: 10000 },
    );

    if (certContent && certContent.includes("BEGIN CERTIFICATE")) {
      return Buffer.from(certContent, "utf-8");
    }
  } catch (error) {
    // Docker not available or container not running - this is expected in many setups
    logger.debug({ error }, "Could not extract CA from Docker container");
  }

  return null;
}

/**
 * Read the CA certificate content
 */
function readCaCert(): { content: Buffer; source: string } | null {
  // Try local file paths first
  const localPath = findCaCertPath();
  if (localPath) {
    try {
      const content = readFileSync(localPath);
      return { content, source: "file" };
    } catch (error) {
      logger.warn(
        { path: localPath, error },
        "Failed to read CA certificate from file",
      );
    }
  }

  // Try Docker extraction
  const dockerCert = extractCaFromDocker();
  if (dockerCert) {
    return { content: dockerCert, source: "docker" };
  }

  return null;
}

/**
 * Compute SHA-256 fingerprint of a certificate
 */
function computeCertFingerprint(certPem: Buffer): string {
  // Parse PEM to DER
  const pemString = certPem.toString("utf-8");
  const matches = pemString.match(
    /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/,
  );

  if (!matches || !matches[1]) {
    throw new Error("Invalid PEM certificate");
  }

  const der = Buffer.from(matches[1].replace(/\s/g, ""), "base64");
  const hash = crypto.createHash("sha256").update(der).digest("hex");

  // Format as colon-separated pairs
  return hash.toUpperCase().match(/.{2}/g)?.join(":") || hash.toUpperCase();
}

export function registerHttpsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/https/ca
   *
   * Download the Caddy root CA certificate (PEM format).
   * Admin authentication required.
   */
  fastify.get(
    "/api/admin/https/ca",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!requireAdmin(req, reply)) return;

      const cert = readCaCert();

      if (!cert) {
        logger.warn("CA certificate requested but not available");
        return reply.status(404).send({
          ok: false,
          error: "ca_not_available",
          message:
            "Caddy CA certificate not found. Ensure the Caddy server is running and has generated its internal CA.",
          suggestion:
            "Try accessing https://akior.home.arpa once to trigger certificate generation.",
        });
      }

      // Verify it's actually a certificate (not a private key)
      const certString = cert.content.toString("utf-8");
      if (certString.includes("PRIVATE KEY")) {
        logger.error("CA file contains private key - refusing to serve");
        return reply.status(500).send({
          ok: false,
          error: "security_violation",
          message:
            "CA file contains private key material. This should not happen.",
        });
      }

      if (!certString.includes("BEGIN CERTIFICATE")) {
        logger.error("CA file does not contain a certificate");
        return reply.status(500).send({
          ok: false,
          error: "invalid_certificate",
          message: "CA file does not contain a valid certificate.",
        });
      }

      logger.info({ source: cert.source }, "CA certificate downloaded");

      // Send as file download
      reply.header("Content-Type", "application/x-pem-file");
      reply.header(
        "Content-Disposition",
        'attachment; filename="akior-local-ca.pem"',
      );
      reply.header("Cache-Control", "no-store, no-cache, must-revalidate");

      return reply.send(cert.content);
    },
  );

  /**
   * GET /api/admin/https/status
   *
   * Get HTTPS/CA status information.
   * Allowed during initial setup (no PIN configured) or with admin session.
   */
  fastify.get(
    "/api/admin/https/status",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!requireAdminOrSetup(req, reply)) return;

      const cert = readCaCert();

      const status: HttpsStatus = {
        ok: true,
        caAvailable: false,
        httpsMode: "disabled",
      };

      if (cert) {
        status.caAvailable = true;
        status.httpsMode = CUSTOM_CA_PATH
          ? "lan-custom-ca"
          : "lan-caddy-internal-ca";
        status.caSource = cert.source;

        try {
          status.caFingerprint = computeCertFingerprint(cert.content);
        } catch (error) {
          logger.warn({ error }, "Failed to compute CA fingerprint");
        }
      }

      reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return reply.send(status);
    },
  );
}
