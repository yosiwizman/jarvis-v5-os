import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { Server as IOServer } from 'socket.io';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { readFile, writeFile, rm } from 'fs/promises';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';
import { z } from 'zod';
import type { ModelJob, ModelJobOutputs } from '@shared/core';
import { registerKeyRoutes } from './routes/keys.routes';
import { register3DPrintRoutes } from './routes/3dprint.routes';
import { readSecrets } from './storage/secretStore';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');

const toAbsolutePath = (value: string) => (path.isAbsolute(value) ? value : path.resolve(repoRoot, value));

const resolveFirstExisting = (paths: string[]) => {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

const certDirCandidates: string[] = [];
for (const candidate of [process.env.SERVER_TLS_CERT_DIR, process.env.CERT_DIR]) {
  if (candidate && candidate.trim()) {
    certDirCandidates.push(toAbsolutePath(candidate.trim()));
  }
}
certDirCandidates.push(path.join(serverRoot, 'certs'));
certDirCandidates.push(path.join(repoRoot, 'infra/certs'));
certDirCandidates.push(path.join(serverRoot, 'infra/certs'));

const certDir = resolveFirstExisting(certDirCandidates) ?? certDirCandidates[0]!;

const explicitCertName = process.env.SERVER_TLS_CERT_NAME?.trim() || process.env.CERT_NAME?.trim();
const fallbackCertName = existsSync(path.join(certDir, 'jarvis.local.pem')) ? 'jarvis.local' : 'localhost';
const certName = explicitCertName || fallbackCertName;

const keyPathEnv = process.env.SERVER_TLS_KEY_PATH?.trim() || process.env.CERT_KEY?.trim();
const certPathEnv = process.env.SERVER_TLS_CERT_PATH?.trim() || process.env.CERT_CRT?.trim();

const resolvedKeyPath = keyPathEnv ? toAbsolutePath(keyPathEnv) : path.join(certDir, `${certName}-key.pem`);
const resolvedCertPath = certPathEnv ? toAbsolutePath(certPathEnv) : path.join(certDir, `${certName}.pem`);

const hasCertificates = existsSync(resolvedKeyPath) && existsSync(resolvedCertPath);

const fastify = Fastify({
  logger: true,
  bodyLimit: 20 * 1024 * 1024,
  ...(hasCertificates
    ? {
        https: {
          key: readFileSync(resolvedKeyPath),
          cert: readFileSync(resolvedCertPath)
        }
      }
    : {})
});

if (!hasCertificates) {
  fastify.log.warn(
    `HTTPS certificates not found (looked for key at "${resolvedKeyPath}" and cert at "${resolvedCertPath}"). Falling back to HTTP. Configure SERVER_TLS_CERT_NAME/CERT_NAME, SERVER_TLS_KEY_PATH/CERT_KEY, or SERVER_TLS_CERT_PATH/CERT_CRT to point to valid certificates.`
  );
} else {
  fastify.log.info({ keyPath: resolvedKeyPath, certPath: resolvedCertPath }, 'Loaded TLS certificates');
}

const io = new IOServer(fastify.server, {
  cors: {
    origin: true,
    credentials: true
  }
});

await fastify.register(fastifyCors, {
  origin: (origin, cb) => {
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
await fastify.register(multipart);

const config = {
  openai: {
    realtimeModel: 'gpt-realtime-mini'
  },
  rtc: {
    stun: ['stun:stun.l.google.com:19302'],
    sfu: null as string | null
  }
};

fastify.get('/config', async () => ({
  rtc: config.rtc,
  features: { voice: true, security: true, mesh: true, image: true },
  defaults: {
    voices: ['alloy', 'verse', 'luna'],
    realtimeModels: [
      'gpt-realtime-mini',
      'gpt-realtime',
      'gpt-audio-mini',
      'gpt-audio'
    ]
  }
}));

// System metrics endpoint (note: /api prefix is stripped by dev-proxy)
fastify.get('/system/metrics', async () => {
  const os = await import('os');
  
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
    memoryUsedGB: Number((usedMem / (1024 ** 3)).toFixed(2)),
    memoryTotalGB: Number((totalMem / (1024 ** 3)).toFixed(2)),
    timestamp: new Date().toISOString(),
    uptime: os.uptime()
  };
});

// Weather integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.get('/integrations/weather', async (req, reply) => {
  const { location } = req.query as { location?: string };
  
  // Read API key from environment
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    fastify.log.warn('Weather API key not configured');
    return reply.status(503).send({ error: 'Weather API key not configured' });
  }
  
  // Use provided location or default
  const cityQuery = location || 'Miami,US';
  
  try {
    fastify.log.info({ location: cityQuery }, 'Fetching weather data');
    
    // Call OpenWeather API
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityQuery)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      fastify.log.error({ status: response.status, error: errorText }, 'OpenWeather API error');
      return reply.status(response.status).send({ error: 'Failed to fetch weather data' });
    }
    
    const data = await response.json() as any;
    
    // Map to clean response format
    const weatherResponse = {
      location: data.name && data.sys?.country ? `${data.name}, ${data.sys.country}` : data.name || cityQuery,
      temperatureC: Math.round(data.main?.temp ?? 0),
      temperatureF: Math.round((data.main?.temp ?? 0) * 9 / 5 + 32),
      condition: data.weather?.[0]?.main || 'Unknown',
      description: data.weather?.[0]?.description || '',
      iconCode: data.weather?.[0]?.icon || '01d',
      humidity: data.main?.humidity ?? 0,
      windKph: Math.round((data.wind?.speed ?? 0) * 3.6), // m/s to km/h
      updatedAt: new Date().toISOString()
    };
    
    fastify.log.info({ location: weatherResponse.location, temp: weatherResponse.temperatureC }, 'Weather data fetched');
    
    return weatherResponse;
  } catch (error) {
    fastify.log.error({ error, location: cityQuery }, 'Failed to fetch weather');
    return reply.status(500).send({ error: 'Failed to fetch weather data' });
  }
});

// Web Search integration endpoint (note: /api prefix is stripped by dev-proxy)
fastify.post('/integrations/web-search', async (req, reply) => {
  const body = req.body as { query?: string; maxResults?: number };
  
  if (!body.query || typeof body.query !== 'string' || !body.query.trim()) {
    return reply.status(400).send({ ok: false, error: 'query is required' });
  }
  
  // Import web search client dynamically
  const { runWebSearch } = await import('./clients/webSearchClient.js');
  
  const result = await runWebSearch({
    query: body.query,
    maxResults: body.maxResults ?? 5
  });
  
  if (!result.ok) {
    // Return appropriate status codes based on error type
    if (result.error === 'web_search_not_configured') {
      return reply.status(503).send(result);
    }
    return reply.status(500).send(result);
  }
  
  return result;
});

