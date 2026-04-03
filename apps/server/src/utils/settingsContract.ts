/**
 * Settings Contract Validation
 *
 * Server-side contract guard ensuring settings payloads returned from the API
 * are always valid and normalizable. This prevents client-side crashes from
 * corrupted/partial settings stored on disk.
 *
 * Contract guarantees:
 * - GET /settings always returns a valid, normalized AppSettings object
 * - Missing keys are filled with safe defaults
 * - Corrupted files fall back to defaults (no 500 errors)
 */

import { z } from "zod";
import { logger } from "./logger.js";

// ============================================================================
// Zod Schemas (Partial - allows missing keys from disk)
// ============================================================================

// Integration schemas - all fields optional to allow partial storage
const WeatherConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.literal("openweather").optional(),
    defaultLocation: z.string().optional(),
  })
  .passthrough()
  .optional();

const WebSearchConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    baseUrl: z.string().nullable().optional(),
    apiKey: z.string().nullable().optional(),
    defaultRegion: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const LocalLLMConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(["ollama", "custom-http"]).optional(),
    baseUrl: z.string().nullable().optional(),
    apiKey: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    temperature: z.number().nullable().optional(),
    maxTokens: z.number().nullable().optional(),
  })
  .passthrough()
  .optional();

const ElevenLabsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    apiKey: z.string().nullable().optional(),
    voiceId: z.string().nullable().optional(),
    modelId: z.string().nullable().optional(),
    stability: z.number().nullable().optional(),
    similarityBoost: z.number().nullable().optional(),
    style: z.number().nullable().optional(),
  })
  .passthrough()
  .optional();

const AzureTTSConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    apiKey: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    voiceName: z.string().nullable().optional(),
    style: z.string().nullable().optional(),
    rate: z.string().nullable().optional(),
    pitch: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const SpotifyConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    clientId: z.string().nullable().optional(),
    clientSecret: z.string().nullable().optional(),
    defaultMarket: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const GmailConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    clientId: z.string().nullable().optional(),
    clientSecret: z.string().nullable().optional(),
    redirectUri: z.string().nullable().optional(),
    refreshToken: z.string().nullable().optional(),
    userEmail: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const GoogleCalendarConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    clientId: z.string().nullable().optional(),
    clientSecret: z.string().nullable().optional(),
    redirectUri: z.string().nullable().optional(),
    refreshToken: z.string().nullable().optional(),
    calendarId: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const AlexaConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    clientId: z.string().nullable().optional(),
    clientSecret: z.string().nullable().optional(),
    refreshToken: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const IRobotConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    username: z.string().nullable().optional(),
    password: z.string().nullable().optional(),
    robotId: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const NestConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    projectId: z.string().nullable().optional(),
    clientId: z.string().nullable().optional(),
    clientSecret: z.string().nullable().optional(),
    refreshToken: z.string().nullable().optional(),
    deviceId: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const SmartLightsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(["hue", "lifx", "generic"]).optional(),
    apiKey: z.string().nullable().optional(),
    bridgeIp: z.string().nullable().optional(),
  })
  .passthrough()
  .optional();

const IntegrationsSchema = z
  .object({
    weather: WeatherConfigSchema,
    webSearch: WebSearchConfigSchema,
    localLLM: LocalLLMConfigSchema,
    elevenLabs: ElevenLabsConfigSchema,
    azureTTS: AzureTTSConfigSchema,
    spotify: SpotifyConfigSchema,
    gmail: GmailConfigSchema,
    googleCalendar: GoogleCalendarConfigSchema,
    alexa: AlexaConfigSchema,
    irobot: IRobotConfigSchema,
    nest: NestConfigSchema,
    smartLights: SmartLightsConfigSchema,
  })
  .passthrough()
  .optional();

