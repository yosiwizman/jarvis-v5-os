export type JarvisSettings = {
  apiKey?: string;
  model?: string;
  voice?: string;
  initialPrompt?: string;
  hotword?: string;
  imageDetail?: 'low' | 'high' | 'auto';
};

export type ModelSettings = {
  aiModel?: string;
  topology?: 'triangle' | 'quad';
  targetPolycount?: number;
  shouldRemesh?: boolean;
  shouldTexture?: boolean;
  enablePbr?: boolean;
  symmetryMode?: 'off' | 'auto' | 'on';
  artStyle?: 'realistic' | 'sculpture';
  outputFormat?: 'glb' | 'obj' | 'usdz';
};

export type TtsProvider = 'none' | 'elevenlabs' | 'azure';

export type TextChatSettings = {
  model?: string;
  initialPrompt?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  useWebSearch?: boolean;     // Allow web search for answers
  useLocalLlm?: boolean;      // Master toggle for local LLM
  localLlmPrimary?: boolean;  // If true, prefer local; else local is fallback
  ttsProvider?: TtsProvider;  // TTS provider selection (default 'none' or falls back to 'elevenlabs' if configured)
};

export type ImageGenerationSettings = {
  model?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
  partialImages?: 0 | 1 | 2 | 3;
};

export type NotificationPreferences = {
  calendar_reminder?: boolean;
  email_notification?: boolean;
  printer_alert?: boolean;
  camera_alert?: boolean;
  system_update?: boolean;
  integration_error?: boolean;
  custom?: boolean;
};

export type AppSettings = {
  jarvis: JarvisSettings;
  models: ModelSettings;
  textChat: TextChatSettings;
  imageGeneration: ImageGenerationSettings;
  integrations: import('./integrations.js').IntegrationSettings;
  notificationPreferences?: NotificationPreferences;
  useServerProxy?: boolean;
  cameras?: import('./types.js').CameraSettings[];
  lockdownState?: import('./types.js').LockdownState;
  // Legacy field for backward compat during migration
  weather?: {
    enabled?: boolean;
    provider?: 'openweather';
    location?: string;
  };
};

import { defaultIntegrationSettings, type IntegrationSettings, type IntegrationId } from './integrations.js';

const STORAGE_KEY = 'smartMirrorSettings';

/**
 * Deep-merge integration settings to ensure every integration has all required fields.
 * This prevents "Cannot read properties of undefined" errors when accessing nested properties.
 */
function normalizeIntegrations(input: Partial<IntegrationSettings> | undefined | null): IntegrationSettings {
  if (!input || typeof input !== 'object') {
    return { ...defaultIntegrationSettings };
  }
  
  // Deep merge each integration individually
  // Use explicit merging per key to satisfy TypeScript's strict type checking
  return {
    weather: { ...defaultIntegrationSettings.weather, ...(input.weather ?? {}) },
    webSearch: { ...defaultIntegrationSettings.webSearch, ...(input.webSearch ?? {}) },
    localLLM: { ...defaultIntegrationSettings.localLLM, ...(input.localLLM ?? {}) },
    elevenLabs: { ...defaultIntegrationSettings.elevenLabs, ...(input.elevenLabs ?? {}) },
    azureTTS: { ...defaultIntegrationSettings.azureTTS, ...(input.azureTTS ?? {}) },
    spotify: { ...defaultIntegrationSettings.spotify, ...(input.spotify ?? {}) },
    gmail: { ...defaultIntegrationSettings.gmail, ...(input.gmail ?? {}) },
    googleCalendar: { ...defaultIntegrationSettings.googleCalendar, ...(input.googleCalendar ?? {}) },
    alexa: { ...defaultIntegrationSettings.alexa, ...(input.alexa ?? {}) },
    irobot: { ...defaultIntegrationSettings.irobot, ...(input.irobot ?? {}) },
    nest: { ...defaultIntegrationSettings.nest, ...(input.nest ?? {}) },
    smartLights: { ...defaultIntegrationSettings.smartLights, ...(input.smartLights ?? {}) },
  };
}

/**
 * Normalize settings by deep-merging with defaults.
 * Ensures all nested objects (especially integrations) have required fields.
 * This is the SINGLE CHOKE-POINT for normalization - all settings must pass through here.
 */