// 3D Print token status endpoint (stub for now)
fastify.get('/3dprint/token-status', async () => {
  // TODO: Implement real Bambu auth token check
  // For now, return a stub response so UI doesn't error
  // Response shape matches TokenStatusResponse type from @shared/3dprint
  return {
    ok: true,
    loggedIn: false,
    connected: false,
    provider: 'bambu',
    hasToken: false,
    error: null
  };
});

const DATA_DIR = path.join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// GET /settings - Load settings from server
fastify.get('/settings', async (req, reply) => {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = await readFile(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(content);
      return settings;
    }
    // Return empty object if file doesn't exist yet
    return {};
  } catch (error) {
    fastify.log.error({ error }, 'Failed to read settings');
    reply.code(500);
    return { error: 'Failed to read settings' };
  }
});

// POST /settings - Save settings to server
fastify.post('/settings', async (req, reply) => {
  try {
    const settings = req.body;
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    fastify.log.info('Settings saved to server');
    return { success: true };
  } catch (error) {
    fastify.log.error({ error }, 'Failed to save settings');
    reply.code(500);
    return { error: 'Failed to save settings' };
  }
});

const FILES_DIR = path.join(DATA_DIR, 'files');
if (!existsSync(FILES_DIR)) {
  mkdirSync(FILES_DIR, { recursive: true });
}

await fastify.register(fastifyStatic, {
  root: DATA_DIR,
  prefix: '/static/'
});

await fastify.register(fastifyStatic, {
  root: FILES_DIR,
  prefix: '/files/',
  decorateReply: false
});

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg']);
const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'fbx', 'obj', 'usdz']);

type FileCategory = 'image' | 'stl' | 'model' | 'other';

type StoredFileDescriptor = {
  name: string;
  url: string;
  size: number;
  modifiedAt: number;
  extension: string;
  category: FileCategory;
};

function slugify(value: string | undefined | null) {
  if (!value) return 'file';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';
}

function createFilename(base: string | undefined, extension: string) {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const slug = slugify(base);
  const unique = randomUUID().slice(0, 8);
  return `${slug}-${unique}.${safeExtension}`;
}

function inferExtensionFromMime(mime: string | null, fallback?: string) {
  if (!mime) return fallback;
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('stl')) return 'stl';
  if (mime.includes('gltf') || mime.includes('glb')) return 'glb';
  if (mime.includes('fbx')) return 'fbx';
  if (mime.includes('obj')) return 'obj';
  if (mime.includes('usdz')) return 'usdz';
  return fallback;
}

function inferExtensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) {
      return ext.replace(/^\./, '');
    }
  } catch {
    const ext = path.extname(url).toLowerCase();
    if (ext) {
      return ext.replace(/^\./, '');
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
    url: `/files/${filename}`
  };
}

async function storeRemoteFile(url: string, hint?: string, fallbackExtension?: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mime = response.headers.get('content-type');
  const extension = inferExtensionFromMime(mime, inferExtensionFromUrl(url) ?? fallbackExtension ?? 'bin') ?? 'bin';
  return storeBuffer(Buffer.from(arrayBuffer), extension, hint);
}

function categorizeFile(extension: string): FileCategory {
  const ext = extension.toLowerCase();
  if (ext === 'stl') return 'stl';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (MODEL_EXTENSIONS.has(ext)) return 'model';
  return 'other';
}

function listStoredFiles(): StoredFileDescriptor[] {
  const entries = readdirSync(FILES_DIR, { withFileTypes: true });
  const files: StoredFileDescriptor[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const extension = path.extname(name).replace(/^\./, '').toLowerCase();
    const stats = statSync(path.join(FILES_DIR, name));
    files.push({
      name,
      url: `/files/${name}`,
      size: stats.size,
      modifiedAt: stats.mtimeMs,
      extension,
      category: categorizeFile(extension)
    });
  }
  return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function persistModelOutputs(
  jobId: string,
  outputs: ModelJobOutputs | undefined,
  hint?: string,
  preferredFormat: 'glb' | 'obj' | 'usdz' = 'glb'
): Promise<ModelJobOutputs | undefined> {
  if (!outputs) return undefined;
  const baseHint = hint ?? `model-${jobId}`;
  const next: ModelJobOutputs = { ...outputs };

  // Map format to the corresponding output key
  const formatKeyMap = {
    glb: 'glbUrl',
    obj: 'objUrl',
    usdz: 'usdzUrl'
  } as const;

  const preferredKey = formatKeyMap[preferredFormat];

  // Only download the preferred format and thumbnail
  const singleFiles: Array<{
    key: keyof ModelJobOutputs;
    url?: string;
    suffix: string;
    fallbackExt?: string;
  }> = [
    { key: preferredKey, url: outputs[preferredKey], suffix: `mesh-${preferredFormat}`, fallbackExt: preferredFormat },
    { key: 'thumbnailUrl', url: outputs.thumbnailUrl, suffix: 'thumbnail', fallbackExt: 'jpg' }
  ];

  for (const entry of singleFiles) {
    const { key, url, suffix, fallbackExt } = entry;
    if (!url || url.startsWith('/files/')) continue;
    try {
      const stored = await storeRemoteFile(url, `${baseHint}-${suffix}`, fallbackExt);
      (next as Record<string, any>)[key] = stored.url;
    } catch (error) {
      fastify.log.error({ jobId, url, error }, 'Failed to persist model output file');
    }
  }

  if (Array.isArray(outputs.textures) && outputs.textures.length) {
    const persistedTextures: string[] = [];
    for (let index = 0; index < outputs.textures.length; index += 1) {
      const textureUrl = outputs.textures[index];
      if (!textureUrl) continue;
      if (textureUrl.startsWith('/files/')) {
        persistedTextures.push(textureUrl);
        continue;
      }
      try {
        const stored = await storeRemoteFile(textureUrl, `${baseHint}-texture-${index}`, 'png');
        persistedTextures.push(stored.url);
      } catch (error) {
        fastify.log.error({ jobId, url: textureUrl, error }, 'Failed to persist texture map');
      }
    }
    if (persistedTextures.length) {
      next.textures = persistedTextures;
    }
  }

  return next;
}
registerKeyRoutes(fastify, io);
register3DPrintRoutes(fastify);

const ReasoningEffortSchema = z.enum(['minimal', 'low', 'medium', 'high']);
const VerbositySchema = z.enum(['low', 'medium', 'high']);
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1)
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  settings: z
    .object({
      model: z.string().min(1).optional(),
      initialPrompt: z.string().optional(),
      reasoningEffort: ReasoningEffortSchema.optional(),
      verbosity: VerbositySchema.optional(),
      maxOutputTokens: z.number().int().positive().optional()
    })
    .optional(),
  previousResponseId: z.string().optional(),
  tools: z.array(z.any()).optional()
});

