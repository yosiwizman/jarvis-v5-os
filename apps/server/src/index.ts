import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { Server as IOServer } from "socket.io";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import crypto from "crypto";
import { readFile, writeFile, rm } from "fs/promises";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { setTimeout as delay } from "timers/promises";
import { z } from "zod";
import type { ModelJob, ModelJobOutputs } from "@shared/core";
import { registerKeyRoutes } from "./routes/keys.routes.js";
import { registerAuthRoutes, requireAdmin } from "./routes/auth.routes.js";
import { register3DPrintRoutes } from "./routes/3dprint.routes.js";
import { registerSmartHomeRoutes } from "./routes/smarthome.routes.js";
import { registerLockdownRoutes } from "./routes/lockdown.routes.js";
import { registerLLMRoutes } from "./routes/llm.routes.js";
import { registerHttpsRoutes } from "./routes/https.routes.js";
import { registerRemoteAccessRoutes } from "./routes/remote-access.routes.js";
import { registerOpsRoutes } from "./routes/ops.routes.js";
import { initializeLockdownService } from "./services/lockdownService.js";
import { readSecrets } from "./storage/secretStore.js";
import { isPinConfigured } from "./auth/index.js";
import {
  isLLMConfigured,
  getLLMConfigPublic,
  getLLMConfigInternal,
} from "./storage/llmConfigStore.js";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { notificationScheduler } from "./notificationScheduler.js";
import type {
  ScheduleNotificationRequest,
  ScheduleNotificationResponse,
} from "@shared/core";
import {
  logger,
  logSystemEvent,
  logApiRequest,
  createRequestLogger,
} from "./utils/logger.js";
import { registerSecurityHeaders, checkRateLimit, getClientIp, RateLimitPresets } from "./security/index.js";
import {
  validateAndNormalizeSettings,
  safeJsonParse,
  getDefaultSettings,
} from "./utils/settingsContract.js";
import {
  initConversationStore,
  saveConversation,
  getConversation,
  listConversations,
  searchConversations,
  deleteConversation,
  createConversation,
  addMessage,
  getStats as getConversationStats,
  type Conversation,
  type SearchQuery as ConversationSearchQuery,
} from "./storage/conversationStore.js";
import {
  initActionStore,
  recordAction,
  queryActions,
  getAction,
  cleanupOldActions,
  getActionStats,
  recordNotificationScheduled,
  recordNotificationDelivered,
  type Action,
  type ActionQuery,
} from "./storage/actionStore.js";
import {
  initWhatsAppGatewayClient,
  sendWhatsAppMessage,
  closeWhatsAppGatewayClient,
  validateSendInput,
  type GatewayClientHandle,
} from "./whatsapp-send.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..", "..");

const toAbsolutePath = (value: string) =>
  path.isAbsolute(value) ? value : path.resolve(repoRoot, value);

const resolveFirstExisting = (paths: string[]) => {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

const certDirCandidates: string[] = [];
for (const candidate of [
  process.env.SERVER_TLS_CERT_DIR,
  process.env.CERT_DIR,
]) {
  if (candidate && candidate.trim()) {
    certDirCandidates.push(toAbsolutePath(candidate.trim()));
  }
}
certDirCandidates.push(path.join(serverRoot, "certs"));
certDirCandidates.push(path.join(repoRoot, "infra/certs"));
certDirCandidates.push(path.join(serverRoot, "infra/certs"));

const certDir =
  resolveFirstExisting(certDirCandidates) ?? certDirCandidates[0]!;

const explicitCertName =
  process.env.SERVER_TLS_CERT_NAME?.trim() || process.env.CERT_NAME?.trim();
const fallbackCertName = existsSync(path.join(certDir, "jarvis.local.pem"))
  ? "jarvis.local"
  : "localhost";
const certName = explicitCertName || fallbackCertName;

const keyPathEnv =
  process.env.SERVER_TLS_KEY_PATH?.trim() || process.env.CERT_KEY?.trim();
const certPathEnv =
  process.env.SERVER_TLS_CERT_PATH?.trim() || process.env.CERT_CRT?.trim();

const resolvedKeyPath = keyPathEnv
  ? toAbsolutePath(keyPathEnv)
  : path.join(certDir, `${certName}-key.pem`);
const resolvedCertPath = certPathEnv
  ? toAbsolutePath(certPathEnv)
  : path.join(certDir, `${certName}.pem`);

// Allow forcing HTTP mode in CI/test environments (Next.js rewrites can't proxy to self-signed HTTPS)
const forceHttp =
  process.env.DISABLE_HTTPS === "true" || process.env.DISABLE_HTTPS === "1";
const hasCertificates =
  !forceHttp && existsSync(resolvedKeyPath) && existsSync(resolvedCertPath);

const fastify = Fastify({
  logger: true,
  bodyLimit: 20 * 1024 * 1024,
  ...(hasCertificates
    ? {
        https: {
          key: readFileSync(resolvedKeyPath),
          cert: readFileSync(resolvedCertPath),
        },
      }
    : {}),
});

if (!hasCertificates) {
  logger.warn(
    `HTTPS certificates not found (looked for key at "${resolvedKeyPath}" and cert at "${resolvedCertPath}"). Falling back to HTTP. Configure SERVER_TLS_CERT_NAME/CERT_NAME, SERVER_TLS_KEY_PATH/CERT_KEY, or SERVER_TLS_CERT_PATH/CERT_CRT to point to valid certificates.`,
  );
} else {
  logger.info(
    { keyPath: resolvedKeyPath, certPath: resolvedCertPath },
    "Loaded TLS certificates",
  );
}

const io = new IOServer(fastify.server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Initialize Lockdown Service with Socket.io
initializeLockdownService(io);
logger.info("Lockdown service initialized");

await fastify.register(fastifyCors, {
  origin: (origin, cb) => {
    cb(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});
await fastify.register(fastifyCookie);
await fastify.register(multipart);

// Register security headers middleware (applies to all responses)
registerSecurityHeaders(fastify);
logger.info("Security headers middleware registered");

const config = {
  openai: {
    realtimeModel: "gpt-realtime-mini",
  },
  rtc: {
    stun: ["stun:stun.l.google.com:19302"],
    sfu: null as string | null,
  },
};

fastify.get("/api/config", async () => ({
  rtc: config.rtc,
  features: { voice: true, security: true, mesh: true, image: true },
  defaults: {
    voices: ["alloy", "verse", "luna"],
    realtimeModels: [
      "gpt-realtime-mini",
      "gpt-realtime",
      "gpt-audio-mini",
      "gpt-audio",
    ],
  },
}));

// Health check endpoint for container orchestration (Fly.io, K8s, etc.)
fastify.get("/api/health", async () => ({
  ok: true,
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  build: {
    gitSha: process.env.GIT_SHA || "unknown",
    buildTime: process.env.BUILD_TIME || "unknown",
  },
}));

// Build info endpoint for deployment drift detection
// This endpoint is used by operators to verify which version is running
fastify.get("/api/health/build", async (req, reply) => {
  reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
  reply.header("Pragma", "no-cache");
  return {
    ok: true,
    git_sha: process.env.GIT_SHA || "unknown",
    build_time: process.env.BUILD_TIME || "unknown",
    app_version: process.env.npm_package_version || "6.2.0",
    service: "server",
    env: {
      node_env: process.env.NODE_ENV || "unknown",
    },
    time: new Date().toISOString(),
  };
});

// System status endpoint - semantic levels for UI status indicators
// Levels: healthy | setup_required | degraded | error
fastify.get("/api/health/status", async (req, reply) => {
  reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
  reply.header("Pragma", "no-cache");

  const reasons: string[] = [];
  let level: "healthy" | "setup_required" | "degraded" | "error" = "healthy";

  // Check if owner PIN is configured (required for first-run setup)
  const pinConfigured = isPinConfigured();
  if (!pinConfigured) {
    level = "setup_required";
    reasons.push("Owner PIN not configured");
  }

  // Check LLM provider configuration
  const llmStatus = isLLMConfigured();
  const llmConfig = getLLMConfigPublic();
  const secrets = readSecrets();

  if (!llmStatus.configured && llmStatus.reason) {
    level = "setup_required";
    reasons.push(llmStatus.reason);
  }

  // Check notification subsystem health
  let notificationHealth = { ok: true, clientCount: 0 };
  try {
    const sseHealth = notificationScheduler.getSSEHealth();
    // SSE is healthy if it's enabled (always true for now)
    notificationHealth = {
      ok: sseHealth.enabled,
      clientCount: sseHealth.connected_clients,
    };
  } catch {
    // Scheduler not yet initialized, treat as ok
  }

  // Build details object
  const details = {
    auth: {
      pinConfigured,
    },
    llm: {
      provider: llmConfig.provider,
      configured: llmStatus.configured,
      baseUrlHost: llmConfig.baseUrlHost,
    },
    keys: {
      openai: Boolean(secrets.openai),
      meshy: Boolean(secrets.meshy),
    },
    notifications: notificationHealth,
    uptime: process.uptime(),
  };

  return {
    ok: level === "healthy",
    level,
    reasons,
    details,
    setup: {
      ownerPin: pinConfigured,
      llm: llmStatus.configured,
      llmProvider: llmConfig.provider,
    },
    git_sha: process.env.GIT_SHA || "unknown",
    time: new Date().toISOString(),
  };
});

// API key validation endpoint - tests keys without exposing them
fastify.post("/api/admin/keys/validate", async (req, reply) => {
  const body = req.body as { key?: string; provider?: string };

  if (!body.key || typeof body.key !== "string") {
    return reply.status(400).send({ ok: false, error: "key is required" });
  }

  const provider = body.provider || "openai";

  if (provider === "openai") {
    // Test OpenAI key with a minimal models list request
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${body.key}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        return reply.send({
          ok: true,
          provider: "openai",
          message: "API key is valid",
        });
      } else if (response.status === 401) {
        return reply.send({
          ok: false,
          provider: "openai",
          error: "Invalid API key",
        });
      } else {
        return reply.send({
          ok: false,
          provider: "openai",
          error: `API returned status ${response.status}`,
        });
      }
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        provider: "openai",
        error: "Failed to validate key - network error",
      });
    }
  } else if (provider === "meshy") {
    // Test Meshy key with a balance check
    try {
      const response = await fetch("https://api.meshy.ai/v1/balance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${body.key}`,
        },
      });

      if (response.ok) {
        return reply.send({
          ok: true,
          provider: "meshy",
          message: "API key is valid",
        });
      } else if (response.status === 401 || response.status === 403) {
        return reply.send({
          ok: false,
          provider: "meshy",
          error: "Invalid API key",
        });
      } else {
        return reply.send({
          ok: false,
          provider: "meshy",
          error: `API returned status ${response.status}`,
        });
      }
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        provider: "meshy",
        error: "Failed to validate key - network error",
      });
    }
  } else {
    return reply.status(400).send({
      ok: false,
      error: `Unknown provider: ${provider}`,
    });
  }
});

// Initialize storage systems
logSystemEvent("server_starting");

// Define data directory and settings file path
const DATA_DIR = path.join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// ── G-T06.D9: browser-session provider lane entry point ──
// Unified per-provider logic lives in apps/server/src/channels/. The route
// handlers below only read route-bound providerId values and delegate to the
// shared adapter; D6/D7/D8 helper duplication has been removed.
import {
  loadGatewayConfigFromDisk,
  providerStatus,
  providerConnect,
  providerDisconnect,
  killSpawnedProcess,
  readGmailInboxSummary,
  readGmailInbox,
  readGoogleCalendarEvents,
} from "./channels/providers/browserSession.js";
import {
  CHANNEL_PROVIDERS,
  getProviderDescriptor,
  listBrowserSessionProviders,
  listProvidersByCategory,
} from "./channels/registry.js";
import {
  ensureGatewayDefaultAccount,
  getAccountById as getChannelAccountById,
  listAccountsByProvider,
  mintAccount as mintChannelAccount,
  removeAccount as removeChannelAccount,
  loadUnifiedAccountsIndex,
  BROWSER_PROFILE_ROOT,
} from "./channels/accountsIndex.js";

const GATEWAY_CONFIG = loadGatewayConfigFromDisk();

// G-T06.D11: OpenClaw gateway keep-alive. The gateway auto-idles its
// managed Chrome after inactivity, which surfaces as a spurious Gmail
// "Not Connected" state in the Channels UI (caught by the D10 operator
// false alarm). This ping runs every 30s, checks if the gateway is
// already up, and if so pings the CDP port's /json/version to keep
// Chrome awake. If the gateway is down it does nothing — we do NOT
// auto-start Chrome; that's still a user-initiated action via the UI.
// Errors are swallowed silently so this background tick never escalates.
const GATEWAY_KEEPALIVE_INTERVAL_MS = 30_000;
setInterval(async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${GATEWAY_CONFIG.port}/`, {
      headers: { Authorization: `Bearer ${GATEWAY_CONFIG.authToken}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as any;
    if (!data?.running || !data?.cdpPort) return;
    await fetch(`http://127.0.0.1:${data.cdpPort}/json/version`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch {
    /* swallow — keep-alive must never throw */
  }
}, GATEWAY_KEEPALIVE_INTERVAL_MS).unref();

// ── WhatsApp DEC-032 Direct-Import Helpers ──
type WaState = "idle" | "awaiting_scan" | "linked" | "timed_out" | "cancelled";
interface WaSession {
  state: WaState;
  qrDataUrl: string | null;
  message: string | null;
  startedAt: number | null;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  waitPromise: Promise<any> | null;
}

// ── WhatsApp Send via OpenClaw Gateway RPC (Direction A, W-T05) ──
let whatsappGatewayHandle: GatewayClientHandle | null = null;

const waSession: WaSession = {
  state: "idle",
  qrDataUrl: null,
  message: null,
  startedAt: null,
  timeoutHandle: null,
  waitPromise: null,
};

function resetWaSession() {
  if (waSession.timeoutHandle) clearTimeout(waSession.timeoutHandle);
  waSession.state = "idle";
  waSession.qrDataUrl = null;
  waSession.message = null;
  waSession.startedAt = null;
  waSession.timeoutHandle = null;
  waSession.waitPromise = null;
}

// G-T06.D6: unified channel-state mapping for WhatsApp.
type ChannelStateLite = "disconnected" | "connecting" | "connected" | "error" | "reconnect_needed";
function deriveWhatsAppChannelState(s: WaState): ChannelStateLite {
  switch (s) {
    case "linked": return "connected";
    case "awaiting_scan": return "connecting";
    case "timed_out": return "error";
    case "cancelled":
    case "idle":
    default: return "disconnected";
  }
}

let waModuleCache: { startWebLoginWithQr: Function; waitForWebLogin: Function } | null = null;

async function resolveWaModule() {
  if (waModuleCache) return waModuleCache;
  const distDir = path.join(process.env.HOME || "", ".npm-global/lib/node_modules/openclaw/dist");
  const candidates = readdirSync(distDir).filter(
    (f: string) => f.startsWith("login-qr-") && f.endsWith(".js") && !f.startsWith("login-qr-api-")
  );
  if (candidates.length === 0) throw new Error("OpenClaw WhatsApp module not found (zero candidates in dist/)");
  if (candidates.length > 1) throw new Error(`OpenClaw WhatsApp module ambiguous (${candidates.length} candidates: ${candidates.join(", ")})`);
  const mod = await import(path.join(distDir, candidates[0]));
  if (typeof mod.startWebLoginWithQr !== "function" || typeof mod.waitForWebLogin !== "function") {
    throw new Error("OpenClaw WhatsApp module missing expected exports");
  }
  waModuleCache = { startWebLoginWithQr: mod.startWebLoginWithQr, waitForWebLogin: mod.waitForWebLogin };
  return waModuleCache;
}


// Initialize conversation store
await initConversationStore();
logger.info("Conversation store initialized");

// Initialize action store
await initActionStore();
logger.info("Action store initialized");

// Initialize notification scheduler
await notificationScheduler.initialize();
logger.info("Notification scheduler initialized");


// Add request logging middleware
fastify.addHook("onRequest", createRequestLogger());

// Notification API: Schedule a notification
fastify.post("/api/notifications/schedule", async (req, reply) => {
  const body = req.body as Partial<ScheduleNotificationRequest>;

  // Validate required fields
  if (!body.type || typeof body.type !== "string") {
    return reply.status(400).send({
      ok: false,
      error: "type is required and must be a string",
    } as ScheduleNotificationResponse);
  }

  if (!body.payload || typeof body.payload !== "object") {
    return reply.status(400).send({
      ok: false,
      error: "payload is required and must be an object",
    } as ScheduleNotificationResponse);
  }

  if (!body.triggerAt || typeof body.triggerAt !== "string") {
    return reply.status(400).send({
      ok: false,
      error: "triggerAt is required and must be an ISO 8601 timestamp string",
    } as ScheduleNotificationResponse);
  }

  // Validate ISO timestamp format
  const triggerDate = new Date(body.triggerAt);
  if (isNaN(triggerDate.getTime())) {
    return reply.status(400).send({
      ok: false,
      error: "triggerAt must be a valid ISO 8601 timestamp",
    } as ScheduleNotificationResponse);
  }

  try {
    const eventId = await notificationScheduler.scheduleEvent(
      body.type,
      body.payload,
      body.triggerAt,
    );

    // Record action
    await recordNotificationScheduled(
      eventId,
      body.type,
      body.triggerAt,
      body.payload,
    );

    logger.info(
      { eventId, type: body.type, triggerAt: body.triggerAt },
      "Notification scheduled",
    );

    return reply.send({ ok: true, eventId } as ScheduleNotificationResponse);
  } catch (error) {
    logger.error({ error, type: body.type }, "Failed to schedule notification");
    return reply.status(500).send({
      ok: false,
      error: "failed_to_schedule_notification",
    } as ScheduleNotificationResponse);
  }
});

