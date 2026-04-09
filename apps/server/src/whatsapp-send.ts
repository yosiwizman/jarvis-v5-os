/**
 * WhatsApp Send via OpenClaw Gateway RPC (Direction A)
 *
 * Sends WhatsApp messages through the running OpenClaw gateway's WebSocket RPC
 * surface. OpenClaw retains sole ownership of the Baileys socket — AKIOR never
 * opens a second connection.
 *
 * Refs: W-T05, BLK-003, DEC-031, DEC-032
 */

import { readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { logger } from "./utils/logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type GatewayClientHandle = {
  client: InstanceType<any>;
  token: string;
  url: string;
  connected: boolean;
  connecting: boolean;
  GatewayClientClass: any;
  clientOpts: Record<string, unknown>;
};

export type SendParams = { to: string; message: string };

export type WhatsAppSendErrorCode =
  | "whatsapp_send_unavailable"
  | "gateway_unreachable"
  | "gateway_auth_failed"
  | "gateway_rpc_error"
  | "gateway_timeout"
  | "internal_error";

export type SendResult =
  | { ok: true; messageId: string; toJid: string | null }
  | { ok: false; errorCode: WhatsAppSendErrorCode; detail?: string };

export type ValidationErrorCode =
  | "invalid_target_format"
  | "invalid_message_body"
  | "message_too_long"
  | "unsupported_field"
  | "unsupported_media_type";

export type ValidationResult =
  | { ok: true; value: { to: string; message: string } }
  | { ok: false; status: 400 | 415; error: ValidationErrorCode; detail?: string };

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const SEND_TIMEOUT_MS = 30_000;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const MAX_MESSAGE_LENGTH = 4096;
const ALLOWED_BODY_KEYS = new Set(["to", "message"]);

// ── Helpers ────────────────────────────────────────────────────────────────

function redactPhone(phone: string): string {
  return "***" + phone.slice(-4);
}

// ── Validation (pure function) ─────────────────────────────────────────────

export function validateSendInput(body: unknown): ValidationResult {
  // Content-type sentinel: if body is the string "__UNSUPPORTED_MEDIA_TYPE__", route handler
  // already detected non-JSON content-type and passed this sentinel.
  if (body === "__UNSUPPORTED_MEDIA_TYPE__") {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "invalid_message_body", detail: "body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { ok: false, status: 400, error: "unsupported_field", detail: `unexpected field: ${key}` };
    }
  }

  const to = obj.to;
  if (typeof to !== "string" || !E164_REGEX.test(to)) {
    return { ok: false, status: 400, error: "invalid_target_format", detail: "E.164 required, e.g. +13054098490" };
  }

  const message = obj.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return { ok: false, status: 400, error: "invalid_message_body" };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 400, error: "message_too_long", detail: "max 4096 chars" };
  }

  return { ok: true, value: { to, message: message.trim() } };
}

// ── Init ───────────────────────────────────────────────────────────────────

export async function initWhatsAppGatewayClient(): Promise<GatewayClientHandle | null> {
  let GatewayClientClass: any;
  try {
    const openclawBase = path.join(
      process.env.HOME || "",
      ".npm-global/lib/node_modules/openclaw/dist/plugin-sdk",
    );
    const mod = await import(path.join(openclawBase, "gateway-runtime.js"));
    GatewayClientClass = mod.GatewayClient;
    if (typeof GatewayClientClass !== "function") {
      throw new Error("GatewayClient is not a constructor");
    }
  } catch (err) {
    logger.error({ category: "import", err: String(err) }, "whatsapp.send.init.failure");
    return null;
  }

  let token: string;
  let gatewayUrl = DEFAULT_GATEWAY_URL;
  try {
    const configPath = path.join(process.env.HOME || "", ".openclaw", "openclaw.json");
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);

    const configToken = config?.gateway?.auth?.token;
    if (typeof configToken !== "string" || configToken.trim().length === 0) {
      logger.error({ category: "token" }, "whatsapp.send.init.failure");
      return null;
    }
    token = configToken;

    const configPort = config?.gateway?.port;
    if (typeof configPort === "number" && configPort > 0) {
      gatewayUrl = `ws://127.0.0.1:${configPort}`;
    }
  } catch (err) {
    logger.error({ category: "token", err: String(err) }, "whatsapp.send.init.failure");
    return null;
  }

  const clientOpts = {
    url: gatewayUrl,
    token,
    clientName: "cli",
    clientDisplayName: "akior-server",
    mode: "cli",
    role: "operator",
    scopes: ["operator.write"],
    minProtocol: 3,
    maxProtocol: 3,
    instanceId: randomUUID(),
    deviceIdentity: null,
  };

  logger.info({ gatewayUrl, modulePath: "openclaw/plugin-sdk/gateway-runtime" }, "whatsapp.send.init.success");

  return {
    client: null, // lazy — created per-request
    token,
    url: gatewayUrl,
    connected: false,
    connecting: false,
    GatewayClientClass,
    clientOpts,
  };
}