fastify.post('/openai/text-chat', async (req, reply) => {
  const parsed = ChatRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return reply
      .status(400)
      .send({ error: firstIssue?.message ?? 'Invalid chat request payload' });
  }

  const { messages, settings, previousResponseId, tools } = parsed.data;

  const trimmedInitialPrompt = settings?.initialPrompt?.trim() ?? '';
  const reasoningEffort = settings?.reasoningEffort;
  const verbosity = settings?.verbosity;
  const maxOutputTokens = settings?.maxOutputTokens;

  let apiKey: string;
  try {
    apiKey = getOpenAiApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI API key not configured';
    return reply.status(500).send({ error: message });
  }

  const payload: Record<string, any> = {
    model: settings?.model?.trim() || 'gpt-5'
  };

  const conversation = previousResponseId ? messages.slice(-1) : messages;
  if (!conversation.length) {
    return reply.status(400).send({ error: 'No messages supplied for chat request' });
  }

  const inputMessages = conversation.map((message) => ({
    role: message.role,
    content: [
      {
        type: 'input_text',
        text: message.content
      }
    ]
  }));

  if (!previousResponseId && trimmedInitialPrompt) {
    payload.input = [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text: trimmedInitialPrompt
          }
        ]
      },
      ...inputMessages
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
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to reach OpenAI Responses API');
    return reply.status(502).send({ error: 'Failed to reach OpenAI Responses API' });
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
      'OpenAI text chat request failed';
    fastify.log.error({ status: upstream.status, body: raw }, 'OpenAI text chat request failed');
    return reply.status(upstream.status).send({ error: message });
  }

  // Check if response contains tool calls
  const outputs = Array.isArray(openaiPayload?.output) ? openaiPayload.output : [];
  const toolCalls: any[] = [];
  
  for (const item of outputs) {
    if (!item || typeof item !== 'object') continue;
    
    // Check for function calls in the output
    if (item.type === 'function_call' && item.name && item.call_id) {
      toolCalls.push({
        id: item.call_id,
        type: 'function',
        function: {
          name: item.name,
          arguments: item.arguments || '{}'
        }
      });
    }
  }

  // If there are tool calls, return them to the client
  if (toolCalls.length > 0) {
    fastify.log.info({ toolCalls }, 'OpenAI response includes tool calls');
    return reply.send({
      toolCalls,
      responseId: openaiPayload?.id ?? null
    });
  }

  // Otherwise, extract and return the text
  const text = extractOutputText(openaiPayload);
  if (!text) {
    fastify.log.error({ body: openaiPayload }, 'OpenAI response missing text output');
    return reply.status(502).send({ error: 'OpenAI response did not include text output' });
  }

  return reply.send({
    message: text.trim(),
    responseId: openaiPayload?.id ?? null
  });
});

const ToolResultSchema = z.object({
  toolCallId: z.string(),
  output: z.string()
});

const ChatToolResultRequestSchema = z.object({
  responseId: z.string(),
  toolResults: z.array(ToolResultSchema).min(1),
  settings: z
    .object({
      model: z.string().min(1).optional(),
      reasoningEffort: ReasoningEffortSchema.optional(),
      verbosity: VerbositySchema.optional(),
      maxOutputTokens: z.number().int().positive().optional()
    })
    .optional(),
  tools: z.array(z.any()).optional()
});

fastify.post('/openai/text-chat/tool-result', async (req, reply) => {
  const parsed = ChatToolResultRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return reply
      .status(400)
      .send({ error: firstIssue?.message ?? 'Invalid tool result request payload' });
  }

  const { responseId, toolResults, settings, tools } = parsed.data;

  let apiKey: string;
  try {
    apiKey = getOpenAiApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI API key not configured';
    return reply.status(500).send({ error: message });
  }

  // For the Responses API, submit tool results as a continuation with the previous response
  // Format as assistant message followed by user message with results
  const payload: Record<string, any> = {
    model: settings?.model?.trim() || 'gpt-5',
    previous_response_id: responseId,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: toolResults.map((result) => {
              try {
                const parsed = JSON.parse(result.output);
                return `Function result: ${parsed.message || JSON.stringify(parsed)}`;
              } catch {
                return `Function result: ${result.output}`;
              }
            }).join('\n\n')
          }
        ]
      }
    ]
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
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to reach OpenAI Responses API');
    return reply.status(502).send({ error: 'Failed to reach OpenAI Responses API' });
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
      'OpenAI text chat tool result request failed';
    fastify.log.error({ status: upstream.status, body: raw }, 'OpenAI text chat tool result request failed');
    return reply.status(upstream.status).send({ error: message });
  }

  // Check if response contains more tool calls
  const outputs = Array.isArray(openaiPayload?.output) ? openaiPayload.output : [];
  const toolCalls: any[] = [];
  
  for (const item of outputs) {
    if (!item || typeof item !== 'object') continue;
    
    if (item.type === 'function_call' && item.name && item.call_id) {
      toolCalls.push({
        id: item.call_id,
        type: 'function',
        function: {
          name: item.name,
          arguments: item.arguments || '{}'
        }
      });
    }
  }

  // If there are more tool calls, return them
  if (toolCalls.length > 0) {
    fastify.log.info({ toolCalls }, 'OpenAI response includes more tool calls');
    return reply.send({
      toolCalls,
      responseId: openaiPayload?.id ?? null
    });
  }

  // Otherwise, extract and return the text
  const text = extractOutputText(openaiPayload);
  if (!text) {
    fastify.log.error({ body: openaiPayload }, 'OpenAI response missing text output');
    return reply.status(502).send({ error: 'OpenAI response did not include text output' });
  }

  return reply.send({
    message: text.trim(),
    responseId: openaiPayload?.id ?? null
  });
});