// Notification API: Get notification history with filtering and pagination
fastify.get("/api/notifications/history", async (req, reply) => {
  try {
    const query = req.query as {
      type?: string;
      limit?: string;
      offset?: string;
    };
    const type = query.type;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // Get all fired events
    let firedEvents = notificationScheduler.getFiredEvents();

    // Filter by type if specified
    if (type) {
      firedEvents = firedEvents.filter((e) => e.type === type);
    }

    // Sort by firedAt descending (most recent first)
    firedEvents.sort((a, b) => {
      const aTime = a.firedAt ? new Date(a.firedAt).getTime() : 0;
      const bTime = b.firedAt ? new Date(b.firedAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply pagination
    const total = firedEvents.length;
    const paginated = firedEvents.slice(offset, offset + limit);

    logger.info(
      { total, type, limit, offset, returned: paginated.length },
      "Notification history accessed",
    );

    return reply.send({
      ok: true,
      notifications: paginated,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error({ error }, "Failed to retrieve notification history");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_retrieve_history" });
  }
});

// Notification API: SSE stream for real-time notification delivery
fastify.get("/api/notifications/stream", async (req, reply) => {
  // Set SSE headers with best practices for reverse proxy compatibility
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx/reverse proxy buffering
  });

  // Generate client ID
  const clientId = randomUUID();

  // Register SSE client
  notificationScheduler.registerSSEClient(clientId, (data: string) => {
    try {
      reply.raw.write(data);
    } catch (error) {
      logger.error({ clientId, error }, "Failed to write SSE data to client");
    }
  });

  logger.info({ clientId }, "SSE client connected to notification stream");

  // Send initial connection confirmation
  const connectionMsg = {
    type: "connection",
    id: `conn-${Date.now()}`,
    payload: { status: "connected", clientId },
    triggeredAt: new Date().toISOString(),
  };
  reply.raw.write(`data: ${JSON.stringify(connectionMsg)}\n\n`);

  // Handle client disconnect
  req.raw.on("close", () => {
    notificationScheduler.unregisterSSEClient(clientId);
    logger.info(
      { clientId },
      "SSE client disconnected from notification stream",
    );
  });

  // Keep connection alive (don't await, let it stay open)
  return reply;
});

// Notification API: Health check for SSE/notifications subsystem
fastify.get("/api/health/notifications", async (req, reply) => {
  try {
    const sseHealth = notificationScheduler.getSSEHealth();
    const stats = notificationScheduler.getStats();

    return reply.send({
      ok: true,
      sse: sseHealth,
      stats: {
        scheduled: stats.scheduledEvents,
        fired: stats.firedEvents,
      },
      time: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get notification health");
    return reply.status(500).send({ ok: false, error: "health_check_failed" });
  }
});

// ========================================
// Conversation Management API
// ========================================

// Save a conversation
fastify.post("/api/conversations/save", async (req, reply) => {
  try {
    const conversation = req.body as Partial<Conversation>;

    // Validate required fields
    if (!conversation.id || !conversation.source) {
      return reply
        .status(400)
        .send({ ok: false, error: "id and source are required" });
    }

    if (!Array.isArray(conversation.messages)) {
      return reply
        .status(400)
        .send({ ok: false, error: "messages must be an array" });
    }

    await saveConversation(conversation as Conversation);
    logger.info(
      {
        conversationId: conversation.id,
        messageCount: conversation.messages.length,
      },
      "Conversation saved",
    );

    return reply.send({ ok: true, conversationId: conversation.id });
  } catch (error) {
    logger.error({ error }, "Failed to save conversation");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to save conversation" });
  }
});

// Get a conversation by ID
fastify.get("/api/conversations/:id", async (req, reply) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return reply
        .status(400)
        .send({ ok: false, error: "Conversation ID is required" });
    }

    const conversation = await getConversation(id);

    if (!conversation) {
      return reply
        .status(404)
        .send({ ok: false, error: "Conversation not found" });
    }

    logger.info({ conversationId: id }, "Conversation retrieved");
    return reply.send({ ok: true, conversation });
  } catch (error) {
    logger.error({ error }, "Failed to retrieve conversation");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to retrieve conversation" });
  }
});

// List/Search conversations
fastify.get("/api/conversations", async (req, reply) => {
  try {
    const query = req.query as {
      query?: string;
      tags?: string;
      source?: "chat" | "voice" | "realtime";
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };

    const searchQuery: ConversationSearchQuery = {
      query: query.query,
      tags: query.tags ? query.tags.split(",") : undefined,
      source: query.source,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    // If search query is provided, use search; otherwise use list
    const result =
      searchQuery.query ||
      searchQuery.tags ||
      searchQuery.source ||
      searchQuery.startDate
        ? await searchConversations(searchQuery)
        : await listConversations(searchQuery.limit, searchQuery.offset);

    logger.info(
      { total: result.total, returned: result.conversations.length },
      "Conversations listed",
    );

    return reply.send({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.error({ error }, "Failed to list conversations");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to list conversations" });
  }
});

// Delete a conversation
fastify.delete("/api/conversations/:id", async (req, reply) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return reply
        .status(400)
        .send({ ok: false, error: "Conversation ID is required" });
    }

    const success = await deleteConversation(id);

    if (!success) {
      return reply
        .status(404)
        .send({ ok: false, error: "Conversation not found" });
    }

    logger.info({ conversationId: id }, "Conversation deleted");
    return reply.send({ ok: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete conversation");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to delete conversation" });
  }
});

// Get conversation statistics
fastify.get("/api/conversations/stats", async (req, reply) => {
  try {
    const stats = await getConversationStats();
    return reply.send({ ok: true, stats });
  } catch (error) {
    logger.error({ error }, "Failed to get conversation stats");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to get statistics" });
  }
});

// ========================================
// Action Tracking API
// ========================================

// Record an action
fastify.post("/api/actions/record", async (req, reply) => {
  try {
    const action = req.body as Partial<Action>;

    // Validate required fields
    if (!action.type || !action.source || !action.metadata) {
      return reply.status(400).send({
        ok: false,
        error: "type, source, and metadata are required",
      });
    }

    const actionId = await recordAction(
      action as Omit<Action, "id" | "timestamp">,
    );
    logger.info({ actionId, type: action.type }, "Action recorded");

    return reply.send({ ok: true, actionId });
  } catch (error) {
    logger.error({ error }, "Failed to record action");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to record action" });
  }
});

// Get an action by ID
fastify.get("/api/actions/:id", async (req, reply) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return reply
        .status(400)
        .send({ ok: false, error: "Action ID is required" });
    }

    const action = await getAction(id);

    if (!action) {
      return reply.status(404).send({ ok: false, error: "Action not found" });
    }

    return reply.send({ ok: true, action });
  } catch (error) {
    logger.error({ error }, "Failed to retrieve action");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to retrieve action" });
  }
});

// Query/List actions
fastify.get("/api/actions", async (req, reply) => {
  try {
    const query = req.query as {
      type?: string;
      types?: string;
      source?: "user" | "system" | "integration";
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };

    const actionQuery: ActionQuery = {
      type: query.types ? (query.types.split(",") as any) : (query.type as any),
      source: query.source,
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const result = await queryActions(actionQuery);

    logger.info(
      { total: result.total, returned: result.actions.length },
      "Actions queried",
    );

    return reply.send({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.error({ error }, "Failed to query actions");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to query actions" });
  }
});

// Get action statistics
fastify.get("/api/actions/stats", async (req, reply) => {
  try {
    const stats = await getActionStats();
    return reply.send({ ok: true, stats });
  } catch (error) {
    logger.error({ error }, "Failed to get action stats");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to get statistics" });
  }
});

// Cleanup old actions
fastify.post("/api/actions/cleanup", async (req, reply) => {
  try {
    const { days } = req.body as { days?: number };
    const daysToKeep = days || 90; // Default: keep 90 days

    if (daysToKeep < 1) {
      return reply
        .status(400)
        .send({ ok: false, error: "days must be at least 1" });
    }

    const deletedCount = await cleanupOldActions(daysToKeep);
    logger.info({ deletedCount, daysToKeep }, "Actions cleaned up");

    return reply.send({ ok: true, deletedCount });
  } catch (error) {
    logger.error({ error }, "Failed to cleanup actions");
    return reply
      .status(500)
      .send({ ok: false, error: "Failed to cleanup actions" });
  }
});

// System metrics endpoint (note: /api prefix is stripped by dev-proxy)
fastify.get("/api/system/metrics", async () => {
  const os = await import("os");

  // Calculate CPU load average (1 minute)
  const loadAvg = os.loadavg()[0] ?? 0;
  const cpuCount = os.cpus().length;
  const cpuLoadPct = Math.min(100, Math.round((loadAvg / cpuCount) * 100));

  // Calculate memory usage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsedPct = Math.round((usedMem / totalMem) * 100);

  return {
    cpuLoad: cpuLoadPct,
    memoryUsedPct,
    memoryUsedGB: Number((usedMem / 1024 ** 3).toFixed(2)),
    memoryTotalGB: Number((totalMem / 1024 ** 3).toFixed(2)),
    timestamp: new Date().toISOString(),
    uptime: os.uptime(),
  };
});

// ========================================
// Ollama Local LLM — model list + health
// ========================================

fastify.get("/api/integrations/ollama/models", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#58): per-IP throttle before any outbound
  // fetch to the local Ollama daemon so enumeration bursts are bounded.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_LIGHT, routeKey: "integrations-ollama-models" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const settingsPath = path.join(DATA_DIR, "settings.json");
  let baseUrl = "http://127.0.0.1:11434";
  try {
    if (existsSync(settingsPath)) {
      const raw = await readFile(settingsPath, "utf-8");
      const s = JSON.parse(raw);
      if (s?.integrations?.localLLM?.baseUrl) {
        baseUrl = s.integrations.localLLM.baseUrl.replace(/\/+$/, "");
      }
    }
  } catch {
    /* use default */
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return reply
        .status(502)
        .send({ ok: false, error: `Ollama returned ${res.status}` });
    }

    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        size: number;
        details?: { parameter_size?: string };
      }>;
    };
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      parameterSize: m.details?.parameter_size ?? null,
    }));

    return reply.send({ ok: true, models });
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Ollama not reachable (timeout)"
        : "Ollama not reachable";
    logger.warn({ error: err }, msg);
    return reply.status(503).send({ ok: false, error: msg });
  }
});

// ========================================
// AKIOR Memory Context — reads cerebrum.md + memory.md
// ========================================

fastify.get("/api/memory", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#59): per-IP throttle before filesystem
  // reads of cerebrum/memory markdown.
  const rateCheck = checkRateLimit(
    { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "memory-get" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const homedir = process.env.HOME || process.env.USERPROFILE || "";
  const cerebrumPath = path.join(homedir, "akior", ".wolf", "cerebrum.md");
  const memoryPath = path.join(homedir, "akior", ".wolf", "memory.md");

  const sections: { cerebrum?: string; memory?: string } = {};

  try {
    if (existsSync(cerebrumPath)) {
      const raw = await readFile(cerebrumPath, "utf-8");
      // Limit to first 4000 chars to keep context window manageable
      sections.cerebrum = raw.slice(0, 4000);
    }
  } catch (err) {
    logger.warn({ error: err }, "Failed to read cerebrum.md");
  }

  try {
    if (existsSync(memoryPath)) {
      const raw = await readFile(memoryPath, "utf-8");
      // Take last 2000 chars (most recent entries)
      sections.memory = raw.length > 2000 ? raw.slice(-2000) : raw;
    }
  } catch (err) {
    logger.warn({ error: err }, "Failed to read memory.md");
  }

  // Build a combined context string for injection into system prompts
  let context = "";
  if (sections.cerebrum) {
    context +=
      "## Key Learnings & Preferences (from cerebrum)\n" +
      sections.cerebrum +
      "\n\n";
  }
  if (sections.memory) {
    context += "## Recent Session Memory\n" + sections.memory + "\n";
  }

  return reply.send({
    ok: true,
    context: context || null,
    sources: {
      cerebrum: !!sections.cerebrum,
      memory: !!sections.memory,
    },
  });
});

// Weather integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.get("/api/integrations/weather", async (req, reply) => {
  const { location } = req.query as { location?: string };

  // Read API key from environment
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    logger.warn("Weather API key not configured");
    return reply.status(503).send({ error: "Weather API key not configured" });
  }

  // Use provided location or default
  const cityQuery = location || "Miami,US";

  try {
    logger.info({ location: cityQuery }, "Fetching weather data");

    // Call OpenWeather API
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityQuery)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "OpenWeather API error",
      );
      return reply
        .status(response.status)
        .send({ error: "Failed to fetch weather data" });
    }

    const data = (await response.json()) as any;

    // Map to clean response format
    const weatherResponse = {
      location:
        data.name && data.sys?.country
          ? `${data.name}, ${data.sys.country}`
          : data.name || cityQuery,
      temperatureC: Math.round(data.main?.temp ?? 0),
      temperatureF: Math.round(((data.main?.temp ?? 0) * 9) / 5 + 32),
      condition: data.weather?.[0]?.main || "Unknown",
      description: data.weather?.[0]?.description || "",
      iconCode: data.weather?.[0]?.icon || "01d",
      humidity: data.main?.humidity ?? 0,
      windKph: Math.round((data.wind?.speed ?? 0) * 3.6), // m/s to km/h
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        location: weatherResponse.location,
        temp: weatherResponse.temperatureC,
      },
      "Weather data fetched",
    );

    return weatherResponse;
  } catch (error) {
    logger.error({ error, location: cityQuery }, "Failed to fetch weather");
    return reply.status(500).send({ error: "Failed to fetch weather data" });
  }
});

// Web Search integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.post("/api/integrations/web-search", async (req, reply) => {
  const body = req.body as { query?: string; maxResults?: number };

  if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
    return reply.status(400).send({ ok: false, error: "query is required" });
  }

  // Import web search client dynamically
  const { runWebSearch } = await import("./clients/webSearchClient.js");

  const result = await runWebSearch({
    query: body.query,
    maxResults: body.maxResults ?? 5,
  });

  if (!result.ok) {
    // Return appropriate status codes based on error type
    if (result.error === "web_search_not_configured") {
      return reply.status(503).send(result);
    }
    return reply.status(500).send(result);
  }

  return result;
});

// ElevenLabs TTS integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.post("/api/integrations/elevenlabs/tts", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#60): moderate per-IP throttle on a paid
  // external API (ElevenLabs TTS) to bound cost-burst risk.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "integrations-elevenlabs-tts" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const body = req.body as { text?: string };

  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return reply.status(400).send({ ok: false, error: "missing_text" });
  }

  // Load settings
  let settings: any = null;
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = await readFile(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(content);
    }
  } catch (error) {
    logger.error({ error }, "Failed to load settings for ElevenLabs");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_load_settings" });
  }

  const elevenLabsConfig = settings?.integrations?.elevenLabs;

  // Check if configured
  if (
    !elevenLabsConfig?.enabled ||
    !elevenLabsConfig?.apiKey ||
    !elevenLabsConfig?.voiceId
  ) {
    logger.warn("ElevenLabs TTS not configured");
    return reply
      .status(503)
      .send({ ok: false, error: "elevenlabs_not_configured" });
  }

  try {
    // Import ElevenLabs client dynamically
    const { synthesizeWithElevenLabs } =
      await import("./clients/elevenLabsClient.js");

    const audioBuffer = await synthesizeWithElevenLabs({
      text: body.text,
      apiKey: elevenLabsConfig.apiKey,
      voiceId: elevenLabsConfig.voiceId,
      modelId: elevenLabsConfig.modelId,
      stability: elevenLabsConfig.stability,
      similarityBoost: elevenLabsConfig.similarityBoost,
      style: elevenLabsConfig.style,
    });

    // Send audio response
    reply.header("Content-Type", "audio/mpeg");
    reply.header("Cache-Control", "no-store");
    return reply.send(audioBuffer);
  } catch (error) {
    logger.error({ error }, "ElevenLabs TTS synthesis failed");
    return reply
      .status(502)
      .send({ ok: false, error: "elevenlabs_request_failed" });
  }
});

// Azure TTS integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.post("/api/integrations/azure-tts/tts", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#61): moderate per-IP throttle on a paid
  // external API (Azure TTS) to bound cost-burst risk.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "integrations-azure-tts" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const body = req.body as { text?: string };

  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return reply.status(400).send({ ok: false, error: "missing_text" });
  }

  // Load settings
  let settings: any = null;
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = await readFile(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(content);
    }
  } catch (error) {
    logger.error({ error }, "Failed to load settings for Azure TTS");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_load_settings" });
  }

  const azureTtsConfig = settings?.integrations?.azureTTS;

  // Check if configured
  if (
    !azureTtsConfig?.enabled ||
    !azureTtsConfig?.apiKey ||
    !azureTtsConfig?.region ||
    !azureTtsConfig?.voiceName
  ) {
    logger.warn("Azure TTS not configured");
    return reply
      .status(503)
      .send({ ok: false, error: "azure_tts_not_configured" });
  }

  try {
    // Import Azure TTS client dynamically
    const { synthesizeWithAzureTts } =
      await import("./clients/azureTtsClient.js");

    const audioBuffer = await synthesizeWithAzureTts(body.text, {
      apiKey: azureTtsConfig.apiKey,
      region: azureTtsConfig.region,
      voiceName: azureTtsConfig.voiceName,
      style: azureTtsConfig.style,
      rate: azureTtsConfig.rate,
      pitch: azureTtsConfig.pitch,
    });

    // Send audio response
    reply.header("Content-Type", "audio/mpeg");
    reply.header("Cache-Control", "no-store");
    return reply.send(audioBuffer);
  } catch (error) {
    logger.error({ error }, "Azure TTS synthesis failed");
    return reply
      .status(502)
      .send({ ok: false, error: "azure_tts_request_failed" });
  }
});