// Main settings schema - all fields optional to allow partial storage
export const RawSettingsSchema = z
  .object({
    jarvis: z
      .object({
        apiKey: z.string().optional(),
        model: z.string().optional(),
        voice: z.string().optional(),
        initialPrompt: z.string().optional(),
        hotword: z.string().optional(),
        imageDetail: z.enum(["low", "high", "auto"]).optional(),
      })
      .passthrough()
      .optional(),

    models: z
      .object({
        aiModel: z.string().optional(),
        topology: z.enum(["triangle", "quad"]).optional(),
        targetPolycount: z.number().optional(),
        shouldRemesh: z.boolean().optional(),
        shouldTexture: z.boolean().optional(),
        enablePbr: z.boolean().optional(),
        symmetryMode: z.enum(["off", "auto", "on"]).optional(),
        artStyle: z.enum(["realistic", "sculpture"]).optional(),
        outputFormat: z.enum(["glb", "obj", "usdz"]).optional(),
      })
      .passthrough()
      .optional(),

    textChat: z
      .object({
        model: z.string().optional(),
        initialPrompt: z.string().optional(),
        reasoningEffort: z
          .enum(["minimal", "low", "medium", "high"])
          .optional(),
        verbosity: z.enum(["low", "medium", "high"]).optional(),
        maxOutputTokens: z.number().optional(),
        useWebSearch: z.boolean().optional(),
        useLocalLlm: z.boolean().optional(),
        localLlmPrimary: z.boolean().optional(),
        ttsProvider: z.enum(["none", "elevenlabs", "azure"]).optional(),
      })
      .passthrough()
      .optional(),

    imageGeneration: z
      .object({
        model: z.string().optional(),
        size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
        quality: z
          .enum(["standard", "hd", "low", "medium", "high", "auto"])
          .optional(),
        partialImages: z
          .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
          .optional(),
      })
      .passthrough()
      .optional(),

    integrations: IntegrationsSchema,

    avatar: z
      .object({
        selectedAvatar: z.string().optional(),
        avatarsDir: z.string().optional(),
        vcamEnabled: z.boolean().optional(),
      })
      .passthrough()
      .optional(),

    notificationPreferences: z
      .object({
        calendar_reminder: z.boolean().optional(),
        email_notification: z.boolean().optional(),
        printer_alert: z.boolean().optional(),
        camera_alert: z.boolean().optional(),
        system_update: z.boolean().optional(),
        integration_error: z.boolean().optional(),
        custom: z.boolean().optional(),
      })
      .passthrough()
      .optional(),

    useServerProxy: z.boolean().optional(),
    cameras: z.array(z.any()).optional(),
    lockdownState: z
      .object({
        active: z.boolean().optional(),
        activatedAt: z.string().nullable().optional(),
        activatedBy: z.string().nullable().optional(),
        features: z
          .object({
            doorsLocked: z.boolean().optional(),
            alarmArmed: z.boolean().optional(),
            camerasSecured: z.boolean().optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type RawSettings = z.infer<typeof RawSettingsSchema>;

// ============================================================================
// Default Settings (Server-side copy to avoid client dependencies)
// ============================================================================

const defaultIntegrations = {
  weather: {
    enabled: false,
    provider: "openweather" as const,
    defaultLocation: "Miami,US",
  },
  webSearch: {
    enabled: false,
    baseUrl: null,
    apiKey: null,
    defaultRegion: null,
  },
  localLLM: {
    enabled: false,
    provider: "ollama" as const,
    baseUrl: "http://localhost:11434",
    apiKey: null,
    model: "llama3.1",
    temperature: 0.7,
    maxTokens: null,
  },
  elevenLabs: {
    enabled: false,
    apiKey: null,
    voiceId: null,
    modelId: "eleven_multilingual_v2",
    stability: null,
    similarityBoost: null,
    style: null,
  },
  azureTTS: {
    enabled: false,
    apiKey: null,
    region: "eastus",
    voiceName: "en-US-JennyNeural",
    style: null,
    rate: null,
    pitch: null,
  },
  spotify: {
    enabled: false,
    clientId: null,
    clientSecret: null,
    defaultMarket: "US",
  },
  gmail: {
    enabled: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    refreshToken: null,
    userEmail: null,
  },
  googleCalendar: {
    enabled: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    refreshToken: null,
    calendarId: "primary",
  },
  alexa: {
    enabled: false,
    clientId: null,
    clientSecret: null,
    refreshToken: null,
    region: "NA",
  },
  irobot: { enabled: false, username: null, password: null, robotId: null },
  nest: {
    enabled: false,
    projectId: null,
    clientId: null,
    clientSecret: null,
    refreshToken: null,
    deviceId: null,
  },
  smartLights: {
    enabled: false,
    provider: "hue" as const,
    apiKey: null,
    bridgeIp: null,
  },
};

const defaultSettings = {
  jarvis: {
    model: "gpt-realtime-mini",
    voice: "echo",
    initialPrompt:
      "You are AKIOR (Advanced Knowledge & Intelligence Operating Resource), a sophisticated AI assistant.",
    hotword: "akior",
    imageDetail: "low" as const,
  },
  models: {
    aiModel: "latest",
    topology: "triangle" as const,
    targetPolycount: 30000,
    shouldRemesh: true,
    shouldTexture: true,
    enablePbr: false,
    symmetryMode: "auto" as const,
    artStyle: "realistic" as const,
    outputFormat: "glb" as const,
  },
  textChat: {
    model: "gpt-5",
    initialPrompt: "",
    reasoningEffort: "low" as const,
    verbosity: "medium" as const,
    maxOutputTokens: 800,
    useWebSearch: false,
    useLocalLlm: false,
    localLlmPrimary: false,
    ttsProvider: "elevenlabs" as const,
  },
  imageGeneration: {
    model: "dall-e-3",
    size: "1024x1024" as const,
    quality: "standard" as const,
    partialImages: 0 as const,
  },
  integrations: defaultIntegrations,
  notificationPreferences: {
    calendar_reminder: true,
    email_notification: true,
    printer_alert: true,
    camera_alert: true,
    system_update: true,
    integration_error: true,
    custom: true,
  },
  useServerProxy: true,
  cameras: [] as any[],
  lockdownState: {
    active: false,
    activatedAt: null,
    activatedBy: null,
    features: {
      doorsLocked: false,
      alarmArmed: false,
      camerasSecured: false,
    },
  },
};

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Deep-merge integration settings with defaults
 */
function normalizeIntegrations(input: any): typeof defaultIntegrations {
  if (!input || typeof input !== "object") {
    return { ...defaultIntegrations };
  }

  return {
    weather: { ...defaultIntegrations.weather, ...(input.weather ?? {}) },
    webSearch: { ...defaultIntegrations.webSearch, ...(input.webSearch ?? {}) },
    localLLM: { ...defaultIntegrations.localLLM, ...(input.localLLM ?? {}) },
    elevenLabs: {
      ...defaultIntegrations.elevenLabs,
      ...(input.elevenLabs ?? {}),
    },
    azureTTS: { ...defaultIntegrations.azureTTS, ...(input.azureTTS ?? {}) },
    spotify: { ...defaultIntegrations.spotify, ...(input.spotify ?? {}) },
    gmail: { ...defaultIntegrations.gmail, ...(input.gmail ?? {}) },
    googleCalendar: {
      ...defaultIntegrations.googleCalendar,
      ...(input.googleCalendar ?? {}),
    },
    alexa: { ...defaultIntegrations.alexa, ...(input.alexa ?? {}) },
    irobot: { ...defaultIntegrations.irobot, ...(input.irobot ?? {}) },
    nest: { ...defaultIntegrations.nest, ...(input.nest ?? {}) },
    smartLights: {
      ...defaultIntegrations.smartLights,
      ...(input.smartLights ?? {}),
    },
  };
}

/**
 * Normalize raw settings from disk into a complete, valid settings object.
 * This mirrors the client-side normalizeSettings() function.
 */
export function normalizeServerSettings(
  input: unknown,
): typeof defaultSettings {
  const partial = (input && typeof input === "object" ? input : {}) as Record<
    string,
    any
  >;

  return {
    ...defaultSettings,
    ...partial,
    jarvis: { ...defaultSettings.jarvis, ...(partial.jarvis ?? {}) },
    models: { ...defaultSettings.models, ...(partial.models ?? {}) },
    textChat: { ...defaultSettings.textChat, ...(partial.textChat ?? {}) },
    imageGeneration: {
      ...defaultSettings.imageGeneration,
      ...(partial.imageGeneration ?? {}),
    },
    integrations: normalizeIntegrations(partial.integrations),
    notificationPreferences: {
      ...defaultSettings.notificationPreferences,
      ...(partial.notificationPreferences ?? {}),
    },
    cameras: partial.cameras ?? defaultSettings.cameras,
    lockdownState: {
      ...defaultSettings.lockdownState,
      ...(partial.lockdownState ?? {}),
      features: {
        ...defaultSettings.lockdownState.features,
        ...(partial.lockdownState?.features ?? {}),
      },
    },
  };
}

// ============================================================================
// Contract Validation
// ============================================================================

export interface ContractValidationResult {
  ok: boolean;
  settings: typeof defaultSettings;
  zodErrors?: z.ZodIssue[];
  parseError?: string;
}

/**
 * Validate and normalize settings from disk/JSON.
 *
 * Contract guarantees:
 * - Always returns a valid settings object (never throws)
 * - Logs warnings for validation issues
 * - Falls back to normalized defaults if input is unparseable
 */
export function validateAndNormalizeSettings(
  rawJson: unknown,
): ContractValidationResult {
  // Step 1: Attempt Zod schema validation (loose validation)
  const zodResult = RawSettingsSchema.safeParse(rawJson);

  if (!zodResult.success) {
    logger.warn(
      {
        errors: zodResult.error.issues.slice(0, 5),
        errorCount: zodResult.error.issues.length,
      },
      "[SettingsContract] Zod validation warnings (proceeding with normalization)",
    );

    // Even if Zod validation fails, still attempt normalization
    // This handles cases where settings have extra/unknown fields
    const normalized = normalizeServerSettings(rawJson);
    return {
      ok: true, // Still OK because we normalized successfully
      settings: normalized,
      zodErrors: zodResult.error.issues,
    };
  }

  // Step 2: Normalize validated settings
  const normalized = normalizeServerSettings(zodResult.data);

  return {
    ok: true,
    settings: normalized,
  };
}

/**
 * Safe JSON parse with fallback to empty object
 */
export function safeJsonParse(jsonString: string): {
  data: unknown;
  error?: string;
} {
  try {
    return { data: JSON.parse(jsonString) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parse error";
    logger.error({ error: message }, "[SettingsContract] JSON parse error");
    return { data: {}, error: message };
  }
}

/**
 * Get default settings (for use when no settings file exists)
 */
export function getDefaultSettings(): typeof defaultSettings {
  return { ...defaultSettings };
}

// Export for testing
export { defaultSettings, defaultIntegrations };