fastify.post('/openai/realtime', async (req, reply) => {
  const { sdp, model } = (req.body as { sdp?: string; model?: string }) ?? {};
  if (!sdp) {
    return reply.status(400).send({ error: 'sdp is required' });
  }

  let apiKey: string;
  try {
    apiKey = getOpenAiApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI API key not configured';
    return reply.status(500).send({ error: message });
  }

  const url = new URL('https://api.openai.com/v1/realtime');
  url.searchParams.set('model', model || config.openai.realtimeModel);

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: sdp
    });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to reach OpenAI realtime API');
    return reply.status(502).send({ error: 'Failed to reach OpenAI realtime API' });
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
    fastify.log.error({ 
      status: response.status, 
      body: text,
      headers: Object.fromEntries(response.headers.entries())
    }, 'OpenAI realtime request failed');
    
    // Check for rate limiting
    if (response.status === 429) {
      fastify.log.error('🚨 RATE LIMIT EXCEEDED - OpenAI Realtime API rate limit hit');
      const retryAfter = response.headers.get('retry-after');
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');
      
      fastify.log.error({
        retryAfter,
        rateLimitRemaining,
        rateLimitReset,
        rateLimitResetDate: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : null
      }, 'Rate limit details');
      
      return reply.status(429).send({ 
        error: 'Rate limit exceeded. Please wait before making more requests.',
        retryAfter,
        rateLimitRemaining,
        rateLimitReset,
        details: errorDetails
      });
    }
    
    return reply.status(response.status).send({ error: text || 'OpenAI realtime request failed' });
  }

  return reply.send({ sdp: text });
});

fastify.get('/file-library', async () => ({ files: listStoredFiles() }));

fastify.delete('/file-library/:name', async (req, reply) => {
  const { name } = req.params as { name?: string };
  if (!name) {
    return reply.status(400).send({ error: 'File name is required' });
  }
  const safeName = path.basename(name);
  const target = path.join(FILES_DIR, safeName);
  if (!target.startsWith(FILES_DIR)) {
    return reply.status(400).send({ error: 'Invalid file path' });
  }
  if (!existsSync(target)) {
    return reply.status(404).send({ error: 'File not found' });
  }
  await rm(target, { force: true });
  return reply.send({ ok: true });
});

fastify.post('/file-library/store-image', async (req, reply) => {
  const { dataUrl, prompt, filename } = (req.body as { dataUrl?: string; prompt?: string; filename?: string }) ?? {};
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return reply.status(400).send({ error: 'Invalid image payload' });
  }
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return reply.status(400).send({ error: 'Malformed data URL' });
  }
  const [, mime, base64] = match;
  try {
    const buffer = Buffer.from(base64, 'base64');
    const ext = inferExtensionFromMime(mime, 'png') ?? 'png';
    const stored = await storeBuffer(buffer, ext, filename ?? prompt ?? 'image');
    return reply.send({ url: stored.url, filename: stored.filename });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to store generated image');
    return reply.status(500).send({ error: 'Failed to store image' });
  }
});

fastify.post('/file-library/upload', async (req, reply) => {
  try {
    const data = await req.file();
    
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    // Get the file buffer
    const buffer = await data.toBuffer();
    
    // Get original filename and extension
    const originalName = data.filename;
    const ext = path.extname(originalName).toLowerCase().replace(/^\./, '') || 'bin';
    
    // Use the original filename (without extension) as hint for storage
    const hint = path.basename(originalName, path.extname(originalName));
    
    // Store the file
    const stored = await storeBuffer(buffer, ext, hint);
    
    fastify.log.info({
      originalName,
      storedName: stored.filename,
      size: buffer.length,
      extension: ext
    }, 'File uploaded successfully');
    
    return reply.send({
      success: true,
      url: stored.url,
      filename: stored.filename,
      size: buffer.length
    });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to upload file');
    return reply.status(500).send({ error: 'Failed to upload file' });
  }
});

const ImageGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  settings: z
    .object({
      model: z.string().optional(),
      size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
      quality: z.enum(['low', 'medium', 'high', 'auto', 'standard', 'hd']).optional(),
      partialImages: z.number().int().min(0).max(3).optional()
    })
    .optional()
});