// Spotify integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.post("/api/integrations/spotify/search", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#62): per-IP throttle before an outbound
  // fetch to Spotify's API so caller enumeration is bounded.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_LIGHT, routeKey: "integrations-spotify-search" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const body = req.body as { query?: string; limit?: number };

  if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
    return reply.status(400).send({ ok: false, error: "missing_query" });
  }

  // Load settings
  let settings: any = null;
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = await readFile(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(content);
    }
  } catch (error) {
    logger.error({ error }, "Failed to load settings for Spotify");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_load_settings" });
  }

  const spotifyConfig = settings?.integrations?.spotify;

  // Check if configured
  if (
    !spotifyConfig?.enabled ||
    !spotifyConfig?.clientId ||
    !spotifyConfig?.clientSecret
  ) {
    logger.warn("Spotify not configured");
    return reply
      .status(503)
      .send({ ok: false, error: "spotify_not_configured" });
  }

  try {
    // Import Spotify client dynamically
    const { searchTracks } = await import("./clients/spotifyClient.js");

    const tracks = await searchTracks(
      {
        clientId: spotifyConfig.clientId,
        clientSecret: spotifyConfig.clientSecret,
        defaultMarket: spotifyConfig.defaultMarket,
      },
      body.query,
      body.limit ?? 10,
    );

    return reply.send({ ok: true, results: tracks });
  } catch (error) {
    logger.error({ error }, "Spotify search failed");
    return reply
      .status(502)
      .send({ ok: false, error: "spotify_request_failed" });
  }
});




// GET /settings
// CONTRACT: Always returns normalized, valid AppSettings (never partial/corrupt)
fastify.get("/api/settings", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#63): per-IP throttle before reading
  // settings from the filesystem.
  const rateCheck = checkRateLimit(
    { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "settings-get" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  try {
    if (!existsSync(SETTINGS_FILE)) {
      // No settings file - return normalized defaults
      logger.info("[SettingsContract] No settings file, returning defaults");
      return getDefaultSettings();
    }

    const content = await readFile(SETTINGS_FILE, "utf-8");
    const { data, error: parseError } = safeJsonParse(content);

    if (parseError) {
      // JSON parse failed - return normalized defaults (don't crash)
      logger.warn(
        { parseError },
        "[SettingsContract] Settings file corrupted, returning defaults",
      );
      return getDefaultSettings();
    }

    // Validate and normalize (fills missing keys with defaults)
    const { settings, zodErrors } = validateAndNormalizeSettings(data);

    if (zodErrors?.length) {
      logger.info(
        { errorCount: zodErrors.length },
        "[SettingsContract] Settings normalized with validation warnings",
      );
    }

    return settings;
  } catch (error) {
    logger.error(
      { error },
      "[SettingsContract] Unexpected error reading settings, returning defaults",
    );
    // Never return 500 - always return valid defaults
    return getDefaultSettings();
  }
});

// POST /settings - Save settings to server
fastify.post("/api/settings", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#64): moderate per-IP throttle before
  // filesystem write of settings.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "settings-post" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  try {
    const settings = req.body;
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    logger.info("Settings saved to server");
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Failed to save settings");
    reply.code(500);
    return { error: "Failed to save settings" };
  }
});

// =============================================================================
// AGENT D: Notes, Reminders, Alarms, and Weather API Endpoints
// =============================================================================