export function normalizeSettings(input: unknown): AppSettings {
  const partial = (input && typeof input === 'object' ? input : {}) as Partial<AppSettings>;
  
  const normalized: AppSettings = {
    ...defaultSettings,
    ...partial,
    jarvis: { ...defaultSettings.jarvis, ...(partial.jarvis ?? {}) },
    models: { ...defaultSettings.models, ...(partial.models ?? {}) },
    textChat: { ...defaultSettings.textChat, ...(partial.textChat ?? {}) },
    imageGeneration: { ...defaultSettings.imageGeneration, ...(partial.imageGeneration ?? {}) },
    integrations: normalizeIntegrations(partial.integrations),
    notificationPreferences: { ...defaultSettings.notificationPreferences, ...(partial.notificationPreferences ?? {}) },
    cameras: partial.cameras ?? defaultSettings.cameras,
    lockdownState: partial.lockdownState ?? defaultSettings.lockdownState
  };
  
  // DEV-only assertion to catch regressions early
  if (process.env.NODE_ENV === 'development') {
    assertNormalizedSettings(normalized);
  }
  
  return normalized;
}

/**
 * DEV-only assertion that validates required settings structure.
 * Throws with actionable context if required integration keys are missing.
 */
function assertNormalizedSettings(settings: AppSettings): void {
  const requiredIntegrationKeys: (keyof IntegrationSettings)[] = [
    'weather', 'webSearch', 'localLLM', 'elevenLabs', 'azureTTS',
    'spotify', 'gmail', 'googleCalendar', 'alexa', 'irobot', 'nest', 'smartLights'
  ];
  
  if (!settings.integrations || typeof settings.integrations !== 'object') {
    console.error('[Settings] ASSERTION FAILED: integrations is missing or invalid', settings);
    throw new Error('[Settings] normalizeSettings failed: integrations is missing or invalid');
  }
  
  for (const key of requiredIntegrationKeys) {
    if (!settings.integrations[key] || typeof settings.integrations[key] !== 'object') {
      console.error(`[Settings] ASSERTION FAILED: integrations.${key} is missing or invalid`, {
        key,
        value: settings.integrations[key],
        integrations: settings.integrations
      });
      throw new Error(`[Settings] normalizeSettings failed: integrations.${key} is missing or invalid`);
    }
  }
}
const SERVER_URL = '/api/settings';

// In-memory cache for settings loaded from server
let settingsCache: AppSettings | null = null;

const defaultSettings: AppSettings = {
  jarvis: {
    model: 'gpt-realtime-mini',
    voice: 'echo',
    initialPrompt: 'You are AKIOR (Advanced Knowledge & Intelligence Operating Resource), a sophisticated AI assistant. You are helpful, knowledgeable, and possess a friendly yet professional demeanor. You provide concise yet thorough responses and maintain a calm, professional tone even in challenging situations. You have extensive knowledge and can assist with a wide variety of tasks, from technical problems to creative projects.',
    hotword: 'akior',
    imageDetail: 'low'
  },
  models: {
    aiModel: 'latest',
    topology: 'triangle',
    targetPolycount: 30000,
    shouldRemesh: true,
    shouldTexture: true,
    enablePbr: false,
    symmetryMode: 'auto',
    artStyle: 'realistic',
    outputFormat: 'glb'
  },
  textChat: {
    model: 'gpt-5',
    initialPrompt: '',
    reasoningEffort: 'low',
    verbosity: 'medium',
    maxOutputTokens: 800,
    useWebSearch: false,
    useLocalLlm: false,
    localLlmPrimary: false,  // Cloud is primary by default
    ttsProvider: 'elevenlabs'  // Default to elevenlabs for v5.5.0 compatibility
  },
  imageGeneration: {
    model: 'dall-e-3',
    size: '1024x1024',
    quality: 'standard',
    partialImages: 0
  },
  integrations: defaultIntegrationSettings,
  notificationPreferences: {
    calendar_reminder: true,
    email_notification: true,
    printer_alert: true,
    camera_alert: true,
    system_update: true,
    integration_error: true,
    custom: true
  },
  useServerProxy: true,
  cameras: [],
  lockdownState: {
    active: false,
    activatedAt: null,
    activatedBy: null,
    features: {
      doorsLocked: false,
      alarmArmed: false,
      camerasSecured: false
    }
  }
};

/**
 * Load settings from server (async) - Call this on app mount
 * Caches the result and updates localStorage as backup
 */
export async function loadSettingsFromServer(): Promise<AppSettings> {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  
  try {
    console.log('🔄 Loading settings from server...');
    const response = await fetch(SERVER_URL);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    const serverSettings = await response.json();
    
    // Deep-merge server settings with defaults using normalizeSettings
    const merged = normalizeSettings(serverSettings);
    
    // Cache in memory
    settingsCache = merged;
    
    // Backup to localStorage
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    
    console.log('✅ Settings loaded from server:', {
      voice: merged.jarvis.voice,
      model: merged.jarvis.model,
      promptLength: merged.jarvis.initialPrompt?.length || 0
    });
    
    return merged;
  } catch (error) {
    console.warn('⚠️ Failed to load settings from server, using localStorage fallback:', error);
    
    // Fallback to localStorage
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const merged = normalizeSettings(parsed);
      
      settingsCache = merged;
      return merged;
    } catch (localError) {
      console.warn('Failed to read localStorage, using defaults', localError);
      settingsCache = normalizeSettings(null);
      return settingsCache;
    }
  }
}