fastify.post('/openai/generate-image', async (req, reply) => {
  const parsed = ImageGenerationRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return reply
      .status(400)
      .send({ error: firstIssue?.message ?? 'Invalid image generation request' });
  }

  const { prompt, settings } = parsed.data;

  let apiKey: string;
  try {
    apiKey = getOpenAiApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI API key not configured';
    return reply.status(500).send({ error: message });
  }

  const model = settings?.model?.trim() || 'gpt-image-1';
  const size = settings?.size || '1024x1024';
  const quality = settings?.quality || 'auto';
  const partialImages = settings?.partialImages ?? 2;

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    fastify.log.info({ model, size, quality, partialImages, prompt: prompt.substring(0, 50) }, 'Starting image generation');

    // Use REST API directly for better control over streaming
    const requestPayload: any = {
      model,
      prompt,
      size
    };

    // Handle different model requirements
    const isGptImage = model === 'gpt-image-1';
    const isDalle = model === 'dall-e-2' || model === 'dall-e-3';
    
    if (isGptImage && partialImages > 0) {
      // gpt-image-1 with streaming
      requestPayload.stream = true;
      requestPayload.partial_images = partialImages;
      // gpt-image-1 supports auto, low, medium, high for quality
      if (quality && quality !== 'auto') {
        requestPayload.quality = quality;
      }
    } else if (isGptImage) {
      // gpt-image-1 without streaming - no response_format needed
      // Quality mapping for gpt-image-1
      if (quality === 'hd') {
        requestPayload.quality = 'high';
      } else if (quality === 'standard') {
        requestPayload.quality = 'medium';
      }
    } else if (isDalle) {
      // DALL-E models require response_format
      requestPayload.response_format = 'b64_json';
      
      // DALL-E only supports 'standard' or 'hd'
      if (quality === 'hd') {
        requestPayload.quality = 'hd';
      } else {
        requestPayload.quality = 'standard';
      }
    }

    fastify.log.info({ requestPayload }, 'Sending request to OpenAI');

    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      fastify.log.error({ status: upstream.status, body: errorText }, 'OpenAI request failed');
      
      // Parse error to provide helpful messages
      let errorMessage = `OpenAI API error: ${errorText}`;
      let errorType = 'api_error';
      
      try {
        const errorData = JSON.parse(errorText);
        const message = errorData.error?.message || '';
        
        // Check for verification requirement
        if (message.includes('organization must be verified') || message.includes('Verify Organization')) {
          errorType = 'verification_required';
          errorMessage = message;
        } else {
          errorMessage = message || errorText;
        }
      } catch {
        // Keep original error message if parsing fails
      }
      
      reply.raw.write(`data: ${JSON.stringify({
        type: 'error',
        errorType,
        error: errorMessage
      })}\n\n`);
      reply.raw.end();
      return;
    }

    // Check if streaming response
    const contentType = upstream.headers.get('content-type') || '';
    const isStreaming = contentType.includes('text/event-stream') || requestPayload.stream;

    fastify.log.info({ contentType, isStreaming }, 'Response received');

    if (isStreaming && upstream.body) {
      // Handle streaming response
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            eventCount++;
            fastify.log.info({ eventCount, eventType: event.type, eventKeys: Object.keys(event) }, 'Stream event');

            // Partial image
            if (event.type === 'image_generation.partial_image' || (event.partial_image_index !== undefined)) {
              fastify.log.info({ index: event.partial_image_index, hasB64: !!event.b64_json, hasUrl: !!event.url }, 'Partial image');
              
              // Get image data - could be base64 or URL
              let imageData = event.b64_json;
              if (!imageData && event.url) {
                // If URL provided, fetch and convert to base64
                try {
                  const imgResponse = await fetch(event.url);
                  const buffer = await imgResponse.arrayBuffer();
                  imageData = Buffer.from(buffer).toString('base64');
                } catch (err) {
                  fastify.log.error({ err }, 'Failed to fetch image URL');
                }
              }
              
              if (imageData) {
                reply.raw.write(`data: ${JSON.stringify({
                  type: 'partial_image',
                  index: event.partial_image_index || 0,
                  image: imageData,
                  revised_prompt: event.revised_prompt
                })}\n\n`);
              }
            }
            
            // Final image
            else if (event.type === 'image_generation.complete' || event.data) {
              const imageData = event.data?.[0] || event;
              fastify.log.info({ hasB64: !!imageData.b64_json, hasUrl: !!imageData.url }, 'Final image');
              
              let finalImageData = imageData.b64_json;
              if (!finalImageData && imageData.url) {
                // If URL provided, fetch and convert to base64
                try {
                  const imgResponse = await fetch(imageData.url);
                  const buffer = await imgResponse.arrayBuffer();
                  finalImageData = Buffer.from(buffer).toString('base64');
                } catch (err) {
                  fastify.log.error({ err }, 'Failed to fetch final image URL');
                }
              }
              
              if (finalImageData) {
                fastify.log.info('Final image ready to send');
                reply.raw.write(`data: ${JSON.stringify({
                  type: 'final_image',
                  image: finalImageData,
                  revised_prompt: imageData.revised_prompt || event.revised_prompt
                })}\n\n`);
              }
            }
          } catch (parseError) {
            fastify.log.warn({ line, parseError }, 'Failed to parse SSE line');
          }
        }
      }

      fastify.log.info({ eventCount }, 'Stream complete');
      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } else {
      // Handle non-streaming response
      const responseData = await upstream.json();
      fastify.log.info({ responseKeys: Object.keys(responseData) }, 'Non-streaming response received');
      
      if (responseData.data && responseData.data[0]) {
        const imageData = responseData.data[0];
        fastify.log.info({ 
          hasB64: !!imageData.b64_json, 
          hasUrl: !!imageData.url,
          b64Length: imageData.b64_json?.length,
          revisedPrompt: !!imageData.revised_prompt
        }, 'Image data structure');
        
        let finalImage = imageData.b64_json;
        if (!finalImage && imageData.url) {
          // Fetch URL and convert to base64
          fastify.log.info({ url: imageData.url }, 'Fetching image from URL');
          try {
            const imgResponse = await fetch(imageData.url);
            const buffer = await imgResponse.arrayBuffer();
            finalImage = Buffer.from(buffer).toString('base64');
            fastify.log.info({ b64Length: finalImage.length }, 'Converted URL to base64');
          } catch (err) {
            fastify.log.error({ err }, 'Failed to fetch non-streaming image URL');
            throw new Error('Failed to fetch image from URL');
          }
        }
        
        if (finalImage) {
          const payload = {
            type: 'final_image',
            image: finalImage,
            revised_prompt: imageData.revised_prompt
          };
          fastify.log.info({ imageLength: finalImage.length, hasRevisedPrompt: !!imageData.revised_prompt }, 'Sending final image to client');
          reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          fastify.log.info('Sent done event');
        } else {
          fastify.log.error({ imageData }, 'No image data (b64_json or url) in response');
          throw new Error('No image data (b64_json or url) in response');
        }
      } else {
        fastify.log.error({ responseData }, 'No image data in response');
        throw new Error('No image data in response');
      }
    }
    
  } catch (error) {
    fastify.log.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error in image generation');
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Image generation failed'
    })}\n\n`);
  } finally {
    reply.raw.end();
  }
});

// Vision Analysis Endpoint
const VisionRequestSchema = z.object({
  imageUrl: z.string(),
  prompt: z.string().optional()
});

fastify.post('/openai/vision', async (req, reply) => {
  const parsed = VisionRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return reply
      .status(400)
      .send({ error: firstIssue?.message ?? 'Invalid vision analysis request' });
  }

  const { imageUrl, prompt } = parsed.data;

  let apiKey: string;
  try {
    apiKey = getOpenAiApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI API key not configured';
    return reply.status(500).send({ error: message });
  }

  try {
    fastify.log.info({ imageUrl, prompt }, 'Analyzing image with Vision AI');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'What do you see in this image? Describe it in detail.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      fastify.log.error({ status: response.status, body: errorText }, 'Vision API request failed');
      return reply.status(response.status).send({ error: errorText });
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || 'Unable to analyze image';

    fastify.log.info({ description }, 'Vision analysis complete');
    
    return reply.send({
      description,
      imageUrl
    });
  } catch (error) {
    fastify.log.error({ error }, 'Error in vision analysis');
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Vision analysis failed'
    });
  }
});

// List all images
fastify.get('/images', async (req, reply) => {
  try {
    const files = readdirSync(FILES_DIR);
    const images = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(filename => {
        const filePath = path.join(FILES_DIR, filename);
        const stats = statSync(filePath);
        
        // Parse filename: timestamp-deviceId-tag.ext
        const parts = filename.split('-');
        const timestamp = parts[0] ? parseInt(parts[0], 10) : stats.birthtimeMs;
        const deviceId = parts[1] || 'unknown';
        const tagWithExt = parts.slice(2).join('-');
        const tag = tagWithExt ? path.basename(tagWithExt, path.extname(tagWithExt)) : 'default';
        
        return {
          id: filename,
          filename,
          url: `/files/${filename}`,
          tag,
          deviceId,
          ts: timestamp || stats.birthtimeMs,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.ts - a.ts); // Most recent first
    
    return reply.send({ images });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to list images');
    return reply.status(500).send({ error: 'Failed to list images' });
  }
});

fastify.post('/images/upload', async (req, reply) => {
  const mp: any = await (req as any).file();
  if (!mp) {
    return reply.status(400).send({ error: 'No file uploaded' });
  }

  const tag = ((req.query as any)?.tag as string) || 'default';
  const deviceId = ((req.query as any)?.deviceId as string) || 'unknown';
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
  outputFormat?: 'glb' | 'obj' | 'usdz';
};

type CreateModelBody = {
  mode: ModelJob['source'];
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
    textures: incoming.textures ?? current.textures
  } satisfies ModelJobOutputs;
}

function updateJob(id: string, patch: Partial<ModelJob>) {
  const existing = jobs.get(id);
  if (!existing) return;
  const next: ModelJob = {
    ...existing,
    ...patch,
    outputs: mergeOutputs(existing.outputs, patch.outputs),
    metadata: patch.metadata ? { ...existing.metadata, ...patch.metadata } : existing.metadata,
    updatedAt: Date.now()
  };
  jobs.set(id, next);
}

function extractOutputText(payload: any): string | null {
  if (!payload) {
    return null;
  }

  const direct = payload.output_text;
  if (typeof direct === 'string' && direct.trim()) {
    return direct;
  }
  if (Array.isArray(direct)) {
    const combined = direct.filter((value: any) => typeof value === 'string').join('\n').trim();
    if (combined) {
      return combined;
    }
  }

  const outputs = Array.isArray(payload.output) ? payload.output : [];
  for (const item of outputs) {
    if (!item || typeof item !== 'object') continue;
    if (typeof (item as any).text === 'string' && (item as any).text.trim()) {
      return (item as any).text;
    }
    const content = Array.isArray((item as any).content) ? (item as any).content : [];
    for (const entry of content) {
      if (!entry || typeof entry !== 'object') continue;
      const text = typeof entry.text === 'string' ? entry.text : undefined;
      if (text && text.trim()) {
        return text;
      }
    }
  }

  return null;
}

function getMeshyApiKey() {
  const secrets = readSecrets();
  const key = secrets.meshy || process.env.MESHY_API_KEY || '';
  if (!key) {
    throw new Error('Missing Meshy API key. Configure one from the Settings page.');
  }
  return key;
}

function getOpenAiApiKey() {
  const secrets = readSecrets();
  const key = secrets.openai || process.env.OPENAI_API_KEY || '';
  if (!key) {
    throw new Error('Missing OpenAI API key. Configure one from the Settings page.');
  }
  return key;
}

function sanitizePayload<T extends Record<string, any>>(payload: T) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null));
}

function normalizeSettings(settings?: MeshySettings): Required<MeshySettings> {
  return {
    aiModel: settings?.aiModel ?? 'latest',
    topology: settings?.topology ?? 'triangle',
    targetPolycount: settings?.targetPolycount ?? 30000,
    shouldTexture: settings?.shouldTexture ?? true,
    shouldRemesh: settings?.shouldRemesh ?? true,
    enablePbr: settings?.enablePbr ?? false,
    symmetryMode: settings?.symmetryMode ?? 'auto',
    artStyle: settings?.artStyle ?? 'realistic',
    outputFormat: settings?.outputFormat ?? 'glb'
  } satisfies Required<MeshySettings>;
}

async function resolveCaptureDataUri(tag?: string) {
  const directories = [FILES_DIR, DATA_DIR];
  const files = directories
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => /\.(png|jpg|jpeg)$/i.test(file))
        .map((file) => ({ file, dir }))
    )
    .filter((entry, index, arr) => arr.findIndex((item) => item.file === entry.file && item.dir === entry.dir) === index);
  if (!files.length) {
    throw new Error('No captures available for model generation.');
  }
  const candidates = tag
    ? files.filter((entry) => entry.file.includes(tag))
    : files;
  if (!candidates.length) {
    throw new Error('No captures available for model generation.');
  }
  const latest = candidates
    .map(({ file, dir }) => ({
      file,
      fullPath: path.join(dir, file),
      mtime: statSync(path.join(dir, file)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  const buffer = await readFile(latest.fullPath);
  const ext = path.extname(latest.file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function pollMeshyTask<T>(url: string, apiKey: string, onProgress?: (payload: any) => void): Promise<T> {
  const startTime = Date.now();
  const maxDuration = 35 * 60 * 1000; // 35 minutes (slightly longer than client timeout)
  
  while (true) {
    // Check if we've exceeded the timeout
    if (Date.now() - startTime > maxDuration) {
      throw new Error('Meshy task polling timed out after 35 minutes');
    }
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meshy API poll failed (${response.status}): ${body}`);
    }
    const payload = (await response.json()) as any;
    onProgress?.(payload);
    if (payload.status === 'SUCCEEDED') {
      return payload as T;
    }
    if (payload.status === 'FAILED' || payload.status === 'CANCELED') {
      const message = payload?.task_error?.message || 'Meshy task failed';
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

async function runImageJob(id: string, body: CreateModelBody, apiKey: string) {
  const settings = normalizeSettings(body.settings);
  const imageData = body.mode === 'capture' ? await resolveCaptureDataUri(body.captureTag) : body.imageData;
  if (!imageData) {
    throw new Error('No image provided for Meshy Image to 3D.');
  }

  updateJob(id, { status: 'running', progress: 5 });

  fastify.log.info(
    {
      jobId: id,
      mode: body.mode,
      captureTag: body.captureTag,
      settings
    },
    'Submitting Meshy image-to-3d request'
  );

  const createResponse = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
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
        symmetry_mode: settings.symmetryMode
      })
    )
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    fastify.log.error({ jobId: id, status: createResponse.status, body: text }, 'Meshy image-to-3d create failed');
    throw new Error(`Meshy image-to-3d create failed (${createResponse.status}): ${text}`);
  }

  const { result: taskId } = (await createResponse.json()) as { result: string };
  fastify.log.info({ jobId: id, taskId }, 'Meshy image-to-3d task created');
  updateJob(id, { metadata: { previewTaskId: taskId } });

  const finalTask = await pollMeshyTask<any>(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, apiKey, (payload) => {
    if (typeof payload?.progress === 'number') {
      updateJob(id, { progress: Math.max(10, Math.min(95, payload.progress)) });
    }
  });

  fastify.log.info({ jobId: id }, 'Meshy image-to-3d task succeeded');

  const outputs = extractOutputs(finalTask);
  const persisted = await persistModelOutputs(id, outputs, body.prompt ?? body.captureTag ?? body.mode, settings.outputFormat);

  updateJob(id, {
    status: 'done',
    progress: 100,
    outputs: persisted ?? outputs
  });
}