// ── Send ───────────────────────────────────────────────────────────────────

async function executeGatewayRequest(
  handle: GatewayClientHandle,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err: Error | null, value?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value!);
    };

    const client = new handle.GatewayClientClass({
      ...handle.clientOpts,
      instanceId: randomUUID(),
      onHelloOk: async () => {
        try {
          const result = await client.request(method, params, { timeoutMs: SEND_TIMEOUT_MS });
          settle(null, result as Record<string, unknown>);
          client.stop();
        } catch (err) {
          client.stop();
          settle(err instanceof Error ? err : new Error(String(err)));
        }
      },
      onClose: (code: number, reason: string) => {
        if (!settled) {
          client.stop();
          settle(new Error(`Gateway closed: code=${code} reason=${reason}`));
        }
      },
      onConnectError: (err: Error) => {
        if (!settled) {
          client.stop();
          settle(err);
        }
      },
    });

    const timer = setTimeout(() => {
      if (!settled) {
        client.stop();
        settle(new Error("Gateway request timed out"));
      }
    }, SEND_TIMEOUT_MS + 5_000);

    client.start();
  });
}

export async function sendWhatsAppMessage(
  handle: GatewayClientHandle | null,
  params: SendParams,
): Promise<SendResult> {
  if (!handle) {
    return { ok: false, errorCode: "whatsapp_send_unavailable" };
  }

  const idempotencyKey = randomUUID();
  const rpcParams = {
    to: params.to,
    message: params.message,
    channel: "whatsapp",
    accountId: "default",
    idempotencyKey,
  };

  logger.info(
    { toSuffix: redactPhone(params.to), messageLength: params.message.length },
    "whatsapp.send.request.start",
  );

  try {
    const result = await executeGatewayRequest(handle, "send", rpcParams);
    const messageId = typeof result?.messageId === "string" ? result.messageId : "unknown";
    const toJid = typeof result?.toJid === "string" ? result.toJid : null;

    logger.info({ messageId, toSuffix: redactPhone(params.to) }, "whatsapp.send.request.success");
    return { ok: true, messageId, toJid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (/ECONNREFUSED|disconnected|not connected|socket closed|Gateway closed/i.test(msg)) {
      // Attempt one reconnect
      logger.warn({ err: msg }, "whatsapp.send.reconnect.attempt");
      try {
        const retryResult = await executeGatewayRequest(handle, "send", rpcParams);
        const messageId = typeof retryResult?.messageId === "string" ? retryResult.messageId : "unknown";
        const toJid = typeof retryResult?.toJid === "string" ? retryResult.toJid : null;
        logger.info({ messageId }, "whatsapp.send.reconnect.success");
        return { ok: true, messageId, toJid };
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        logger.error({ err: retryMsg }, "whatsapp.send.reconnect.failure");
        return { ok: false, errorCode: "gateway_unreachable", detail: retryMsg };
      }
    }

    if (/auth|unauthorized|forbidden|invalid token/i.test(msg)) {
      logger.error({ err: msg }, "whatsapp.send.request.failure");
      return { ok: false, errorCode: "gateway_auth_failed" };
    }

    if (/timed out|timeout/i.test(msg)) {
      logger.error({ err: msg }, "whatsapp.send.request.failure");
      return { ok: false, errorCode: "gateway_timeout" };
    }

    logger.error({ err: msg }, "whatsapp.send.request.failure");
    return { ok: false, errorCode: "gateway_rpc_error", detail: msg };
  }
}

// ── Close ──────────────────────────────────────────────────────────────────

export async function closeWhatsAppGatewayClient(
  handle: GatewayClientHandle | null,
): Promise<void> {
  if (!handle) return;
  try {
    if (handle.client && typeof (handle.client as any).stop === "function") {
      (handle.client as any).stop();
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "whatsapp.send.close.error");
  }
}