/**
 * Read settings synchronously from cache (after loadSettingsFromServer has been called)
 * Falls back to localStorage then defaults if cache is empty.
 * 
 * IMPORTANT: This function ALWAYS returns normalized settings.
 * All consumers can trust that integrations and all nested fields exist.
 */
export function readSettings(): AppSettings {
  // SSR path - return normalized defaults
  if (typeof window === 'undefined') {
    return normalizeSettings(null);
  }
  
  // Return cached settings if available (already normalized when cached)
  // Re-normalize as safety net in case cache was somehow corrupted
  if (settingsCache) {
    return normalizeSettings(settingsCache);
  }
  
  // Fallback to localStorage with deep normalization
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const normalized = normalizeSettings(parsed);
    // Cache the normalized result for subsequent reads
    settingsCache = normalized;
    return normalized;
  } catch (error) {
    console.warn('Failed to read settings', error);
    const normalized = normalizeSettings(null);
    settingsCache = normalized;
    return normalized;
  }
}

/**
 * Write settings - saves to cache, localStorage, and server
 * Server save happens in background (fire-and-forget)
 */
export function writeSettings(settings: AppSettings) {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Update cache immediately
  settingsCache = settings;
  
  // Save to localStorage immediately (synchronous)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  
  // Save to server in background (async, don't await)
  fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
    .then(response => {
      if (response.ok) {
        console.log('✅ Settings saved to server');
      } else {
        console.warn('⚠️ Failed to save settings to server:', response.status);
      }
    })
    .catch(error => {
      console.warn('⚠️ Failed to save settings to server:', error);
    });
}

export function updateSettings(partial: Partial<AppSettings>) {
  const next = { ...readSettings(), ...partial } as AppSettings;
  writeSettings(next);
}

export function updateJarvisSettings(partial: Partial<JarvisSettings>) {
  const current = readSettings();
  writeSettings({ ...current, jarvis: { ...current.jarvis, ...partial } });
}

export function updateModelSettings(partial: Partial<ModelSettings>) {
  const current = readSettings();
  writeSettings({ ...current, models: { ...current.models, ...partial } });
}

export function updateTextChatSettings(partial: Partial<TextChatSettings>) {
  const current = readSettings();
  writeSettings({ ...current, textChat: { ...current.textChat, ...partial } });
}

export function updateImageGenerationSettings(partial: Partial<ImageGenerationSettings>) {
  const current = readSettings();
  writeSettings({ ...current, imageGeneration: { ...current.imageGeneration, ...partial } });
}

export function updateIntegrations(partial: Partial<import('./integrations.js').IntegrationSettings>) {
  const current = readSettings();
  writeSettings({ ...current, integrations: { ...current.integrations, ...partial } });
}

export function updateIntegration<K extends import('./integrations.js').IntegrationId>(
  id: K,
  patch: Partial<import('./integrations.js').IntegrationSettings[K]>
) {
  const current = readSettings();
  const updated = {
    ...current,
    integrations: {
      ...current.integrations,
      [id]: { ...current.integrations[id], ...patch }
    }
  };
  writeSettings(updated);
}

export function updateCameras(cameras: import('./types.js').CameraSettings[]) {
  const current = readSettings();
  writeSettings({ ...current, cameras });
}

export function updateCamera(cameraId: string, patch: Partial<import('./types.js').CameraSettings>) {
  const current = readSettings();
  const cameras = current.cameras ?? [];
  const existingIndex = cameras.findIndex(c => c.cameraId === cameraId);
  
  if (existingIndex >= 0) {
    // Update existing camera
    cameras[existingIndex] = { ...cameras[existingIndex], ...patch };
  } else {
    // Add new camera
    cameras.push({ cameraId, enabled: true, friendlyName: '', motionDetection: { enabled: false, sensitivity: 50, cooldownSeconds: 30 }, ...patch } as import('./types.js').CameraSettings);
  }
  
  writeSettings({ ...current, cameras });
}

export function updateLockdownState(partial: Partial<import('./types.js').LockdownState>) {
  const current = readSettings();
  const lockdownState = { ...current.lockdownState, ...partial } as import('./types.js').LockdownState;
  writeSettings({ ...current, lockdownState });
}

export { defaultSettings as defaultAppSettings };

// Re-export integrations module for convenience (used by web app)
export type { IntegrationId, IntegrationSettings, WeatherIntegrationConfig } from './integrations.js';
export { defaultIntegrationSettings, integrationMetadata, isIntegrationConnected } from './integrations.js';

// Re-export types for convenience (used by web app)
export type { CameraSettings, MotionZone, LockdownState } from './types.js';