async function runTextJob(id: string, body: CreateModelBody, apiKey: string) {
  if (!body.prompt) {
    throw new Error('Text prompt is required for Text to 3D.');
  }
  const settings = normalizeSettings(body.settings);
  fastify.log.info(
    {
      jobId: id,
      promptLength: body.prompt.length,
      texturePromptLength: body.texturePrompt?.length ?? 0,
      settings
    },
    'Submitting Meshy text-to-3d preview request'
  );
  updateJob(id, {
    status: 'running',
    progress: 5,
    metadata: { prompt: body.prompt, texturePrompt: body.texturePrompt }
  });

  const previewResponse = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      sanitizePayload({
        mode: 'preview',
        prompt: body.prompt,
        art_style: settings.artStyle,
        ai_model: settings.aiModel,
        topology: settings.topology,
        target_polycount: settings.targetPolycount,
        should_remesh: settings.shouldRemesh,
        symmetry_mode: settings.symmetryMode
      })
    )
  });

  if (!previewResponse.ok) {
    const text = await previewResponse.text();
    fastify.log.error({ jobId: id, status: previewResponse.status, body: text }, 'Meshy text-to-3d preview failed');
    throw new Error(`Meshy text-to-3d preview failed (${previewResponse.status}): ${text}`);
  }

  const { result: previewTaskId } = (await previewResponse.json()) as { result: string };
  fastify.log.info({ jobId: id, previewTaskId }, 'Meshy text-to-3d preview task created');
  updateJob(id, { metadata: { previewTaskId } });

  const previewTask = await pollMeshyTask<any>(`https://api.meshy.ai/openapi/v2/text-to-3d/${previewTaskId}`, apiKey, (payload) => {
    if (typeof payload?.progress === 'number') {
      const scaled = Math.min(80, Math.max(10, Math.round((payload.progress / 100) * 80)));
      updateJob(id, { progress: scaled });
    }
  });

  if (settings.shouldTexture === false) {
    const outputs = extractOutputs(previewTask);
    const persisted = await persistModelOutputs(id, outputs, body.prompt, settings.outputFormat);
    updateJob(id, {
      status: 'done',
      progress: 100,
      outputs: persisted ?? outputs
    });
    return;
  }

  const refinePayload = sanitizePayload({
    mode: 'refine',
    preview_task_id: previewTaskId,
    enable_pbr: settings.artStyle === 'sculpture' ? false : settings.enablePbr,
    texture_prompt: body.texturePrompt,
    ai_model: settings.aiModel === 'latest' ? undefined : settings.aiModel
  });

  const refineResponse = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(refinePayload)
  });

  if (!refineResponse.ok) {
    const text = await refineResponse.text();
    fastify.log.error({ jobId: id, status: refineResponse.status, body: text }, 'Meshy text-to-3d refine failed');
    throw new Error(`Meshy text-to-3d refine failed (${refineResponse.status}): ${text}`);
  }

  const { result: refineTaskId } = (await refineResponse.json()) as { result: string };
  fastify.log.info({ jobId: id, refineTaskId }, 'Meshy text-to-3d refine task created');
  updateJob(id, { metadata: { refineTaskId } });

  const finalTask = await pollMeshyTask<any>(`https://api.meshy.ai/openapi/v2/text-to-3d/${refineTaskId}`, apiKey, (payload) => {
    if (typeof payload?.progress === 'number') {
      const scaled = Math.min(100, Math.max(80, Math.round(80 + (payload.progress / 100) * 20)));
      updateJob(id, { progress: scaled });
    }
  });

  fastify.log.info({ jobId: id }, 'Meshy text-to-3d task succeeded');

  const outputs = extractOutputs(finalTask);
  const persisted = await persistModelOutputs(id, outputs, body.prompt, settings.outputFormat);

  updateJob(id, {
    status: 'done',
    progress: 100,
    outputs: persisted ?? outputs
  });
}