// Weather API
fastify.post("/api/integrations/weather/query", async (req, reply) => {
  // CodeQL js/missing-rate-limiting (#65): per-IP throttle before an outbound
  // fetch to OpenWeather so caller enumeration is bounded.
  const rateCheck = checkRateLimit(
    { ...RateLimitPresets.ADMIN_LIGHT, routeKey: "integrations-weather-query" },
    getClientIp(req),
  );
  if (!rateCheck.allowed && rateCheck.response) {
    return reply
      .status(429)
      .header("Retry-After", String(rateCheck.response.retryAfterSec))
      .header("Cache-Control", "no-store")
      .send(rateCheck.response);
  }

  const body = req.body as { location?: string };

  // Load settings for default location
  let settings: any = null;
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = await readFile(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(content);
    }
  } catch (error) {
    logger.error({ error }, "Failed to load settings for weather query");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_load_settings" });
  }

  const location =
    body.location || settings?.integrations?.weather?.location || "Miami,US";

  // Get API key from environment
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    logger.warn("Weather API key not configured");
    return reply
      .status(503)
      .send({ ok: false, error: "weather_api_key_not_configured" });
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`,
    );

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = await response.json();

    // Format response
    const weatherData = {
      location: `${data.name}, ${data.sys.country}`,
      temperatureC: Math.round(data.main.temp),
      temperatureF: Math.round((data.main.temp * 9) / 5 + 32),
      condition: data.weather[0]?.main || "Unknown",
      description: data.weather[0]?.description || "",
      humidity: data.main.humidity,
      windKph: Math.round(data.wind.speed * 3.6),
      iconCode: data.weather[0]?.icon,
      updatedAt: new Date().toISOString(),
    };

    logger.info({ location }, "Weather data fetched successfully");

    return reply.send({ ok: true, data: weatherData });
  } catch (error) {
    logger.error({ error, location }, "Failed to fetch weather");
    return reply
      .status(502)
      .send({ ok: false, error: "weather_api_request_failed" });
  }
});

// Notes API
fastify.get("/api/notes", async (req, reply) => {
  try {
    const { getAllNotes } = await import("./storage/notesStore.js");
    const notes = await getAllNotes();

    logger.info({ count: notes.length }, "Retrieved all notes");

    return reply.send({ ok: true, notes });
  } catch (error) {
    logger.error({ error }, "Failed to get notes");
    return reply.status(500).send({ ok: false, error: "failed_to_get_notes" });
  }
});

fastify.post("/api/notes", async (req, reply) => {
  const body = req.body as { content?: string; tags?: string[] };

  if (!body.content || !body.content.trim()) {
    return reply.status(400).send({ ok: false, error: "content_required" });
  }

  try {
    const { createNote } = await import("./storage/notesStore.js");
    const note = await createNote(body.content, body.tags);

    logger.info(
      { noteId: note.id, contentLength: note.content.length },
      "Note created",
    );

    return reply.send({ ok: true, note });
  } catch (error) {
    logger.error({ error }, "Failed to create note");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_create_note" });
  }
});

fastify.get("/api/notes/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const { getNoteById } = await import("./storage/notesStore.js");
    const note = await getNoteById(id);

    if (!note) {
      return reply.status(404).send({ ok: false, error: "note_not_found" });
    }

    return reply.send({ ok: true, note });
  } catch (error) {
    logger.error({ error, noteId: id }, "Failed to get note");
    return reply.status(500).send({ ok: false, error: "failed_to_get_note" });
  }
});

fastify.put("/api/notes/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { content?: string; tags?: string[] };

  if (!body.content || !body.content.trim()) {
    return reply.status(400).send({ ok: false, error: "content_required" });
  }

  try {
    const { updateNote } = await import("./storage/notesStore.js");
    const note = await updateNote(id, body.content, body.tags);

    if (!note) {
      return reply.status(404).send({ ok: false, error: "note_not_found" });
    }

    logger.info({ noteId: id }, "Note updated");

    return reply.send({ ok: true, note });
  } catch (error) {
    logger.error({ error, noteId: id }, "Failed to update note");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_update_note" });
  }
});

fastify.delete("/api/notes/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const { deleteNote, deleteLastNote } =
      await import("./storage/notesStore.js");

    // Special case: delete last note
    if (id === "last") {
      const success = await deleteLastNote();

      if (!success) {
        return reply.status(404).send({ ok: false, error: "no_notes_found" });
      }

      logger.info("Deleted last note");
      return reply.send({ ok: true });
    }

    // Delete specific note
    const success = await deleteNote(id);

    if (!success) {
      return reply.status(404).send({ ok: false, error: "note_not_found" });
    }

    logger.info({ noteId: id }, "Note deleted");

    return reply.send({ ok: true });
  } catch (error) {
    logger.error({ error, noteId: id }, "Failed to delete note");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_delete_note" });
  }
});

// Reminders API
fastify.get("/api/reminders", async (req, reply) => {
  try {
    const { getAllReminders } = await import("./storage/remindersStore.js");
    const reminders = await getAllReminders();

    logger.info({ count: reminders.length }, "Retrieved all reminders");

    return reply.send({ ok: true, reminders });
  } catch (error) {
    logger.error({ error }, "Failed to get reminders");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_get_reminders" });
  }
});

fastify.post("/api/reminders", async (req, reply) => {
  const body = req.body as { message?: string; triggerAt?: string };

  if (!body.message || !body.message.trim()) {
    return reply.status(400).send({ ok: false, error: "message_required" });
  }

  if (!body.triggerAt) {
    return reply
      .status(400)
      .send({ ok: false, error: "trigger_time_required" });
  }

  // Validate ISO timestamp
  const triggerDate = new Date(body.triggerAt);
  if (isNaN(triggerDate.getTime())) {
    return reply.status(400).send({ ok: false, error: "invalid_trigger_time" });
  }

  try {
    const { createReminder, updateReminderNotificationId } =
      await import("./storage/remindersStore.js");

    // Create reminder in storage
    const reminder = await createReminder(body.message, body.triggerAt);

    // Schedule notification event
    const notificationId = await notificationScheduler.scheduleEvent(
      "reminder",
      {
        reminderId: reminder.id,
        message: reminder.message,
      },
      reminder.triggerAt,
    );

    // Update reminder with notification ID
    await updateReminderNotificationId(reminder.id, notificationId);

    logger.info(
      { reminderId: reminder.id, notificationId, triggerAt: body.triggerAt },
      "Reminder created and scheduled",
    );

    return reply.send({ ok: true, reminder: { ...reminder, notificationId } });
  } catch (error) {
    logger.error({ error }, "Failed to create reminder");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_create_reminder" });
  }
});

fastify.delete("/api/reminders/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const { deleteReminder } = await import("./storage/remindersStore.js");
    const success = await deleteReminder(id);

    if (!success) {
      return reply.status(404).send({ ok: false, error: "reminder_not_found" });
    }

    logger.info({ reminderId: id }, "Reminder deleted");

    return reply.send({ ok: true });
  } catch (error) {
    logger.error({ error, reminderId: id }, "Failed to delete reminder");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_delete_reminder" });
  }
});

// Alarms API
fastify.get("/api/alarms", async (req, reply) => {
  try {
    const { getAllAlarms } = await import("./storage/alarmsStore.js");
    const alarms = await getAllAlarms();

    logger.info({ count: alarms.length }, "Retrieved all alarms");

    return reply.send({ ok: true, alarms });
  } catch (error) {
    logger.error({ error }, "Failed to get alarms");
    return reply.status(500).send({ ok: false, error: "failed_to_get_alarms" });
  }
});

fastify.post("/api/alarms", async (req, reply) => {
  const body = req.body as {
    name?: string;
    type?: "time" | "motion" | "event";
    triggerTime?: string;
    recurring?: boolean;
    recurrencePattern?: string;
    cameraId?: string;
    location?: string;
  };

  if (!body.name || !body.type) {
    return reply
      .status(400)
      .send({ ok: false, error: "name_and_type_required" });
  }

  // Validate based on alarm type
  if (body.type === "time" && !body.triggerTime) {
    return reply
      .status(400)
      .send({ ok: false, error: "trigger_time_required_for_time_alarms" });
  }

  if (body.type === "motion" && !body.location && !body.cameraId) {
    return reply.status(400).send({
      ok: false,
      error: "location_or_camera_id_required_for_motion_alarms",
    });
  }

  try {
    const { createAlarm } = await import("./storage/alarmsStore.js");

    const alarm = await createAlarm({
      name: body.name,
      type: body.type,
      enabled: true,
      triggerTime: body.triggerTime,
      recurring: body.recurring,
      recurrencePattern: body.recurrencePattern,
      cameraId: body.cameraId,
      location: body.location,
    });

    logger.info(
      { alarmId: alarm.id, type: alarm.type, name: alarm.name },
      "Alarm created",
    );

    return reply.send({ ok: true, alarm });
  } catch (error) {
    logger.error({ error }, "Failed to create alarm");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_create_alarm" });
  }
});

fastify.put("/api/alarms/:id/toggle", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const { toggleAlarm } = await import("./storage/alarmsStore.js");
    const alarm = await toggleAlarm(id);

    if (!alarm) {
      return reply.status(404).send({ ok: false, error: "alarm_not_found" });
    }

    logger.info({ alarmId: id, enabled: alarm.enabled }, "Alarm toggled");

    return reply.send({ ok: true, alarm });
  } catch (error) {
    logger.error({ error, alarmId: id }, "Failed to toggle alarm");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_toggle_alarm" });
  }
});

fastify.delete("/api/alarms/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const { deleteAlarm } = await import("./storage/alarmsStore.js");
    const success = await deleteAlarm(id);

    if (!success) {
      return reply.status(404).send({ ok: false, error: "alarm_not_found" });
    }

    logger.info({ alarmId: id }, "Alarm deleted");

    return reply.send({ ok: true });
  } catch (error) {
    logger.error({ error, alarmId: id }, "Failed to delete alarm");
    return reply
      .status(500)
      .send({ ok: false, error: "failed_to_delete_alarm" });
  }
});

// =============================================================================
// END AGENT D API ENDPOINTS
// =============================================================================

const FILES_DIR = path.join(DATA_DIR, "files");
if (!existsSync(FILES_DIR)) {
  mkdirSync(FILES_DIR, { recursive: true });
}

await fastify.register(fastifyStatic, {
  root: DATA_DIR,
  prefix: "/static/",
});

await fastify.register(fastifyStatic, {
  root: FILES_DIR,
  prefix: "/files/",
  decorateReply: false,
});

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);
const MODEL_EXTENSIONS = new Set(["glb", "gltf", "fbx", "obj", "usdz"]);

type FileCategory = "image" | "stl" | "model" | "other";

type StoredFileDescriptor = {
  name: string;
  url: string;
  size: number;
  modifiedAt: number;
  extension: string;
  category: FileCategory;
};

function slugify(value: string | undefined | null) {
  if (!value) return "file";
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file"
  );
}

function createFilename(base: string | undefined, extension: string) {
  const safeExtension =
    extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const slug = slugify(base);
  const unique = randomUUID().slice(0, 8);
  return `${slug}-${unique}.${safeExtension}`;
}

function inferExtensionFromMime(mime: string | null, fallback?: string) {
  if (!mime) return fallback;
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("stl")) return "stl";
  if (mime.includes("gltf") || mime.includes("glb")) return "glb";
  if (mime.includes("fbx")) return "fbx";
  if (mime.includes("obj")) return "obj";
  if (mime.includes("usdz")) return "usdz";
  return fallback;
}

function inferExtensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) {
      return ext.replace(/^\./, "");
    }
  } catch {
    const ext = path.extname(url).toLowerCase();
    if (ext) {
      return ext.replace(/^\./, "");
    }
  }
  return undefined;
}

async function storeBuffer(buffer: Buffer, extension: string, hint?: string) {
  const filename = createFilename(hint, extension);
  const destination = path.join(FILES_DIR, filename);
  await writeFile(destination, buffer);
  return {
    filename,
    url: `/files/${filename}`,
  };
}

async function storeRemoteFile(
  url: string,
  hint?: string,
  fallbackExtension?: string,
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mime = response.headers.get("content-type");
  const extension =
    inferExtensionFromMime(
      mime,
      inferExtensionFromUrl(url) ?? fallbackExtension ?? "bin",
    ) ?? "bin";
  return storeBuffer(Buffer.from(arrayBuffer), extension, hint);
}

function categorizeFile(extension: string): FileCategory {
  const ext = extension.toLowerCase();
  if (ext === "stl") return "stl";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (MODEL_EXTENSIONS.has(ext)) return "model";
  return "other";
}

function listStoredFiles(): StoredFileDescriptor[] {
  const entries = readdirSync(FILES_DIR, { withFileTypes: true });
  const files: StoredFileDescriptor[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const extension = path.extname(name).replace(/^\./, "").toLowerCase();
    const stats = statSync(path.join(FILES_DIR, name));
    files.push({
      name,
      url: `/files/${name}`,
      size: stats.size,
      modifiedAt: stats.mtimeMs,
      extension,
      category: categorizeFile(extension),
    });
  }
  return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function persistModelOutputs(
  jobId: string,
  outputs: ModelJobOutputs | undefined,
  hint?: string,
  preferredFormat: "glb" | "obj" | "usdz" = "glb",
): Promise<ModelJobOutputs | undefined> {
  if (!outputs) return undefined;
  const baseHint = hint ?? `model-${jobId}`;
  const next: ModelJobOutputs = { ...outputs };

  // Map format to the corresponding output key
  const formatKeyMap = {
    glb: "glbUrl",
    obj: "objUrl",
    usdz: "usdzUrl",
  } as const;

  const preferredKey = formatKeyMap[preferredFormat];

  // Only download the preferred format and thumbnail
  const singleFiles: Array<{
    key: keyof ModelJobOutputs;
    url?: string;
    suffix: string;
    fallbackExt?: string;
  }> = [
    {
      key: preferredKey,
      url: outputs[preferredKey],
      suffix: `mesh-${preferredFormat}`,
      fallbackExt: preferredFormat,
    },
    {
      key: "thumbnailUrl",
      url: outputs.thumbnailUrl,
      suffix: "thumbnail",
      fallbackExt: "jpg",
    },
  ];

  for (const entry of singleFiles) {
    const { key, url, suffix, fallbackExt } = entry;
    if (!url || url.startsWith("/files/")) continue;
    try {
      const stored = await storeRemoteFile(
        url,
        `${baseHint}-${suffix}`,
        fallbackExt,
      );
      (next as Record<string, any>)[key] = stored.url;
    } catch (error) {
      logger.error(
        { jobId, url, error },
        "Failed to persist model output file",
      );
    }
  }

  if (Array.isArray(outputs.textures) && outputs.textures.length) {
    const persistedTextures: string[] = [];
    for (let index = 0; index < outputs.textures.length; index += 1) {
      const textureUrl = outputs.textures[index];
      if (!textureUrl) continue;
      if (textureUrl.startsWith("/files/")) {
        persistedTextures.push(textureUrl);
        continue;
      }
      try {
        const stored = await storeRemoteFile(
          textureUrl,
          `${baseHint}-texture-${index}`,
          "png",
        );
        persistedTextures.push(stored.url);
      } catch (error) {
        logger.error(
          { jobId, url: textureUrl, error },
          "Failed to persist texture map",
        );
      }
    }
    if (persistedTextures.length) {
      next.textures = persistedTextures;
    }
  }

  return next;
}
try {
  registerKeyRoutes(fastify, io);
  registerAuthRoutes(fastify);
  registerLLMRoutes(fastify);
  registerHttpsRoutes(fastify);
  registerRemoteAccessRoutes(fastify);
  registerOpsRoutes(fastify);
  register3DPrintRoutes(fastify);
  registerSmartHomeRoutes(fastify);
  registerLockdownRoutes(fastify);

  const ReasoningEffortSchema = z.enum(["minimal", "low", "medium", "high"]);
  const VerbositySchema = z.enum(["low", "medium", "high"]);
  const ChatMessageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
  });

  const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    settings: z
      .object({
        model: z.string().min(1).optional(),
        initialPrompt: z.string().optional(),
        reasoningEffort: ReasoningEffortSchema.optional(),
        verbosity: VerbositySchema.optional(),
        maxOutputTokens: z.number().int().positive().optional(),
      })
      .optional(),
    previousResponseId: z.string().optional(),
    tools: z.array(z.any()).optional(),
  });

  fastify.post("/api/openai/text-chat", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#66): moderate per-IP throttle on a paid
    // external API (OpenAI text chat) to bound cost-burst risk.
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "openai-text-chat" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }

    const parsed = ChatRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return reply
        .status(400)
        .send({ error: firstIssue?.message ?? "Invalid chat request payload" });
    }

    const { messages, settings, previousResponseId, tools } = parsed.data;

    const trimmedInitialPrompt = settings?.initialPrompt?.trim() ?? "";
    const reasoningEffort = settings?.reasoningEffort;
    const verbosity = settings?.verbosity;
    const maxOutputTokens = settings?.maxOutputTokens;

    // Load server settings to check for local LLM configuration
    let serverSettings: any = null;
    try {
      const settingsPath = path.join(DATA_DIR, "settings.json");
      if (existsSync(settingsPath)) {
        const raw = await readFile(settingsPath, "utf-8");
        serverSettings = JSON.parse(raw);
      }
    } catch (error) {
      logger.warn("Failed to load server settings for LLM routing");
    }

    // Check if we should use local LLM
    const useLocalLlm = serverSettings?.textChat?.useLocalLlm ?? false;
    const localLlmPrimary = serverSettings?.textChat?.localLlmPrimary ?? false;
    const localLlmConfig = serverSettings?.integrations?.localLLM;
    const localLlmConnected =
      localLlmConfig?.enabled &&
      localLlmConfig?.baseUrl &&
      localLlmConfig?.model;

    // Determine routing strategy
    const shouldTryLocal = useLocalLlm && localLlmConnected;
    const shouldTryCloud =
      !useLocalLlm || !localLlmPrimary || !localLlmConnected;

    // Check which cloud provider is configured
    const llmInternalConfig = getLLMConfigInternal();
    const isAnthropicProvider =
      llmInternalConfig.provider === "anthropic-cloud";

    let cloudApiKey: string | null = null;
    if (shouldTryCloud) {
      if (isAnthropicProvider) {
        // Get Anthropic key
        const anthropicKey =
          llmInternalConfig.apiKey || process.env.ANTHROPIC_API_KEY || "";
        if (anthropicKey) {
          cloudApiKey = anthropicKey;
        } else if (!shouldTryLocal) {
          return reply.status(428).send({
            ok: false,
            error: {
              code: "SETUP_REQUIRED",
              message:
                "Missing Anthropic API key. Configure one from the Settings page.",
            },
            setup: {
              ownerPin: isPinConfigured(),
              llm: isLLMConfigured().configured,
            },
          });
        }
      } else {
        try {
          cloudApiKey = getOpenAiApiKey();
        } catch (error) {
          if (!shouldTryLocal) {
            const message =
              error instanceof Error
                ? error.message
                : "OpenAI API key not configured";
            return reply.status(428).send({
              ok: false,
              error: {
                code: "SETUP_REQUIRED",
                message,
              },
              setup: {
                ownerPin: isPinConfigured(),
                llm: isLLMConfigured().configured,
              },
            });
          }
          // If local is available, we can continue without cloud key
        }
      }
    }

    const conversation = previousResponseId ? messages.slice(-1) : messages;
    if (!conversation.length) {
      return reply
        .status(400)
        .send({ error: "No messages supplied for chat request" });
    }

    // Load AKIOR memory context to enrich system prompt
    let memoryContext = "";
    try {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      const cerebrumPath = path.join(homedir, "akior", ".wolf", "cerebrum.md");
      const memoryPath = path.join(homedir, "akior", ".wolf", "memory.md");

      if (existsSync(cerebrumPath)) {
        const raw = await readFile(cerebrumPath, "utf-8");
        memoryContext +=
          "## Key Learnings & Preferences\n" + raw.slice(0, 3000) + "\n\n";
      }
      if (existsSync(memoryPath)) {
        const raw = await readFile(memoryPath, "utf-8");
        const tail = raw.length > 1500 ? raw.slice(-1500) : raw;
        memoryContext += "## Recent Session Memory\n" + tail + "\n";
      }
    } catch {
      // Non-critical — proceed without memory context
    }

    // Merge memory context into the system / initial prompt
    const enrichedInitialPrompt = memoryContext
      ? [trimmedInitialPrompt, memoryContext].filter(Boolean).join("\n\n")
      : trimmedInitialPrompt;

    // LOCAL LLM PATH (primary or fallback)
    if (shouldTryLocal && localLlmPrimary) {
      // Try local LLM first
      const { callLocalLlm } = await import("./clients/localLlmClient.js");
      const localMessages = conversation.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));
      const localResult = await callLocalLlm({
        messages: localMessages,
        systemPrompt: enrichedInitialPrompt || undefined,
      });

      if (localResult.ok) {
        logger.info("[LocalLLM] Successfully used local model (primary)");
        return reply.send({
          message: localResult.message,
          responseId: null,
          source: "local-llm",
        });
      }

      // Local failed, fall back to cloud if configured
      logger.warn(
        { error: localResult.error },
        "[LocalLLM] Local model failed, falling back to cloud",
      );
      if (!cloudApiKey) {
        return reply
          .status(503)
          .send({ error: "Local LLM failed and cloud is not configured" });
      }
    }

    // CLOUD (Anthropic) PATH
    if (cloudApiKey && isAnthropicProvider) {
      try {
        const { callAnthropic } = await import("./clients/anthropicClient.js");
        const anthropicMessages = conversation.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        const anthropicResult = await callAnthropic(cloudApiKey, {
          messages: anthropicMessages,
          systemPrompt: enrichedInitialPrompt || undefined,
          model: settings?.model?.trim() || "claude-sonnet-4-20250514",
          maxTokens: maxOutputTokens || 4096,
        });

        if (anthropicResult.ok) {
          return reply.send({
            message: anthropicResult.message,
            responseId: null,
            source: "anthropic-cloud",
            usage: {
              inputTokens: anthropicResult.inputTokens,
              outputTokens: anthropicResult.outputTokens,
            },
          });
        }

        // Anthropic failed -- try local fallback if available
        logger.error(
          { error: anthropicResult.error },
          "Anthropic chat request failed",
        );

        if (shouldTryLocal && !localLlmPrimary) {
          logger.warn("[LocalLLM] Anthropic failed, trying local as fallback");
          const { callLocalLlm } = await import("./clients/localLlmClient.js");
          const localMessages = conversation.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          }));
          const localResult = await callLocalLlm({
            messages: localMessages,
            systemPrompt: enrichedInitialPrompt || undefined,
          });

          if (localResult.ok) {
            logger.info(
              "[LocalLLM] Successfully used local model (fallback after Anthropic error)",
            );
            return reply.send({
              message: localResult.message,
              responseId: null,
              source: "local-llm",
            });
          }
        }

        return reply.status(502).send({ error: anthropicResult.error });
      } catch (error) {
        logger.error({ error }, "Failed to call Anthropic API");

        if (shouldTryLocal && !localLlmPrimary) {
          const { callLocalLlm } = await import("./clients/localLlmClient.js");
          const localMessages = conversation.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          }));
          const localResult = await callLocalLlm({
            messages: localMessages,
            systemPrompt: enrichedInitialPrompt || undefined,
          });

          if (localResult.ok) {
            return reply.send({
              message: localResult.message,
              responseId: null,
              source: "local-llm",
            });
          }
        }

        return reply
          .status(502)
          .send({ error: "Failed to reach Anthropic API" });
      }
    }

    // CLOUD (OpenAI) PATH
    if (cloudApiKey && !isAnthropicProvider) {
      const payload: Record<string, any> = {
        model: settings?.model?.trim() || "gpt-5",
      };

      const inputMessages = conversation.map((message) => ({
        role: message.role,
        content: [
          {
            type: "input_text",
            text: message.content,
          },
        ],
      }));

      if (!previousResponseId && trimmedInitialPrompt) {
        payload.input = [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: trimmedInitialPrompt,
              },
            ],
          },
          ...inputMessages,
        ];
      } else {
        payload.input = inputMessages;
      }

      if (reasoningEffort) {
        payload.reasoning = { effort: reasoningEffort };
      }
      if (verbosity) {
        payload.text = { verbosity };
      }
      if (maxOutputTokens) {
        payload.max_output_tokens = maxOutputTokens;
      }
      if (previousResponseId) {
        payload.previous_response_id = previousResponseId;
      }
      if (tools && tools.length > 0) {
        payload.tools = tools;
      }

      let upstream: globalThis.Response;
      try {
        upstream = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cloudApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        logger.error({ error }, "Failed to reach OpenAI Responses API");

        // If cloud fails and local is available as fallback, try local
        if (shouldTryLocal && !localLlmPrimary) {
          logger.warn("[LocalLLM] Cloud failed, trying local as fallback");
          const { callLocalLlm } = await import("./clients/localLlmClient.js");
          const localMessages = conversation.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          }));
          const localResult = await callLocalLlm({
            messages: localMessages,
            systemPrompt: trimmedInitialPrompt || undefined,
          });

          if (localResult.ok) {
            logger.info("[LocalLLM] Successfully used local model (fallback)");
            return reply.send({
              message: localResult.message,
              responseId: null,
              source: "local-llm",
            });
          }
        }

        return reply
          .status(502)
          .send({ error: "Failed to reach OpenAI Responses API" });
      }

      const raw = await upstream.text();
      let openaiPayload: any = null;
      if (raw) {
        try {
          openaiPayload = JSON.parse(raw);
        } catch (error) {
          openaiPayload = null;
        }
      }

      if (!upstream.ok) {
        const message =
          openaiPayload?.error?.message ||
          openaiPayload?.error ||
          raw ||
          "OpenAI text chat request failed";
        logger.error(
          { status: upstream.status, body: raw },
          "OpenAI text chat request failed",
        );

        // Try local LLM as fallback if cloud-primary mode
        if (shouldTryLocal && !localLlmPrimary) {
          logger.warn(
            "[LocalLLM] Cloud returned error, trying local as fallback",
          );
          const { callLocalLlm } = await import("./clients/localLlmClient.js");
          const localMessages = conversation.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          }));
          const localResult = await callLocalLlm({
            messages: localMessages,
            systemPrompt: trimmedInitialPrompt || undefined,
          });

          if (localResult.ok) {
            logger.info(
              "[LocalLLM] Successfully used local model (fallback after cloud error)",
            );
            return reply.send({
              message: localResult.message,
              responseId: null,
              source: "local-llm",
            });
          }
        }

        return reply.status(upstream.status).send({ error: message });
      }

      // Check if response contains tool calls
      const outputs = Array.isArray(openaiPayload?.output)
        ? openaiPayload.output
        : [];
      const toolCalls: any[] = [];

      for (const item of outputs) {
        if (!item || typeof item !== "object") continue;

        // Check for function calls in the output
        if (item.type === "function_call" && item.name && item.call_id) {
          toolCalls.push({
            id: item.call_id,
            type: "function",
            function: {
              name: item.name,
              arguments: item.arguments || "{}",
            },
          });
        }
      }

      // If there are tool calls, return them to the client
      if (toolCalls.length > 0) {
        logger.info({ toolCalls }, "OpenAI response includes tool calls");
        return reply.send({
          toolCalls,
          responseId: openaiPayload?.id ?? null,
        });
      }

      // Otherwise, extract and return the text
      const text = extractOutputText(openaiPayload);
      if (!text) {
        logger.error(
          { body: openaiPayload },
          "OpenAI response missing text output",
        );
        return reply
          .status(502)
          .send({ error: "OpenAI response did not include text output" });
      }

      return reply.send({
        message: text.trim(),
        responseId: openaiPayload?.id ?? null,
      });
    }

    // If we reach here, neither local nor cloud is available
    return reply.status(503).send({ error: "No LLM backend configured" });
  });

  const ToolResultSchema = z.object({
    toolCallId: z.string(),
    output: z.string(),
  });

  const ChatToolResultRequestSchema = z.object({
    responseId: z.string(),
    toolResults: z.array(ToolResultSchema).min(1),
    settings: z
      .object({
        model: z.string().min(1).optional(),
        reasoningEffort: ReasoningEffortSchema.optional(),
        verbosity: VerbositySchema.optional(),
        maxOutputTokens: z.number().int().positive().optional(),
      })
      .optional(),
    tools: z.array(z.any()).optional(),
  });

  fastify.post("/api/openai/text-chat/tool-result", async (req, reply) => {
    const parsed = ChatToolResultRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return reply.status(400).send({
        error: firstIssue?.message ?? "Invalid tool result request payload",
      });
    }

    const { responseId, toolResults, settings, tools } = parsed.data;

    let apiKey: string;
    try {
      apiKey = getOpenAiApiKey();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "OpenAI API key not configured";
      return reply.status(428).send({
        ok: false,
        error: {
          code: "SETUP_REQUIRED",
          message,
        },
        setup: {
          ownerPin: isPinConfigured(),
          llm: isLLMConfigured().configured,
        },
      });
    }

    // For the Responses API, submit tool results as a continuation with the previous response
    // Format as assistant message followed by user message with results
    const payload: Record<string, any> = {
      model: settings?.model?.trim() || "gpt-5",
      previous_response_id: responseId,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: toolResults
                .map((result) => {
                  try {
                    const parsed = JSON.parse(result.output);
                    return `Function result: ${parsed.message || JSON.stringify(parsed)}`;
                  } catch {
                    return `Function result: ${result.output}`;
                  }
                })
                .join("\n\n"),
            },
          ],
        },
      ],
    };

    if (settings?.reasoningEffort) {
      payload.reasoning = { effort: settings.reasoningEffort };
    }
    if (settings?.verbosity) {
      payload.text = { verbosity: settings.verbosity };
    }
    if (settings?.maxOutputTokens) {
      payload.max_output_tokens = settings.maxOutputTokens;
    }
    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.error({ error }, "Failed to reach OpenAI Responses API");
      return reply
        .status(502)
        .send({ error: "Failed to reach OpenAI Responses API" });
    }

    const raw = await upstream.text();
    let openaiPayload: any = null;
    if (raw) {
      try {
        openaiPayload = JSON.parse(raw);
      } catch (error) {
        openaiPayload = null;
      }
    }

    if (!upstream.ok) {
      const message =
        openaiPayload?.error?.message ||
        openaiPayload?.error ||
        raw ||
        "OpenAI text chat tool result request failed";
      logger.error(
        { status: upstream.status, body: raw },
        "OpenAI text chat tool result request failed",
      );
      return reply.status(upstream.status).send({ error: message });
    }

    // Check if response contains more tool calls
    const outputs = Array.isArray(openaiPayload?.output)
      ? openaiPayload.output
      : [];
    const toolCalls: any[] = [];

    for (const item of outputs) {
      if (!item || typeof item !== "object") continue;

      if (item.type === "function_call" && item.name && item.call_id) {
        toolCalls.push({
          id: item.call_id,
          type: "function",
          function: {
            name: item.name,
            arguments: item.arguments || "{}",
          },
        });
      }
    }

    // If there are more tool calls, return them
    if (toolCalls.length > 0) {
      logger.info({ toolCalls }, "OpenAI response includes more tool calls");
      return reply.send({
        toolCalls,
        responseId: openaiPayload?.id ?? null,
      });
    }

    // Otherwise, extract and return the text
    const text = extractOutputText(openaiPayload);
    if (!text) {
      logger.error(
        { body: openaiPayload },
        "OpenAI response missing text output",
      );
      return reply
        .status(502)
        .send({ error: "OpenAI response did not include text output" });
    }

    return reply.send({
      message: text.trim(),
      responseId: openaiPayload?.id ?? null,
    });
  });

  fastify.post("/api/openai/realtime", async (req, reply) => {
    const { sdp, model } = (req.body as { sdp?: string; model?: string }) ?? {};
    if (!sdp) {
      return reply.status(400).send({ error: "sdp is required" });
    }

    let apiKey: string;
    try {
      apiKey = getOpenAiApiKey();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "OpenAI API key not configured";
      return reply.status(428).send({
        ok: false,
        error: {
          code: "SETUP_REQUIRED",
          message,
        },
        setup: {
          ownerPin: isPinConfigured(),
          llm: isLLMConfigured().configured,
        },
      });
    }

    const url = new URL("https://api.openai.com/v1/realtime");
    url.searchParams.set("model", model || config.openai.realtimeModel);

    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: sdp,
      });
    } catch (error) {
      logger.error({ error }, "Failed to reach OpenAI realtime API");
      return reply
        .status(502)
        .send({ error: "Failed to reach OpenAI realtime API" });
    }

    const text = await response.text();

    if (!response.ok) {
      // Parse error details if possible
      let errorDetails: any = text;
      try {
        errorDetails = JSON.parse(text);
      } catch {
        // Keep as plain text if not JSON
      }

      // Log detailed error information
      logger.error(
        {
          status: response.status,
          body: text,
          headers: Object.fromEntries(response.headers.entries()),
        },
        "OpenAI realtime request failed",
      );

      // Check for rate limiting
      if (response.status === 429) {
        logger.error(
          "🚨 RATE LIMIT EXCEEDED - OpenAI Realtime API rate limit hit",
        );
        const retryAfter = response.headers.get("retry-after");
        const rateLimitRemaining = response.headers.get(
          "x-ratelimit-remaining",
        );
        const rateLimitReset = response.headers.get("x-ratelimit-reset");

        logger.error(
          {
            retryAfter,
            rateLimitRemaining,
            rateLimitReset,
            rateLimitResetDate: rateLimitReset
              ? new Date(parseInt(rateLimitReset) * 1000).toISOString()
              : null,
          },
          "Rate limit details",
        );

        return reply.status(429).send({
          error:
            "Rate limit exceeded. Please wait before making more requests.",
          retryAfter,
          rateLimitRemaining,
          rateLimitReset,
          details: errorDetails,
        });
      }

      return reply
        .status(response.status)
        .send({ error: text || "OpenAI realtime request failed" });
    }

    return reply.send({ sdp: text });
  });

  fastify.get("/api/file-library", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#67): per-IP throttle before listing
    // stored files from the filesystem.
    const rateCheck = checkRateLimit(
      { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "file-library-list" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    return { files: listStoredFiles() };
  });

  fastify.delete("/api/file-library/:name", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#68): moderate per-IP throttle before
    // destructive filesystem deletion of a stored file.
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "file-library-delete" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }

    const { name } = req.params as { name?: string };
    if (!name) {
      return reply.status(400).send({ error: "File name is required" });
    }
    const safeName = path.basename(name);
    const target = path.join(FILES_DIR, safeName);
    if (!target.startsWith(FILES_DIR)) {
      return reply.status(400).send({ error: "Invalid file path" });
    }
    if (!existsSync(target)) {
      return reply.status(404).send({ error: "File not found" });
    }
    await rm(target, { force: true });
    return reply.send({ ok: true });
  });

  fastify.post("/api/file-library/store-image", async (req, reply) => {
    const { dataUrl, prompt, filename } =
      (req.body as { dataUrl?: string; prompt?: string; filename?: string }) ??
      {};
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return reply.status(400).send({ error: "Invalid image payload" });
    }
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      return reply.status(400).send({ error: "Malformed data URL" });
    }
    const [, mime, base64] = match;
    try {
      const buffer = Buffer.from(base64, "base64");
      const ext = inferExtensionFromMime(mime, "png") ?? "png";
      const stored = await storeBuffer(
        buffer,
        ext,
        filename ?? prompt ?? "image",
      );
      return reply.send({ url: stored.url, filename: stored.filename });
    } catch (error) {
      logger.error({ error }, "Failed to store generated image");
      return reply.status(500).send({ error: "Failed to store image" });
    }
  });

  fastify.post("/api/file-library/upload", async (req, reply) => {
    try {
      const data = await req.file();

      if (!data) {
        return reply.status(400).send({ error: "No file provided" });
      }

      // Get the file buffer
      const buffer = await data.toBuffer();

      // Get original filename and extension
      const originalName = data.filename;
      const ext =
        path.extname(originalName).toLowerCase().replace(/^\./, "") || "bin";

      // Use the original filename (without extension) as hint for storage
      const hint = path.basename(originalName, path.extname(originalName));

      // Store the file
      const stored = await storeBuffer(buffer, ext, hint);

      logger.info(
        {
          originalName,
          storedName: stored.filename,
          size: buffer.length,
          extension: ext,
        },
        "File uploaded successfully",
      );

      return reply.send({
        success: true,
        url: stored.url,
        filename: stored.filename,
        size: buffer.length,
      });
    } catch (error) {
      logger.error({ error }, "Failed to upload file");
      return reply.status(500).send({ error: "Failed to upload file" });
    }
  });

  const ImageGenerationRequestSchema = z.object({
    prompt: z.string().min(1),
    settings: z
      .object({
        model: z.string().optional(),
        size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
        quality: z
          .enum(["low", "medium", "high", "auto", "standard", "hd"])
          .optional(),
        partialImages: z.number().int().min(0).max(3).optional(),
      })
      .optional(),
  });

  fastify.post("/api/openai/generate-image", async (req, reply) => {
    const parsed = ImageGenerationRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return reply.status(400).send({
        error: firstIssue?.message ?? "Invalid image generation request",
      });
    }

    const { prompt, settings } = parsed.data;

    let apiKey: string;
    try {
      apiKey = getOpenAiApiKey();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "OpenAI API key not configured";
      return reply.status(428).send({
        ok: false,
        error: {
          code: "SETUP_REQUIRED",
          message,
        },
        setup: {
          ownerPin: isPinConfigured(),
          llm: isLLMConfigured().configured,
        },
      });
    }

    const model = settings?.model?.trim() || "gpt-image-1";
    const size = settings?.size || "1024x1024";
    const quality = settings?.quality || "auto";
    const partialImages = settings?.partialImages ?? 2;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      logger.info(
        {
          model,
          size,
          quality,
          partialImages,
          prompt: prompt.substring(0, 50),
        },
        "Starting image generation",
      );

      // Use REST API directly for better control over streaming
      const requestPayload: any = {
        model,
        prompt,
        size,
      };

      // Handle different model requirements
      const isGptImage = model === "gpt-image-1";
      const isDalle = model === "dall-e-2" || model === "dall-e-3";

      if (isGptImage && partialImages > 0) {
        // gpt-image-1 with streaming
        requestPayload.stream = true;
        requestPayload.partial_images = partialImages;
        // gpt-image-1 supports auto, low, medium, high for quality
        if (quality && quality !== "auto") {
          requestPayload.quality = quality;
        }
      } else if (isGptImage) {
        // gpt-image-1 without streaming - no response_format needed
        // Quality mapping for gpt-image-1
        if (quality === "hd") {
          requestPayload.quality = "high";
        } else if (quality === "standard") {
          requestPayload.quality = "medium";
        }
      } else if (isDalle) {
        // DALL-E models require response_format
        requestPayload.response_format = "b64_json";

        // DALL-E only supports 'standard' or 'hd'
        if (quality === "hd") {
          requestPayload.quality = "hd";
        } else {
          requestPayload.quality = "standard";
        }
      }

      logger.info({ requestPayload }, "Sending request to OpenAI");

      const upstream = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        },
      );

      if (!upstream.ok) {
        const errorText = await upstream.text();
        logger.error(
          { status: upstream.status, body: errorText },
          "OpenAI request failed",
        );

        // Parse error to provide helpful messages
        let errorMessage = `OpenAI API error: ${errorText}`;
        let errorType = "api_error";

        try {
          const errorData = JSON.parse(errorText);
          const message = errorData.error?.message || "";

          // Check for verification requirement
          if (
            message.includes("organization must be verified") ||
            message.includes("Verify Organization")
          ) {
            errorType = "verification_required";
            errorMessage = message;
          } else {
            errorMessage = message || errorText;
          }
        } catch {
          // Keep original error message if parsing fails
        }

        reply.raw.write(
          `data: ${JSON.stringify({
            type: "error",
            errorType,
            error: errorMessage,
          })}\n\n`,
        );
        reply.raw.end();
        return;
      }

      // Check if streaming response
      const contentType = upstream.headers.get("content-type") || "";
      const isStreaming =
        contentType.includes("text/event-stream") || requestPayload.stream;

      logger.info({ contentType, isStreaming }, "Response received");

      if (isStreaming && upstream.body) {
        // Handle streaming response
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let eventCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim() || !line.startsWith("data: ")) continue;

            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              eventCount++;
              logger.info(
                {
                  eventCount,
                  eventType: event.type,
                  eventKeys: Object.keys(event),
                },
                "Stream event",
              );

              // Partial image
              if (
                event.type === "image_generation.partial_image" ||
                event.partial_image_index !== undefined
              ) {
                logger.info(
                  {
                    index: event.partial_image_index,
                    hasB64: !!event.b64_json,
                    hasUrl: !!event.url,
                  },
                  "Partial image",
                );

                // Get image data - could be base64 or URL
                let imageData = event.b64_json;
                if (!imageData && event.url) {
                  // If URL provided, fetch and convert to base64
                  try {
                    const imgResponse = await fetch(event.url);
                    const buffer = await imgResponse.arrayBuffer();
                    imageData = Buffer.from(buffer).toString("base64");
                  } catch (err) {
                    logger.error({ err }, "Failed to fetch image URL");
                  }
                }

                if (imageData) {
                  reply.raw.write(
                    `data: ${JSON.stringify({
                      type: "partial_image",
                      index: event.partial_image_index || 0,
                      image: imageData,
                      revised_prompt: event.revised_prompt,
                    })}\n\n`,
                  );
                }
              }

              // Final image
              else if (
                event.type === "image_generation.complete" ||
                event.data
              ) {
                const imageData = event.data?.[0] || event;
                logger.info(
                  { hasB64: !!imageData.b64_json, hasUrl: !!imageData.url },
                  "Final image",
                );

                let finalImageData = imageData.b64_json;
                if (!finalImageData && imageData.url) {
                  // If URL provided, fetch and convert to base64
                  try {
                    const imgResponse = await fetch(imageData.url);
                    const buffer = await imgResponse.arrayBuffer();
                    finalImageData = Buffer.from(buffer).toString("base64");
                  } catch (err) {
                    logger.error({ err }, "Failed to fetch final image URL");
                  }
                }

                if (finalImageData) {
                  logger.info("Final image ready to send");
                  reply.raw.write(
                    `data: ${JSON.stringify({
                      type: "final_image",
                      image: finalImageData,
                      revised_prompt:
                        imageData.revised_prompt || event.revised_prompt,
                    })}\n\n`,
                  );
                }
              }
            } catch (parseError) {
              logger.warn({ line, parseError }, "Failed to parse SSE line");
            }
          }
        }

        logger.info({ eventCount }, "Stream complete");
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      } else {
        // Handle non-streaming response
        const responseData = await upstream.json();
        logger.info(
          { responseKeys: Object.keys(responseData) },
          "Non-streaming response received",
        );

        if (responseData.data && responseData.data[0]) {
          const imageData = responseData.data[0];
          logger.info(
            {
              hasB64: !!imageData.b64_json,
              hasUrl: !!imageData.url,
              b64Length: imageData.b64_json?.length,
              revisedPrompt: !!imageData.revised_prompt,
            },
            "Image data structure",
          );

          let finalImage = imageData.b64_json;
          if (!finalImage && imageData.url) {
            // Fetch URL and convert to base64
            logger.info({ url: imageData.url }, "Fetching image from URL");
            try {
              const imgResponse = await fetch(imageData.url);
              const buffer = await imgResponse.arrayBuffer();
              finalImage = Buffer.from(buffer).toString("base64");
              logger.info(
                { b64Length: finalImage.length },
                "Converted URL to base64",
              );
            } catch (err) {
              logger.error({ err }, "Failed to fetch non-streaming image URL");
              throw new Error("Failed to fetch image from URL");
            }
          }

          if (finalImage) {
            const payload = {
              type: "final_image",
              image: finalImage,
              revised_prompt: imageData.revised_prompt,
            };
            logger.info(
              {
                imageLength: finalImage.length,
                hasRevisedPrompt: !!imageData.revised_prompt,
              },
              "Sending final image to client",
            );
            reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
            reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
            logger.info("Sent done event");
          } else {
            logger.error(
              { imageData },
              "No image data (b64_json or url) in response",
            );
            throw new Error("No image data (b64_json or url) in response");
          }
        } else {
          logger.error({ responseData }, "No image data in response");
          throw new Error("No image data in response");
        }
      }
    } catch (error) {
      logger.error(
        { error, stack: error instanceof Error ? error.stack : undefined },
        "Error in image generation",
      );
      reply.raw.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            error instanceof Error ? error.message : "Image generation failed",
        })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  });

  // Vision Analysis Endpoint
  const VisionRequestSchema = z.object({
    imageUrl: z.string(),
    prompt: z.string().optional(),
  });

  fastify.post("/api/openai/vision", async (req, reply) => {
    const parsed = VisionRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return reply.status(400).send({
        error: firstIssue?.message ?? "Invalid vision analysis request",
      });
    }

    const { imageUrl, prompt } = parsed.data;

    let apiKey: string;
    try {
      apiKey = getOpenAiApiKey();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "OpenAI API key not configured";
      return reply.status(428).send({
        ok: false,
        error: {
          code: "SETUP_REQUIRED",
          message,
        },
        setup: {
          ownerPin: isPinConfigured(),
          llm: isLLMConfigured().configured,
        },
      });
    }

    try {
      logger.info({ imageUrl, prompt }, "Analyzing image with Vision AI");

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text:
                      prompt ||
                      "What do you see in this image? Describe it in detail.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageUrl,
                    },
                  },
                ],
              },
            ],
            max_tokens: 500,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, body: errorText },
          "Vision API request failed",
        );
        return reply.status(response.status).send({ error: errorText });
      }

      const data = await response.json();
      const description =
        data.choices?.[0]?.message?.content || "Unable to analyze image";

      logger.info({ description }, "Vision analysis complete");

      return reply.send({
        description,
        imageUrl,
      });
    } catch (error) {
      logger.error({ error }, "Error in vision analysis");
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Vision analysis failed",
      });
    }
  });

  // List all images
  fastify.get("/api/images", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#69): per-IP throttle before scanning
    // the FILES_DIR for image files.
    const rateCheck = checkRateLimit(
      { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "images-list" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }

    try {
      const files = readdirSync(FILES_DIR);
      const images = files
        .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map((filename) => {
          const filePath = path.join(FILES_DIR, filename);
          const stats = statSync(filePath);

          // Parse filename: timestamp-deviceId-tag.ext
          const parts = filename.split("-");
          const timestamp = parts[0]
            ? parseInt(parts[0], 10)
            : stats.birthtimeMs;
          const deviceId = parts[1] || "unknown";
          const tagWithExt = parts.slice(2).join("-");
          const tag = tagWithExt
            ? path.basename(tagWithExt, path.extname(tagWithExt))
            : "default";

          return {
            id: filename,
            filename,
            url: `/files/${filename}`,
            tag,
            deviceId,
            ts: timestamp || stats.birthtimeMs,
            size: stats.size,
            createdAt: stats.birthtime,
          };
        })
        .sort((a, b) => b.ts - a.ts); // Most recent first

      return reply.send({ images });
    } catch (error) {
      logger.error({ error }, "Failed to list images");
      return reply.status(500).send({ error: "Failed to list images" });
    }
  });

  fastify.post("/api/images/upload", async (req, reply) => {
    const mp: any = await (req as any).file();
    if (!mp) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const tag = ((req.query as any)?.tag as string) || "default";
    const deviceId = ((req.query as any)?.deviceId as string) || "unknown";
    const filename = `${Date.now()}-${deviceId}-${tag}.jpg`;
    await mp.toFile(path.join(FILES_DIR, filename));
    return reply.send({ ok: true, url: `/files/${filename}` });
  });

  type MeshySettings = {
    aiModel?: string;
    topology?: string;
    targetPolycount?: number;
    shouldTexture?: boolean;
    shouldRemesh?: boolean;
    enablePbr?: boolean;
    symmetryMode?: string;
    artStyle?: string;
    outputFormat?: "glb" | "obj" | "usdz";
  };

  type CreateModelBody = {
    mode: ModelJob["source"];
    captureTag?: string;
    imageData?: string;
    prompt?: string;
    texturePrompt?: string;
    settings?: MeshySettings;
  };

  const jobs = new Map<string, ModelJob>();

  function mergeOutputs(current?: ModelJobOutputs, incoming?: ModelJobOutputs) {
    if (!current) return incoming;
    if (!incoming) return current;
    return {
      ...current,
      ...incoming,
      textures: incoming.textures ?? current.textures,
    } satisfies ModelJobOutputs;
  }

  function updateJob(id: string, patch: Partial<ModelJob>) {
    const existing = jobs.get(id);
    if (!existing) return;
    const next: ModelJob = {
      ...existing,
      ...patch,
      outputs: mergeOutputs(existing.outputs, patch.outputs),
      metadata: patch.metadata
        ? { ...existing.metadata, ...patch.metadata }
        : existing.metadata,
      updatedAt: Date.now(),
    };
    jobs.set(id, next);

    // Trigger printer_alert notification on job completion or failure
    if (patch.status === "done" && existing.status !== "done") {
      const prompt = next.metadata?.prompt || `${next.source} model`;
      notificationScheduler
        .scheduleEvent(
          "printer_alert",
          {
            message: `3D model generation completed: ${prompt.substring(0, 50)}`,
            jobId: id,
            status: "completed",
            source: next.source,
          },
          new Date(Date.now() + 1000).toISOString(), // Fire in 1 second
        )
        .then(() => {
          logger.info(
            { jobId: id, prompt },
            "Scheduled printer completion notification",
          );
        })
        .catch((err) => {
          logger.error(
            { error: err, jobId: id },
            "Failed to schedule printer completion notification",
          );
        });
    } else if (patch.status === "error" && existing.status !== "error") {
      const errorMsg = patch.error || "Unknown error";
      const prompt = next.metadata?.prompt || `${next.source} model`;
      notificationScheduler
        .scheduleEvent(
          "printer_alert",
          {
            message: `3D model generation failed: ${errorMsg.substring(0, 50)}`,
            jobId: id,
            status: "failed",
            error: errorMsg,
            source: next.source,
          },
          new Date(Date.now() + 1000).toISOString(), // Fire in 1 second
        )
        .then(() => {
          logger.info(
            { jobId: id, error: errorMsg },
            "Scheduled printer failure notification",
          );
        })
        .catch((err) => {
          logger.error(
            { error: err, jobId: id },
            "Failed to schedule printer failure notification",
          );
        });
    }
  }

  function extractOutputText(payload: any): string | null {
    if (!payload) {
      return null;
    }

    const direct = payload.output_text;
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }
    if (Array.isArray(direct)) {
      const combined = direct
        .filter((value: any) => typeof value === "string")
        .join("\n")
        .trim();
      if (combined) {
        return combined;
      }
    }

    const outputs = Array.isArray(payload.output) ? payload.output : [];
    for (const item of outputs) {
      if (!item || typeof item !== "object") continue;
      if (typeof (item as any).text === "string" && (item as any).text.trim()) {
        return (item as any).text;
      }
      const content = Array.isArray((item as any).content)
        ? (item as any).content
        : [];
      for (const entry of content) {
        if (!entry || typeof entry !== "object") continue;
        const text = typeof entry.text === "string" ? entry.text : undefined;
        if (text && text.trim()) {
          return text;
        }
      }
    }

    return null;
  }

  function getMeshyApiKey() {
    const secrets = readSecrets();
    const key = secrets.meshy || process.env.MESHY_API_KEY || "";
    if (!key) {
      throw new Error(
        "Missing Meshy API key. Configure one from the Settings page.",
      );
    }
    return key;
  }

  function getOpenAiApiKey() {
    const secrets = readSecrets();
    const key = secrets.openai || process.env.OPENAI_API_KEY || "";
    if (!key) {
      throw new Error(
        "Missing OpenAI API key. Configure one from the Settings page.",
      );
    }
    return key;
  }

  function sanitizePayload<T extends Record<string, any>>(payload: T) {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );
  }

  function normalizeSettings(
    settings?: MeshySettings,
  ): Required<MeshySettings> {
    return {
      aiModel: settings?.aiModel ?? "latest",
      topology: settings?.topology ?? "triangle",
      targetPolycount: settings?.targetPolycount ?? 30000,
      shouldTexture: settings?.shouldTexture ?? true,
      shouldRemesh: settings?.shouldRemesh ?? true,
      enablePbr: settings?.enablePbr ?? false,
      symmetryMode: settings?.symmetryMode ?? "auto",
      artStyle: settings?.artStyle ?? "realistic",
      outputFormat: settings?.outputFormat ?? "glb",
    } satisfies Required<MeshySettings>;
  }

  async function resolveCaptureDataUri(tag?: string) {
    const directories = [FILES_DIR, DATA_DIR];
    const files = directories
      .flatMap((dir) =>
        readdirSync(dir)
          .filter((file) => /\.(png|jpg|jpeg)$/i.test(file))
          .map((file) => ({ file, dir })),
      )
      .filter(
        (entry, index, arr) =>
          arr.findIndex(
            (item) => item.file === entry.file && item.dir === entry.dir,
          ) === index,
      );
    if (!files.length) {
      throw new Error("No captures available for model generation.");
    }
    const candidates = tag
      ? files.filter((entry) => entry.file.includes(tag))
      : files;
    if (!candidates.length) {
      throw new Error("No captures available for model generation.");
    }
    const latest = candidates
      .map(({ file, dir }) => ({
        file,
        fullPath: path.join(dir, file),
        mtime: statSync(path.join(dir, file)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    const buffer = await readFile(latest.fullPath);
    const ext = path.extname(latest.file).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  async function pollMeshyTask<T>(
    url: string,
    apiKey: string,
    onProgress?: (payload: any) => void,
  ): Promise<T> {
    const startTime = Date.now();
    const maxDuration = 35 * 60 * 1000; // 35 minutes (slightly longer than client timeout)

    while (true) {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > maxDuration) {
        throw new Error("Meshy task polling timed out after 35 minutes");
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Meshy API poll failed (${response.status}): ${body}`);
      }
      const payload = (await response.json()) as any;
      onProgress?.(payload);
      if (payload.status === "SUCCEEDED") {
        return payload as T;
      }
      if (payload.status === "FAILED" || payload.status === "CANCELED") {
        const message = payload?.task_error?.message || "Meshy task failed";
        throw new Error(message);
      }
      await delay(2000);
    }
  }

  function extractOutputs(task: any): ModelJobOutputs {
    const outputs: ModelJobOutputs = {};
    if (task?.model_urls?.glb) outputs.glbUrl = task.model_urls.glb;
    if (task?.model_urls?.fbx) outputs.fbxUrl = task.model_urls.fbx;
    if (task?.model_urls?.obj) outputs.objUrl = task.model_urls.obj;
    if (task?.model_urls?.usdz) outputs.usdzUrl = task.model_urls.usdz;
    if (task?.thumbnail_url) outputs.thumbnailUrl = task.thumbnail_url;
    if (Array.isArray(task?.texture_urls)) {
      const maps = task.texture_urls
        .flatMap((entry: Record<string, string>) => Object.values(entry ?? {}))
        .filter(Boolean);
      if (maps.length) {
        outputs.textures = maps;
      }
    }
    return outputs;
  }

  async function runImageJob(
    id: string,
    body: CreateModelBody,
    apiKey: string,
  ) {
    const settings = normalizeSettings(body.settings);
    const imageData =
      body.mode === "capture"
        ? await resolveCaptureDataUri(body.captureTag)
        : body.imageData;
    if (!imageData) {
      throw new Error("No image provided for Meshy Image to 3D.");
    }

    updateJob(id, { status: "running", progress: 5 });

    logger.info(
      {
        jobId: id,
        mode: body.mode,
        captureTag: body.captureTag,
        settings,
      },
      "Submitting Meshy image-to-3d request",
    );

    const createResponse = await fetch(
      "https://api.meshy.ai/openapi/v1/image-to-3d",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          sanitizePayload({
            image_url: imageData,
            ai_model: settings.aiModel,
            topology: settings.topology,
            target_polycount: settings.targetPolycount,
            should_remesh: settings.shouldRemesh,
            should_texture: settings.shouldTexture,
            enable_pbr: settings.enablePbr,
            symmetry_mode: settings.symmetryMode,
          }),
        ),
      },
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      logger.error(
        { jobId: id, status: createResponse.status, body: text },
        "Meshy image-to-3d create failed",
      );
      throw new Error(
        `Meshy image-to-3d create failed (${createResponse.status}): ${text}`,
      );
    }

    const { result: taskId } = (await createResponse.json()) as {
      result: string;
    };
    logger.info({ jobId: id, taskId }, "Meshy image-to-3d task created");
    updateJob(id, { metadata: { previewTaskId: taskId } });

    const finalTask = await pollMeshyTask<any>(
      `https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`,
      apiKey,
      (payload) => {
        if (typeof payload?.progress === "number") {
          updateJob(id, {
            progress: Math.max(10, Math.min(95, payload.progress)),
          });
        }
      },
    );

    logger.info({ jobId: id }, "Meshy image-to-3d task succeeded");

    const outputs = extractOutputs(finalTask);
    const persisted = await persistModelOutputs(
      id,
      outputs,
      body.prompt ?? body.captureTag ?? body.mode,
      settings.outputFormat,
    );

    updateJob(id, {
      status: "done",
      progress: 100,
      outputs: persisted ?? outputs,
    });
  }

  async function runTextJob(id: string, body: CreateModelBody, apiKey: string) {
    if (!body.prompt) {
      throw new Error("Text prompt is required for Text to 3D.");
    }
    const settings = normalizeSettings(body.settings);
    logger.info(
      {
        jobId: id,
        promptLength: body.prompt.length,
        texturePromptLength: body.texturePrompt?.length ?? 0,
        settings,
      },
      "Submitting Meshy text-to-3d preview request",
    );
    updateJob(id, {
      status: "running",
      progress: 5,
      metadata: { prompt: body.prompt, texturePrompt: body.texturePrompt },
    });

    const previewResponse = await fetch(
      "https://api.meshy.ai/openapi/v2/text-to-3d",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          sanitizePayload({
            mode: "preview",
            prompt: body.prompt,
            art_style: settings.artStyle,
            ai_model: settings.aiModel,
            topology: settings.topology,
            target_polycount: settings.targetPolycount,
            should_remesh: settings.shouldRemesh,
            symmetry_mode: settings.symmetryMode,
          }),
        ),
      },
    );

    if (!previewResponse.ok) {
      const text = await previewResponse.text();
      logger.error(
        { jobId: id, status: previewResponse.status, body: text },
        "Meshy text-to-3d preview failed",
      );
      throw new Error(
        `Meshy text-to-3d preview failed (${previewResponse.status}): ${text}`,
      );
    }

    const { result: previewTaskId } = (await previewResponse.json()) as {
      result: string;
    };
    logger.info(
      { jobId: id, previewTaskId },
      "Meshy text-to-3d preview task created",
    );
    updateJob(id, { metadata: { previewTaskId } });

    const previewTask = await pollMeshyTask<any>(
      `https://api.meshy.ai/openapi/v2/text-to-3d/${previewTaskId}`,
      apiKey,
      (payload) => {
        if (typeof payload?.progress === "number") {
          const scaled = Math.min(
            80,
            Math.max(10, Math.round((payload.progress / 100) * 80)),
          );
          updateJob(id, { progress: scaled });
        }
      },
    );

    if (settings.shouldTexture === false) {
      const outputs = extractOutputs(previewTask);
      const persisted = await persistModelOutputs(
        id,
        outputs,
        body.prompt,
        settings.outputFormat,
      );
      updateJob(id, {
        status: "done",
        progress: 100,
        outputs: persisted ?? outputs,
      });
      return;
    }

    const refinePayload = sanitizePayload({
      mode: "refine",
      preview_task_id: previewTaskId,
      enable_pbr:
        settings.artStyle === "sculpture" ? false : settings.enablePbr,
      texture_prompt: body.texturePrompt,
      ai_model: settings.aiModel === "latest" ? undefined : settings.aiModel,
    });

    const refineResponse = await fetch(
      "https://api.meshy.ai/openapi/v2/text-to-3d",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refinePayload),
      },
    );

    if (!refineResponse.ok) {
      const text = await refineResponse.text();
      logger.error(
        { jobId: id, status: refineResponse.status, body: text },
        "Meshy text-to-3d refine failed",
      );
      throw new Error(
        `Meshy text-to-3d refine failed (${refineResponse.status}): ${text}`,
      );
    }

    const { result: refineTaskId } = (await refineResponse.json()) as {
      result: string;
    };
    logger.info(
      { jobId: id, refineTaskId },
      "Meshy text-to-3d refine task created",
    );
    updateJob(id, { metadata: { refineTaskId } });

    const finalTask = await pollMeshyTask<any>(
      `https://api.meshy.ai/openapi/v2/text-to-3d/${refineTaskId}`,
      apiKey,
      (payload) => {
        if (typeof payload?.progress === "number") {
          const scaled = Math.min(
            100,
            Math.max(80, Math.round(80 + (payload.progress / 100) * 20)),
          );
          updateJob(id, { progress: scaled });
        }
      },
    );

    logger.info({ jobId: id }, "Meshy text-to-3d task succeeded");

    const outputs = extractOutputs(finalTask);
    const persisted = await persistModelOutputs(
      id,
      outputs,
      body.prompt,
      settings.outputFormat,
    );

    updateJob(id, {
      status: "done",
      progress: 100,
      outputs: persisted ?? outputs,
    });
  }

  async function processModelJob(id: string, body: CreateModelBody) {
    try {
      const apiKey = getMeshyApiKey();
      logger.info({ jobId: id, mode: body.mode }, "Processing Meshy job");
      if (body.mode === "text") {
        await runTextJob(id, body, apiKey);
      } else {
        await runImageJob(id, body, apiKey);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Meshy error";
      logger.error(
        {
          jobId: id,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : String(error),
        },
        "Meshy job failed",
      );
      updateJob(id, { status: "error", error: message });
    }
  }

  fastify.post("/api/models/create", async (req, reply) => {
    const body = (req.body as CreateModelBody) ?? ({} as CreateModelBody);
    if (!body.mode) {
      return reply.status(400).send({ error: "mode is required" });
    }

    logger.info(
      {
        mode: body.mode,
        hasImageData: Boolean(body.imageData),
        captureTag: body.captureTag,
        promptLength: body.prompt?.length ?? 0,
        texturePromptLength: body.texturePrompt?.length ?? 0,
      },
      "Received request to create Meshy model job",
    );

    try {
      getMeshyApiKey();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Missing Meshy API key";
      return reply.status(428).send({
        ok: false,
        error: {
          code: "SETUP_REQUIRED",
          message,
        },
        setup: {
          ownerPin: isPinConfigured(),
          llm: isLLMConfigured().configured,
        },
      });
    }

    const id = Math.random().toString(36).slice(2);
    const now = Date.now();
    const job: ModelJob = {
      id,
      source: body.mode,
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    jobs.set(id, job);

    logger.info({ jobId: id, mode: body.mode }, "Queued Meshy model job");

    processModelJob(id, body);

    return { id };
  });

  fastify.get("/api/models/:id", async (req, reply) => {
    const job = jobs.get((req.params as any).id);
    if (!job) {
      return reply.status(404).send({ error: "not found" });
    }
    return job;
  });

  type CameraDirectoryInfo = {
    cameraId: string;
    friendlyName: string;
    lastSeenTs: number;
    latestFrameBase64?: string;
    latestFrameTs?: number;
    previousFrameBase64?: string;
    lastMotionAlertTs?: number;
  };

  const CAMERA_TTL_MS = 120_000; // 2 minutes - generous timeout for long-running cameras

  const cameraDirectory = new Map<string, CameraDirectoryInfo>();

  /**
   * Simple motion detection by comparing base64 string lengths
   * In production, this would use proper image diff/computer vision
   * Returns true if significant difference detected between frames
   */
  function detectMotion(
    entry: CameraDirectoryInfo,
    newFrameBase64: string,
  ): boolean {
    if (!entry.previousFrameBase64) return false; // Need 2 frames to compare

    const prevLength = entry.previousFrameBase64.length;
    const newLength = newFrameBase64.length;

    // Calculate percentage difference
    const diff = Math.abs(newLength - prevLength);
    const percentDiff = (diff / prevLength) * 100;

    // Trigger if difference > 5% (tunable threshold)
    const motionThreshold = 5;
    return percentDiff > motionThreshold;
  }

  /**
   * Check for active motion alarms matching the camera location
   * and fire alarm notifications if found
   */
  async function checkMotionAlarms(
    cameraId: string,
    cameraName: string,
  ): Promise<void> {
    try {
      const { getAllAlarms } = await import("./storage/alarmsStore.js");
      const alarms = await getAllAlarms();

      // Filter for enabled motion alarms matching this camera
      const matchingAlarms = alarms.filter((alarm) => {
        if (alarm.type !== "motion" || !alarm.enabled) {
          return false;
        }

        // Check if alarm matches by cameraId or location (friendly name)
        if (alarm.cameraId === cameraId) {
          return true;
        }

        if (alarm.location) {
          // Case-insensitive match on camera name
          const normalizedLocation = alarm.location.toLowerCase().trim();
          const normalizedName = cameraName.toLowerCase().trim();
          return (
            normalizedLocation === normalizedName ||
            normalizedName.includes(normalizedLocation)
          );
        }

        return false;
      });

      if (matchingAlarms.length === 0) {
        logger.debug(
          { cameraId, cameraName },
          "No matching motion alarms found",
        );
        return;
      }

      // Fire alarm notifications for each matching alarm
      const now = Date.now();
      for (const alarm of matchingAlarms) {
        await notificationScheduler.scheduleEvent(
          "alarm",
          {
            alarmId: alarm.id,
            alarmName: alarm.name,
            alarmType: "motion",
            message: `Motion alarm triggered: ${alarm.name} - Motion detected on camera "${cameraName}"`,
            cameraId,
            cameraName,
            timestamp: now,
          },
          new Date(now + 1000).toISOString(), // Fire in 1 second
        );

        logger.info(
          { alarmId: alarm.id, alarmName: alarm.name, cameraId, cameraName },
          "Motion alarm triggered",
        );
      }
    } catch (error) {
      logger.error(
        { error, cameraId, cameraName },
        "Failed to check motion alarms",
      );
    }
  }

  const cameras = io.of("/cameras");

  function emitCameraList() {
    cameras.emit("cameras:list", {
      cameras: Array.from(cameraDirectory.values()),
    });
  }

  function removeCamera(cameraId: string) {
    if (!cameraDirectory.has(cameraId)) return;
    const info = cameraDirectory.get(cameraId);
    cameraDirectory.delete(cameraId);
    cameras.emit("camera:left", { cameraId });
    emitCameraList();

    // Schedule notification for camera disconnection (immediate)
    if (info) {
      notificationScheduler
        .scheduleEvent(
          "camera_alert",
          {
            message: `Camera "${info.friendlyName}" disconnected`,
            cameraId,
            action: "disconnected",
          },
          new Date(Date.now() + 1000).toISOString(), // Fire in 1 second
        )
        .catch((err) => {
          logger.error(
            { error: err, cameraId },
            "Failed to schedule camera disconnected notification",
          );
        });
    }
  }

  cameras.on("connection", (socket) => {
    socket.emit("cameras:list", {
      cameras: Array.from(cameraDirectory.values()),
    });

    socket.on("cameras:requestList", () => {
      socket.emit("cameras:list", {
        cameras: Array.from(cameraDirectory.values()),
      });
    });

    socket.on("register", (info) => {
      socket.data.info = info;
      if (info?.deviceId) {
        socket.join("camera.clients");
      }
    });

    socket.on(
      "camera:announce",
      ({
        cameraId,
        friendlyName,
      }: {
        cameraId: string;
        friendlyName?: string;
      }) => {
        if (!cameraId) return;
        const name = friendlyName?.trim() || cameraId;
        const info: CameraDirectoryInfo = {
          cameraId,
          friendlyName: name,
          lastSeenTs: Date.now(),
          latestFrameBase64: cameraDirectory.get(cameraId)?.latestFrameBase64,
          latestFrameTs: cameraDirectory.get(cameraId)?.latestFrameTs,
        };
        cameraDirectory.set(cameraId, info);
        socket.data.cameraId = cameraId;
        socket.join("camera.clients");
        cameras.emit("camera:joined", {
          cameraId: info.cameraId,
          friendlyName: info.friendlyName,
          lastSeenTs: info.lastSeenTs,
        });
        emitCameraList();

        // Schedule notification for camera connection (immediate)
        notificationScheduler
          .scheduleEvent(
            "camera_alert",
            {
              message: `Camera "${name}" connected`,
              cameraId,
              action: "connected",
            },
            new Date(Date.now() + 1000).toISOString(), // Fire in 1 second
          )
          .catch((err) => {
            logger.error(
              { error: err, cameraId },
              "Failed to schedule camera connected notification",
            );
          });
      },
    );

    socket.on(
      "camera:frame",
      ({
        cameraId,
        ts,
        jpegBase64,
      }: {
        cameraId: string;
        ts?: number;
        jpegBase64: string;
      }) => {
        if (!cameraId || !jpegBase64) return;
        const entry = cameraDirectory.get(cameraId);
        if (!entry) return;

        // Simple motion detection: compare frame sizes (basic heuristic)
        // In production, this could use image diff libraries or computer vision
        const motionDetected = detectMotion(entry, jpegBase64);

        entry.lastSeenTs = Date.now();
        entry.previousFrameBase64 = entry.latestFrameBase64;
        entry.latestFrameBase64 = jpegBase64;
        entry.latestFrameTs = ts ?? Date.now();
        cameras.to(`camera:${cameraId}`).emit("security:frame", {
          cameraId,
          ts: entry.latestFrameTs,
          jpegBase64,
        });

        // Trigger motion alert if detected and not recently alerted (cooldown: 30 seconds)
        if (motionDetected) {
          const now = Date.now();
          const cooldown = 30_000; // 30 seconds
          if (
            !entry.lastMotionAlertTs ||
            now - entry.lastMotionAlertTs > cooldown
          ) {
            entry.lastMotionAlertTs = now;

            // Check for active motion alarms matching this camera location
            checkMotionAlarms(cameraId, entry.friendlyName).catch((err) => {
              logger.error(
                { error: err, cameraId },
                "Failed to check motion alarms",
              );
            });

            // Standard motion notification
            notificationScheduler
              .scheduleEvent(
                "camera_alert",
                {
                  message: `Motion detected on camera \"${entry.friendlyName}\"`,
                  cameraId,
                  action: "motion_detected",
                  timestamp: now,
                },
                new Date(now + 1000).toISOString(), // Fire in 1 second
              )
              .then(() => {
                logger.info(
                  { cameraId, friendlyName: entry.friendlyName },
                  "Motion detected, notification scheduled",
                );
              })
              .catch((err) => {
                logger.error(
                  { error: err, cameraId },
                  "Failed to schedule motion detection notification",
                );
              });
          }
        }
      },
    );

    socket.on("camera:heartbeat", ({ cameraId }: { cameraId: string }) => {
      if (!cameraId) return;
      const entry = cameraDirectory.get(cameraId);
      if (!entry) return;
      entry.lastSeenTs = Date.now();
    });

    socket.on("camera:bye", ({ cameraId }: { cameraId: string }) => {
      if (!cameraId) return;
      removeCamera(cameraId);
    });

    socket.on("join", ({ room, role }: { room: string; role?: string }) => {
      if (!room) return;
      socket.join(room);
      socket.data.rtcRoom = room;
      socket.data.rtcRole = role;
      logger.info({ room, role }, "RTC client joined");
    });

    socket.on("leave", ({ room }: { room: string }) => {
      if (!room) return;
      socket.leave(room);
      if (socket.data.rtcRoom === room) {
        socket.data.rtcRoom = undefined;
        socket.data.rtcRole = undefined;
      }
    });

    socket.on("viewer-offer", ({ room, sdp }: { room: string; sdp: any }) => {
      if (!room || !sdp) return;
      socket.to(room).emit("viewer-offer", { room, sdp });
    });

    socket.on(
      "publisher-answer",
      ({ room, sdp }: { room: string; sdp: any }) => {
        if (!room || !sdp) return;
        socket.to(room).emit("publisher-answer", { room, sdp });
      },
    );

    socket.on(
      "ice",
      ({ room, candidate }: { room: string; candidate: any }) => {
        if (!room) return;
        socket.to(room).emit("ice", { room, candidate: candidate ?? null });
      },
    );

    socket.on("security:subscribe", ({ cameraId }: { cameraId: string }) => {
      if (!cameraId) return;
      socket.join(`camera:${cameraId}`);
      const info = cameraDirectory.get(cameraId);
      if (info?.latestFrameBase64) {
        socket.emit("security:frame", {
          cameraId: info.cameraId,
          ts: info.latestFrameTs ?? Date.now(),
          jpegBase64: info.latestFrameBase64,
        });
      }
    });

    socket.on("security:unsubscribe", ({ cameraId }: { cameraId: string }) => {
      if (!cameraId) return;
      socket.leave(`camera:${cameraId}`);
    });

    socket.on("scan:trigger", () => {
      // Broadcast scan trigger to all connected clients
      cameras.emit("scan:trigger");
    });

    socket.on("disconnect", () => {
      const cameraId: string | undefined = socket.data.cameraId;
      if (cameraId) {
        removeCamera(cameraId);
      }
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [cameraId, info] of cameraDirectory) {
      if (now - info.lastSeenTs > CAMERA_TTL_MS) {
        removeCamera(cameraId);
      }
    }
  }, 10_000);

  function broadcastCapture(args: { tag: string; resolution?: string }) {
    cameras.to("camera.clients").emit("capture", args);
  }

  fastify.post("/api/tools/invoke", async (req, reply) => {
    const { name, args } = (req.body as any) ?? {};
    if (name === "cameras.captureAll") {
      broadcastCapture(args ?? {});
      return { ok: true };
    }
    if (name === "ui.navigate") {
      io.emit("ui:navigate", args ?? {});
      return { ok: true };
    }
    if (name === "models.createFromContext") {
      const { contextTag } = args ?? {};
      const res = await fastify.inject({
        method: "POST",
        url: "/models/create",
        payload: {
          images: [],
          prompt: `Create mesh from ${contextTag ?? "latest"}`,
        },
      });
      return res.json();
    }
    return reply.status(404).send({ error: "tool not found" });
  });

  // ── Scheduled Tasks API (/api/tasks) ──
  const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

  function loadTasks(): any[] {
    try {
      if (existsSync(TASKS_FILE)) {
        return JSON.parse(readFileSync(TASKS_FILE, "utf-8")).tasks ?? [];
      }
    } catch {}
    return [];
  }

  function saveTasks(tasks: any[]) {
    writeFileSync(TASKS_FILE, JSON.stringify({ tasks }, null, 2));
  }

  fastify.get("/api/tasks", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#70): per-IP throttle before reading
    // scheduled tasks from the filesystem.
    const rateCheck = checkRateLimit(
      { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "tasks-list" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    return { tasks: loadTasks() };
  });

  // ── Do Not Disturb API (/api/dnd) ──
  const DND_FILE = path.join(DATA_DIR, "dnd.json");

  function loadDnd(): any {
    try {
      if (existsSync(DND_FILE)) {
        return JSON.parse(readFileSync(DND_FILE, "utf-8"));
      }
    } catch {}
    return { enabled: false, schedule: null, message: "I'm currently unavailable. I'll get back to you soon.", updatedAt: null };
  }

  function saveDnd(state: any) {
    writeFileSync(DND_FILE, JSON.stringify(state, null, 2));
  }

  fastify.get("/api/dnd", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#71): per-IP throttle before reading
    // DND state from the filesystem.
    const rateCheck = checkRateLimit(
      { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "dnd-get" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    return loadDnd();
  });

  fastify.post("/api/dnd", async (req) => {
    const body = req.body as any;
    const current = loadDnd();
    if (typeof body.enabled === "boolean") current.enabled = body.enabled;
    if (body.schedule !== undefined) current.schedule = body.schedule;
    if (body.message !== undefined) current.message = body.message;
    current.updatedAt = new Date().toISOString();
    saveDnd(current);
    return { ok: true, ...current };
  });

  function extractScheduleHint(text: string): string {
    const t = text.toLowerCase();
    const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const dayMatch = days.find(d => t.includes(d));
    const timeMatch = t.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let timePart = "";
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = (timeMatch[3] || (h < 12 ? "AM" : "PM")).toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      const fh = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const fm = m.toString().padStart(2, "0");
      const fa = h >= 12 ? "PM" : "AM";
      timePart = ` at ${fh}:${fm} ${fa}`;
    }
    if (dayMatch) return `Every ${dayMatch.charAt(0).toUpperCase() + dayMatch.slice(1)}${timePart}`;
    if (/every\s+day/.test(t) || /daily/.test(t)) return `Daily${timePart}`;
    if (/every\s+hour/.test(t)) return "Every hour";
    if (/every\s+(\d+)\s*min/.test(t)) {
      const n = t.match(/every\s+(\d+)\s*min/)![1];
      return `Every ${n} minutes`;
    }
    return "manual";
  }

  fastify.post("/api/tasks", async (req, reply) => {
    const { input } = req.body as { input?: string };
    if (!input?.trim()) return reply.status(400).send({ error: "input required" });
    const tasks = loadTasks();
    const task = {
      id: crypto.randomUUID(),
      name: input.trim(),
      schedule: "",
      scheduleHuman: extractScheduleHint(input.trim()),
      command: input.trim(),
      enabled: true,
      lastRun: null,
      nextRun: null,
      status: "idle",
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    saveTasks(tasks);
    return { ok: true, task };
  });

  fastify.patch("/api/tasks", async (req, reply) => {
    const { id, enabled } = req.body as { id?: string; enabled?: boolean };
    if (!id) return reply.status(400).send({ error: "id required" });
    const tasks = loadTasks();
    const task = tasks.find((t: any) => t.id === id);
    if (!task) return reply.status(404).send({ error: "task not found" });
    if (typeof enabled === "boolean") task.enabled = enabled;
    saveTasks(tasks);
    return { ok: true, task };
  });

  fastify.delete("/api/tasks", async (req, reply) => {
    const { id } = req.body as { id?: string };
    if (!id) return reply.status(400).send({ error: "id required" });
    let tasks = loadTasks();
    tasks = tasks.filter((t: any) => t.id !== id);
    saveTasks(tasks);
    return { ok: true };
  });

  // ── Contacts API (/api/contacts) ──
  const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

  function loadContacts(): any[] {
    try {
      if (existsSync(CONTACTS_FILE)) {
        return JSON.parse(readFileSync(CONTACTS_FILE, "utf-8")).contacts ?? [];
      }
    } catch {}
    return [];
  }

  function saveContacts(contacts: any[]) {
    writeFileSync(CONTACTS_FILE, JSON.stringify({ contacts }, null, 2));
  }

  fastify.get("/api/contacts", async (req, reply) => {
    // CodeQL js/missing-rate-limiting (#72): per-IP throttle before reading
    // contacts from the filesystem.
    const rateCheck = checkRateLimit(
      { maxAttempts: 600, windowMs: 60_000, lockoutMs: 60_000, routeKey: "contacts-list" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    return { contacts: loadContacts() };
  });

  fastify.post("/api/contacts", async (req, reply) => {
    const body = req.body as any;
    if (!body.name?.trim()) return reply.status(400).send({ error: "name required" });
    const contacts = loadContacts();
    const contact = {
      id: crypto.randomUUID(),
      name: body.name.trim(),
      relationship: body.relationship || "friend",
      allowLevel: body.allowLevel || "normal",
      blockList: body.blockList || [],
      replyPersona: body.replyPersona || "",
      standingInstructions: body.standingInstructions || "",
      takeoverMode: body.takeoverMode ?? false,
      priority: body.priority || "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contacts.push(contact);
    saveContacts(contacts);
    return { ok: true, contact };
  });

  fastify.patch("/api/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const contacts = loadContacts();
    const contact = contacts.find((c: any) => c.id === id);
    if (!contact) return reply.status(404).send({ error: "contact not found" });
    for (const key of ["name","relationship","allowLevel","blockList","replyPersona","standingInstructions","takeoverMode","priority"]) {
      if (body[key] !== undefined) (contact as any)[key] = body[key];
    }
    contact.updatedAt = new Date().toISOString();
    saveContacts(contacts);
    return { ok: true, contact };
  });

  fastify.delete("/api/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    let contacts = loadContacts();
    const before = contacts.length;
    contacts = contacts.filter((c: any) => c.id !== id);
    if (contacts.length === before) return reply.status(404).send({ error: "contact not found" });
    saveContacts(contacts);
    return { ok: true };
  });

  // ── Browser-Session Gmail (Product 1 primary path) ──

  // ─────────────────────────────────────────────────────────────────────
  // G-T06.D9: unified browser-session routes.
  //
  // One handler tree per HTTP verb dispatches by providerId. Legacy paths
  // (/api/browser/gmail/*) remain as aliases that call into the same unified
  // adapter under providerId="gmail" so existing callers keep working.
  // ─────────────────────────────────────────────────────────────────────

  // Provider guards: ensure the URL providerId exists in the registry AND has
  // a browser-session lane. Anything else (whatsapp/imessage) is routed to
  // its own legacy handler tree elsewhere in this file.
  function resolveBrowserSessionProvider(providerId: string) {
    const descriptor = getProviderDescriptor(providerId);
    if (!descriptor) return null;
    if (
      descriptor.authStrategy !== "browser-session-gateway" &&
      descriptor.authStrategy !== "browser-session-spawn"
    ) {
      return null;
    }
    return descriptor;
  }

  async function accountsListForProvider(providerId: string) {
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return null;
    if (descriptor.hasGatewayDefault) ensureGatewayDefaultAccount(providerId);
    const records = listAccountsByProvider(providerId);
    const accounts = await Promise.all(
      records.map((r) => providerStatus(GATEWAY_CONFIG, descriptor, r)),
    );
    return {
      providerId,
      accounts,
      defaultAccountId: accounts.find((a) => a.isDefault)?.accountId ?? null,
    };
  }

  // G-T06.D4: Gmail inbox-summary read capability.
  //
  // Per docs/plans/G-T06.D1-google-refactor-plan.md line 308 (scope:
  // "GMAIL-READ-CAPABILITY-MIN"). The D1 plan literally names the path
  // `/api/browser/google/gmail/inbox-summary` — that was pre-unification
  // wording. Post-D11 the legacy `/api/browser/*` namespace has been
  // consolidated under `/api/channels/:providerId/*`, and the D12 recon
  // task explicitly preserves that consolidation. The route below is the
  // unified-namespace equivalent, with the same single-purpose contract:
  // return `{ unread: N }` (plus a small amount of read-only metadata)
  // from the already-open Gmail tab via a single CDP Runtime.evaluate
  // that reads ONLY row counts and document.title/location.href —
  // deliberately no scraping past metadata per the D1 plan text.
  fastify.get("/api/channels/gmail/inbox-summary", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const descriptor = resolveBrowserSessionProvider("gmail");
    if (!descriptor) return reply.status(404).send({ error: "gmail not registered" });
    const accountId = (req.query as any)?.accountId as string | undefined;
    let record = accountId ? getChannelAccountById("gmail", accountId) : null;
    if (!record) record = ensureGatewayDefaultAccount();
    if (!record) return reply.status(404).send({ error: "account not found" });
    const summary = await readGmailInboxSummary(GATEWAY_CONFIG, record);
    if (!summary.ok) {
      return reply.status(503).send({
        error: summary.error || "read failed",
        providerId: "gmail",
        accountId: record.accountId,
      });
    }
    return {
      providerId: "gmail",
      accountId: record.accountId,
      unread: summary.unread,
      rowCount: summary.rowCount,
      url: summary.url,
      title: summary.title,
    };
  });

  // G-T06.D-GMAIL-READ-INBOX-01: structured inbox rows (read-only).
  // Sibling of /inbox-summary. Returns sender/subject/snippet/timestamp/unread
  // for the first N rows of the already-rendered Gmail tab. No credential
  // operations, no mutations, no /send, no /archive, no /markRead.
  fastify.get("/api/channels/gmail/inbox", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const descriptor = resolveBrowserSessionProvider("gmail");
    if (!descriptor) return reply.status(404).send({ ok: false, error: "gmail not registered", messages: [] });
    const q = (req.query as any) || {};
    const accountId = q.accountId as string | undefined;
    const limitRaw = Number(q.limit ?? 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 10));
    let record = accountId ? getChannelAccountById("gmail", accountId) : null;
    if (!record) record = ensureGatewayDefaultAccount();
    if (!record) return reply.status(404).send({ ok: false, error: "account not found", messages: [] });
    const env = await providerStatus(GATEWAY_CONFIG, descriptor, record);
    if (env.channelState !== "connected") {
      return reply.status(409).send({
        ok: false,
        reason: "not_connected",
        providerId: "gmail",
        accountId: record.accountId,
        channelState: env.channelState,
        messages: [],
      });
    }
    const result = await readGmailInbox(GATEWAY_CONFIG, record, limit);
    if (!result.ok) {
      return reply.status(503).send({
        ok: false,
        reason: "read_failed",
        error: result.error || "read failed",
        providerId: "gmail",
        accountId: record.accountId,
        messages: [],
      });
    }
    return {
      ok: true,
      providerId: "gmail",
      accountId: record.accountId,
      messages: result.messages,
    };
  });

  // G-CAL-READ-EVENTS-01: structured calendar events (read-only).
  // Returns title/timeText/dayLabel for the first N events from the already-rendered
  // Google Calendar tab. No credential operations, no mutations, no write paths.
  fastify.get("/api/channels/google-calendar/events", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const descriptor = resolveBrowserSessionProvider("google-calendar");
    if (!descriptor) return reply.status(404).send({ ok: false, error: "google-calendar not registered", events: [] });
    const q = (req.query as any) || {};
    const accountId = q.accountId as string | undefined;
    const limitRaw = Number(q.limit ?? 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 10));
    let record = accountId ? getChannelAccountById("google-calendar", accountId) : null;
    if (!record) record = ensureGatewayDefaultAccount("google-calendar");
    if (!record) return reply.status(404).send({ ok: false, error: "account not found", events: [] });
    const env = await providerStatus(GATEWAY_CONFIG, descriptor, record);
    if (env.channelState !== "connected") {
      return reply.status(409).send({
        ok: false,
        reason: "not_connected",
        providerId: "google-calendar",
        accountId: record.accountId,
        channelState: env.channelState,
        events: [],
      });
    }
    const result = await readGoogleCalendarEvents(GATEWAY_CONFIG, record, limit);
    if (!result.ok) {
      return reply.status(503).send({
        ok: false,
        reason: "read_failed",
        error: result.error || "read failed",
        providerId: "google-calendar",
        accountId: record.accountId,
        events: [],
      });
    }
    return {
      ok: true,
      providerId: "google-calendar",
      accountId: record.accountId,
      events: result.events,
    };
  });

  // G-T06.D14: category counts endpoint. Drives the /settings/channels
  // category landing page badges. Iterates every descriptor in each
  // category, pulls live account status via the shared adapter, and
  // returns per-category totals. Only aggregates already-live providers
  // — qr-scan/placeholder providers (WhatsApp, iMessage) are counted in
  // `providers` but contribute 0 to `connectedAccounts`/`totalAccounts`
  // because they don't go through the browser-session account model.
  fastify.get("/api/channels/counts", async (req, reply) => {
    // CodeQL js/missing-rate-limiting hardening. Light bucket because this is
    // a read-only aggregator; aggressive burst limiting is unnecessary but
    // per-IP throttling prevents enumeration-of-channels amplification.
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.ADMIN_LIGHT, routeKey: "channels-counts" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    const categories: Array<"email" | "messages" | "phone" | "calendar"> = ["email", "messages", "phone", "calendar"];
    const result: Record<string, { providers: number; connectedAccounts: number; totalAccounts: number }> = {};

    for (const category of categories) {
      const descriptors = listProvidersByCategory(category);
      let connectedAccounts = 0;
      let totalAccounts = 0;

      for (const descriptor of descriptors) {
        // Only browser-session providers contribute live account rows; qr-scan
        // and placeholder providers are counted as descriptors but contribute
        // zero accounts because they don't use the unified accounts index.
        if (
          descriptor.authStrategy !== "browser-session-gateway" &&
          descriptor.authStrategy !== "browser-session-spawn"
        ) {
          continue;
        }
        if (descriptor.hasGatewayDefault) ensureGatewayDefaultAccount(descriptor.providerId);
        const records = listAccountsByProvider(descriptor.providerId);
        totalAccounts += records.length;
        for (const record of records) {
          const env = await providerStatus(GATEWAY_CONFIG, descriptor, record);
          if (env.channelState === "connected") connectedAccounts++;
        }
      }

      result[category] = {
        providers: descriptors.length,
        connectedAccounts,
        totalAccounts,
      };
    }

    return result;
  });

  // List endpoint — providerId-parameterized.
  fastify.get("/api/channels/:providerId/accounts", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { providerId } = req.params as { providerId: string };
    const payload = await accountsListForProvider(providerId);
    if (!payload) return reply.status(404).send({ error: "unknown provider" });
    return payload;
  });

  // Mint a new account for a browser-session-spawn provider (or promote a
  // default for gmail — mint-default is not supported; the default is
  // auto-ensured on list).
  fastify.post("/api/channels/:providerId/accounts", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { providerId } = req.params as { providerId: string };
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return reply.status(404).send({ error: "unknown provider" });
    if (descriptor.authStrategy !== "browser-session-spawn") {
      return reply.status(409).send({ error: "this provider cannot mint additional accounts" });
    }
    const record = mintChannelAccount(providerId);
    const result = await providerConnect(GATEWAY_CONFIG, descriptor, record);
    if (!result.ok) {
      removeChannelAccount(providerId, record.accountId);
      return reply.status(503).send({ error: result.message, accountId: record.accountId });
    }
    return {
      accountId: record.accountId,
      providerId,
      profileDir: record.profileDir,
      cdpPort: record.cdpPort,
      message: `New ${descriptor.displayName} account Chrome started. Sign in in the opened window.`,
    };
  });

  // Remove (non-default) account. G-T06.D11 adds a bounded destructive
  // `?purge=true` variant that also deletes the profile directory on disk.
  // Purge is gated behind an explicit `X-AKIOR-Confirm-Purge: true` header
  // so a stray DELETE with the query string alone can never wipe a profile.
  // The default account is still hard-blocked — its profile dir is the
  // OpenClaw gateway's shared store and deleting it would take the gateway
  // offline for Gmail and any future gateway-backed provider.
  fastify.delete("/api/channels/:providerId/accounts/:accountId", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    // CodeQL js/missing-rate-limiting hardening. Moderate bucket because this
    // is an account-destructive endpoint (kills Chrome subprocess + optionally
    // purges the on-disk profile). Per-IP throttling blocks rapid enumeration
    // + abuse of the existing X-AKIOR-Confirm-Purge gate below.
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.ADMIN_MODERATE, routeKey: "channels-account-delete" },
      getClientIp(req),
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }
    const { providerId, accountId } = req.params as { providerId: string; accountId: string };
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return reply.status(404).send({ error: "unknown provider" });
    const record = getChannelAccountById(providerId, accountId);
    if (!record) return reply.status(404).send({ error: "account not found" });
    if (record.isDefault) {
      return reply.status(409).send({ error: "cannot remove default account" });
    }
    const purgeRequested = (req.query as any)?.purge === "true";
    const purgeConfirmed =
      String(req.headers["x-akior-confirm-purge"] || "").toLowerCase() === "true";
    if (purgeRequested && !purgeConfirmed) {
      return reply.status(428).send({
        error: "purge requires X-AKIOR-Confirm-Purge: true header",
      });
    }

    killSpawnedProcess(providerId, accountId, record.pid);
    removeChannelAccount(providerId, accountId);

    let profileDirPurged = false;
    if (purgeRequested && purgeConfirmed) {
      // Give the Chrome subprocess a moment to release file locks before rm.
      await new Promise((r) => setTimeout(r, 500));
      try {
        // Hard-guard the path: only rm paths that live under our profile root.
        if (record.profileDir.startsWith(BROWSER_PROFILE_ROOT) && !record.isDefault) {
          rmSync(record.profileDir, { recursive: true, force: true });
          profileDirPurged = true;
        }
      } catch (err) {
        logger.warn(
          { err: String(err), profileDir: record.profileDir },
          "channels.account.purge.error",
        );
      }
    }

    return {
      providerId,
      accountId,
      removed: true,
      profileDirPurged,
      profileDir: record.profileDir,
    };
  });

  // Per-account status.
  fastify.get("/api/channels/:providerId/status", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { providerId } = req.params as { providerId: string };
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return reply.status(404).send({ error: "unknown provider" });
    const accountId = (req.query as any)?.accountId as string | undefined;
    let record = accountId ? getChannelAccountById(providerId, accountId) : null;
    if (!record && descriptor.hasGatewayDefault) record = ensureGatewayDefaultAccount(providerId);
    if (!record) return reply.status(404).send({ error: "account not found" });
    return providerStatus(GATEWAY_CONFIG, descriptor, record);
  });

  // Per-account connect.
  fastify.post("/api/channels/:providerId/connect", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { providerId } = req.params as { providerId: string };
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return reply.status(404).send({ error: "unknown provider" });
    const accountId = (req.query as any)?.accountId as string | undefined;
    let record = accountId ? getChannelAccountById(providerId, accountId) : null;
    if (!record && descriptor.hasGatewayDefault) record = ensureGatewayDefaultAccount(providerId);
    if (!record) return reply.status(404).send({ error: "account not found" });
    const result = await providerConnect(GATEWAY_CONFIG, descriptor, record);
    if (!result.ok) return reply.status(503).send(result);
    return { ...result, providerId, accountId: record.accountId, isDefault: record.isDefault };
  });

  // Per-account disconnect.
  fastify.post("/api/channels/:providerId/disconnect", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { providerId } = req.params as { providerId: string };
    const descriptor = resolveBrowserSessionProvider(providerId);
    if (!descriptor) return reply.status(404).send({ error: "unknown provider" });
    const accountId = (req.query as any)?.accountId as string | undefined;
    let record = accountId ? getChannelAccountById(providerId, accountId) : null;
    if (!record && descriptor.hasGatewayDefault) record = ensureGatewayDefaultAccount(providerId);
    if (!record) return reply.status(404).send({ error: "account not found" });
    const result = await providerDisconnect(GATEWAY_CONFIG, descriptor, record);
    if (result.closed) await new Promise((r) => setTimeout(r, 600));
    const envelope = await providerStatus(GATEWAY_CONFIG, descriptor, record);
    return { ...envelope, message: result.message, closed: result.closed };
  });

  // G-T06.D11: the legacy /api/browser/gmail/{status,connect,disconnect}
  // aliases (kept as compatibility shims through D9) and the D7/D8 per-
  // provider static aliases are both gone. A full-tree grep of *.ts/*.tsx/
  // *.js/*.jsx/*.mjs/*.cjs across the whole repo (see D11 Phase B audit)
  // returned zero callers outside of this file, so removal is safe. Every
  // browser-session provider — Gmail default, Gmail secondary, Yahoo,
  // Outlook — is served by the parameterized /api/channels/:providerId/*
  // handlers above via the unified adapter.

  // ── WhatsApp DEC-032 Direct-Import Routes ──

  fastify.get("/api/channels/whatsapp/status", async () => {
    return {
      state: waSession.state,
      channelState: deriveWhatsAppChannelState(waSession.state),
      identity: null,
      qrDataUrl: waSession.state === "awaiting_scan" ? waSession.qrDataUrl : null,
      message: waSession.message,
      startedAt: waSession.startedAt,
    };
  });

  fastify.post("/api/channels/whatsapp/connect", async (_req, reply) => {
    // If fresh QR already active, return it
    if (
      waSession.state === "awaiting_scan" &&
      waSession.qrDataUrl &&
      waSession.startedAt &&
      Date.now() - waSession.startedAt < 60_000
    ) {
      return {
        state: waSession.state,
        qrDataUrl: waSession.qrDataUrl,
        message: waSession.message,
        startedAt: waSession.startedAt,
      };
    }

    // Resolve the OpenClaw module
    let waMod: Awaited<ReturnType<typeof resolveWaModule>>;
    try {
      waMod = await resolveWaModule();
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }

    // Start fresh attempt (force: true cleans up any prior socket via OpenClaw internal resetActiveLogin)
    resetWaSession();
    try {
      const result = await waMod.startWebLoginWithQr({ force: true });
      if (!result.qrDataUrl) {
        // Already linked or other non-QR response
        waSession.state = result.message?.includes("already linked") ? "linked" : "idle";
        waSession.message = result.message || null;
        return { state: waSession.state, message: waSession.message };
      }

      waSession.state = "awaiting_scan";
      waSession.qrDataUrl = result.qrDataUrl;
      waSession.message = result.message || "Scan this QR in WhatsApp → Linked Devices.";
      waSession.startedAt = Date.now();

      // Background: wait for scan completion (120s timeout)
      waSession.waitPromise = (async () => {
        try {
          const waitResult = await waMod.waitForWebLogin({ timeoutMs: 120_000 });
          if (waitResult.connected) {
            waSession.state = "linked";
            waSession.message = waitResult.message || "WhatsApp connected.";
            waSession.qrDataUrl = null;
          } else {
            if (waSession.state === "awaiting_scan") {
              waSession.state = "timed_out";
              waSession.message = waitResult.message || "QR scan timed out.";
              waSession.qrDataUrl = null;
            }
          }
        } catch (err) {
          if (waSession.state === "awaiting_scan") {
            waSession.state = "timed_out";
            waSession.message = (err as Error).message || "WhatsApp login error.";
            waSession.qrDataUrl = null;
          }
        }
        if (waSession.timeoutHandle) {
          clearTimeout(waSession.timeoutHandle);
          waSession.timeoutHandle = null;
        }
      })();

      // Safety timeout: if waitForWebLogin hangs beyond 130s, force transition
      waSession.timeoutHandle = setTimeout(() => {
        if (waSession.state === "awaiting_scan") {
          waSession.state = "timed_out";
          waSession.message = "QR scan timed out.";
          waSession.qrDataUrl = null;
        }
        waSession.timeoutHandle = null;
      }, 130_000);

      return {
        state: waSession.state,
        qrDataUrl: waSession.qrDataUrl,
        message: waSession.message,
        startedAt: waSession.startedAt,
      };
    } catch (err) {
      resetWaSession();
      return reply.status(500).send({ error: (err as Error).message || "WhatsApp connect failed" });
    }
  });

  fastify.post("/api/channels/whatsapp/cancel", async () => {
    if (waSession.state === "awaiting_scan") {
      // Trigger cleanup via force: true (OpenClaw's internal resetActiveLogin closes the socket)
      try {
        const waMod = await resolveWaModule();
        waMod.startWebLoginWithQr({ force: true }).catch(() => {});
      } catch {}
      resetWaSession();
      waSession.state = "cancelled";
      waSession.message = "WhatsApp connect cancelled.";
    }
    return { state: waSession.state };
  });

  // G-T06.D6: disconnect wipes the local pairing/login session and returns the
  // card to "disconnected". Per D5 §3.4 this is the user-visible "end session"
  // action. It does NOT touch the separate `whatsappGatewayHandle` used by the
  // send route — that is a distinct long-lived surface whose teardown belongs
  // to server shutdown, not to the user's Channels UI.
  fastify.post("/api/channels/whatsapp/disconnect", async () => {
    if (waSession.state === "awaiting_scan") {
      // Best-effort close of a pending QR login before resetting state.
      try {
        const waMod = await resolveWaModule();
        waMod.startWebLoginWithQr({ force: true }).catch(() => {});
      } catch {}
    }
    resetWaSession();
    waSession.message = "WhatsApp session cleared.";
    return {
      state: waSession.state,
      channelState: deriveWhatsAppChannelState(waSession.state),
      identity: null,
      qrDataUrl: null,
      message: waSession.message,
      startedAt: null,
    };
  });

  // ── WhatsApp Send Route (W-T05, Direction A: OpenClaw Gateway RPC) ──

  fastify.post("/api/channels/whatsapp/send", async (request, reply) => {
    const contentType = request.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      const validation = validateSendInput("__UNSUPPORTED_MEDIA_TYPE__");
      if (!validation.ok) {
        return reply.status(validation.status).send({ ok: false, error: validation.error });
      }
    }

    const validation = validateSendInput(request.body);
    if (!validation.ok) {
      return reply.status(validation.status).send({
        ok: false,
        error: validation.error,
        ...(validation.detail ? { detail: validation.detail } : {}),
      });
    }

    const { to, message } = validation.value;
    const requestId = randomUUID();
    const startTime = Date.now();

    logger.info(
      { toSuffix: "***" + to.slice(-4), messageLength: message.length, requestId },
      "whatsapp.send.request.start",
    );

    const result = await sendWhatsAppMessage(whatsappGatewayHandle, { to, message });
    const durationMs = Date.now() - startTime;

    if (result.ok) {
      logger.info(
        { messageId: result.messageId, durationMs, requestId },
        "whatsapp.send.request.success",
      );
      return reply.status(200).send({
        ok: true,
        messageId: result.messageId,
        toJid: result.toJid,
      });
    }

    const statusMap: Record<string, number> = {
      whatsapp_send_unavailable: 503,
      gateway_unreachable: 503,
      gateway_auth_failed: 502,
      gateway_rpc_error: 502,
      gateway_timeout: 504,
      internal_error: 500,
    };
    const status = statusMap[result.errorCode] ?? 500;

    logger.error(
      { errorCode: result.errorCode, detail: result.detail, durationMs, requestId },
      "whatsapp.send.request.failure",
    );

    return reply.status(status).send({
      ok: false,
      error: result.errorCode,
      ...(result.detail ? { detail: result.detail } : {}),
    });
  });

  const PORT = Number(process.env.PORT || 1234);
  const hostEnv = process.env.BIND_ADDR ?? process.env.HOST;
  const HOST = hostEnv?.trim() || "0.0.0.0";
  const publicHostEnv =
    process.env.PUBLIC_HOST ?? process.env.SERVER_PUBLIC_HOST;
  const PUBLIC_HOST =
    publicHostEnv?.trim() ||
    (HOST === "0.0.0.0" ? process.env.HOSTNAME || "localhost" : HOST);

  // ── WhatsApp Send — init gateway client (W-T05, non-blocking) ──
  whatsappGatewayHandle = await initWhatsAppGatewayClient();

  fastify.addHook("onClose", async () => {
    await closeWhatsAppGatewayClient(whatsappGatewayHandle);
  });

  await fastify.listen({ port: PORT, host: HOST });
  const protocol = hasCertificates ? "https" : "http";
  const displayHost = PUBLIC_HOST || (HOST === "0.0.0.0" ? "localhost" : HOST);
  if (hasCertificates) {
    logger.warn(`HTTPS & Socket.IO up on ${protocol}://${displayHost}:${PORT}`);
  } else {
    logger.warn(`HTTP & Socket.IO up on ${protocol}://${displayHost}:${PORT}`);
  }
} catch (err) {
  logger.error(
    { err, stack: err instanceof Error ? err.stack : undefined },
    "Server initialization failed - see error details above",
  );
  console.error("FATAL: Server initialization error:", err);
  process.exit(1);
}