async function processModelJob(id: string, body: CreateModelBody) {
  try {
    const apiKey = getMeshyApiKey();
    fastify.log.info({ jobId: id, mode: body.mode }, 'Processing Meshy job');
    if (body.mode === 'text') {
      await runTextJob(id, body, apiKey);
    } else {
      await runImageJob(id, body, apiKey);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Meshy error';
    fastify.log.error(
      {
        jobId: id,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
      },
      'Meshy job failed'
    );
    updateJob(id, { status: 'error', error: message });
  }
}

fastify.post('/models/create', async (req, reply) => {
  const body = (req.body as CreateModelBody) ?? ({} as CreateModelBody);
  if (!body.mode) {
    return reply.status(400).send({ error: 'mode is required' });
  }

  fastify.log.info(
    {
      mode: body.mode,
      hasImageData: Boolean(body.imageData),
      captureTag: body.captureTag,
      promptLength: body.prompt?.length ?? 0,
      texturePromptLength: body.texturePrompt?.length ?? 0
    },
    'Received request to create Meshy model job'
  );

  try {
    getMeshyApiKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Missing Meshy API key';
    return reply.status(500).send({ error: message });
  }

  const id = Math.random().toString(36).slice(2);
  const now = Date.now();
  const job: ModelJob = {
    id,
    source: body.mode,
    status: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now
  };
  jobs.set(id, job);

  fastify.log.info({ jobId: id, mode: body.mode }, 'Queued Meshy model job');

  processModelJob(id, body);

  return { id };
});

fastify.get('/models/:id', async (req, reply) => {
  const job = jobs.get((req.params as any).id);
  if (!job) {
    return reply.status(404).send({ error: 'not found' });
  }
  return job;
});

type CameraDirectoryInfo = {
  cameraId: string;
  friendlyName: string;
  lastSeenTs: number;
  latestFrameBase64?: string;
  latestFrameTs?: number;
};

const CAMERA_TTL_MS = 120_000; // 2 minutes - generous timeout for long-running cameras

const cameraDirectory = new Map<string, CameraDirectoryInfo>();

const cameras = io.of('/cameras');

function emitCameraList() {
  cameras.emit('cameras:list', { cameras: Array.from(cameraDirectory.values()) });
}

function removeCamera(cameraId: string) {
  if (!cameraDirectory.has(cameraId)) return;
  cameraDirectory.delete(cameraId);
  cameras.emit('camera:left', { cameraId });
  emitCameraList();
}

cameras.on('connection', (socket) => {
  socket.emit('cameras:list', { cameras: Array.from(cameraDirectory.values()) });

  socket.on('cameras:requestList', () => {
    socket.emit('cameras:list', { cameras: Array.from(cameraDirectory.values()) });
  });

  socket.on('register', (info) => {
    socket.data.info = info;
    if (info?.deviceId) {
      socket.join('camera.clients');
    }
  });

  socket.on('camera:announce', ({ cameraId, friendlyName }: { cameraId: string; friendlyName?: string }) => {
    if (!cameraId) return;
    const name = friendlyName?.trim() || cameraId;
    const info: CameraDirectoryInfo = {
      cameraId,
      friendlyName: name,
      lastSeenTs: Date.now(),
      latestFrameBase64: cameraDirectory.get(cameraId)?.latestFrameBase64,
      latestFrameTs: cameraDirectory.get(cameraId)?.latestFrameTs
    };
    cameraDirectory.set(cameraId, info);
    socket.data.cameraId = cameraId;
    socket.join('camera.clients');
    cameras.emit('camera:joined', { cameraId: info.cameraId, friendlyName: info.friendlyName, lastSeenTs: info.lastSeenTs });
    emitCameraList();
  });

  socket.on('camera:frame', ({ cameraId, ts, jpegBase64 }: { cameraId: string; ts?: number; jpegBase64: string }) => {
    if (!cameraId || !jpegBase64) return;
    const entry = cameraDirectory.get(cameraId);
    if (!entry) return;
    entry.lastSeenTs = Date.now();
    entry.latestFrameBase64 = jpegBase64;
    entry.latestFrameTs = ts ?? Date.now();
    cameras.to(`camera:${cameraId}`).emit('security:frame', { cameraId, ts: entry.latestFrameTs, jpegBase64 });
  });

  socket.on('camera:heartbeat', ({ cameraId }: { cameraId: string }) => {
    if (!cameraId) return;
    const entry = cameraDirectory.get(cameraId);
    if (!entry) return;
    entry.lastSeenTs = Date.now();
  });

  socket.on('camera:bye', ({ cameraId }: { cameraId: string }) => {
    if (!cameraId) return;
    removeCamera(cameraId);
  });

  socket.on('join', ({ room, role }: { room: string; role?: string }) => {
    if (!room) return;
    socket.join(room);
    socket.data.rtcRoom = room;
    socket.data.rtcRole = role;
    fastify.log.info({ room, role }, 'RTC client joined');
  });

  socket.on('leave', ({ room }: { room: string }) => {
    if (!room) return;
    socket.leave(room);
    if (socket.data.rtcRoom === room) {
      socket.data.rtcRoom = undefined;
      socket.data.rtcRole = undefined;
    }
  });

  socket.on('viewer-offer', ({ room, sdp }: { room: string; sdp: any }) => {
    if (!room || !sdp) return;
    socket.to(room).emit('viewer-offer', { room, sdp });
  });

  socket.on('publisher-answer', ({ room, sdp }: { room: string; sdp: any }) => {
    if (!room || !sdp) return;
    socket.to(room).emit('publisher-answer', { room, sdp });
  });

  socket.on('ice', ({ room, candidate }: { room: string; candidate: any }) => {
    if (!room) return;
    socket.to(room).emit('ice', { room, candidate: candidate ?? null });
  });

  socket.on('security:subscribe', ({ cameraId }: { cameraId: string }) => {
    if (!cameraId) return;
    socket.join(`camera:${cameraId}`);
    const info = cameraDirectory.get(cameraId);
    if (info?.latestFrameBase64) {
      socket.emit('security:frame', {
        cameraId: info.cameraId,
        ts: info.latestFrameTs ?? Date.now(),
        jpegBase64: info.latestFrameBase64
      });
    }
  });

  socket.on('security:unsubscribe', ({ cameraId }: { cameraId: string }) => {
    if (!cameraId) return;
    socket.leave(`camera:${cameraId}`);
  });

  socket.on('scan:trigger', () => {
    // Broadcast scan trigger to all connected clients
    cameras.emit('scan:trigger');
  });

  socket.on('disconnect', () => {
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
  cameras.to('camera.clients').emit('capture', args);
}

fastify.post('/tools/invoke', async (req, reply) => {
  const { name, args } = (req.body as any) ?? {};
  if (name === 'cameras.captureAll') {
    broadcastCapture(args ?? {});
    return { ok: true };
  }
  if (name === 'ui.navigate') {
    io.emit('ui:navigate', args ?? {});
    return { ok: true };
  }
  if (name === 'models.createFromContext') {
    const { contextTag } = args ?? {};
    const res = await fastify.inject({
      method: 'POST',
      url: '/models/create',
      payload: { images: [], prompt: `Create mesh from ${contextTag ?? 'latest'}` }
    });
    return res.json();
  }
  return reply.status(404).send({ error: 'tool not found' });
});

const PORT = Number(process.env.PORT || 1234);
const hostEnv = process.env.BIND_ADDR ?? process.env.HOST;
const HOST = hostEnv?.trim() || '0.0.0.0';
const publicHostEnv = process.env.PUBLIC_HOST ?? process.env.SERVER_PUBLIC_HOST;
const PUBLIC_HOST =
  publicHostEnv?.trim() || (HOST === '0.0.0.0' ? process.env.HOSTNAME || 'localhost' : HOST);

fastify
  .listen({ port: PORT, host: HOST })
  .then(() => {
    const protocol = hasCertificates ? 'https' : 'http';
    const displayHost = PUBLIC_HOST || (HOST === '0.0.0.0' ? 'localhost' : HOST);
    if (hasCertificates) {
      fastify.log.warn(`HTTPS & Socket.IO up on ${protocol}://${displayHost}:${PORT}`);
    } else {
      fastify.log.warn(`HTTP & Socket.IO up on ${protocol}://${displayHost}:${PORT}`);
    }
  })
  .catch((err) => {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  });
