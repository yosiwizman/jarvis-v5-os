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

export type TextChatSettings = {
  model?: string;
  initialPrompt?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
};

export type ImageGenerationSettings = {
  model?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
  partialImages?: 0 | 1 | 2 | 3;
};

export type AppSettings = {
  jarvis: JarvisSettings;
  models: ModelSettings;
  textChat: TextChatSettings;
  imageGeneration: ImageGenerationSettings;
  integrations: import('./integrations').IntegrationSettings;
  useServerProxy?: boolean;
  // Legacy field for backward compat during migration
  weather?: {
    enabled?: boolean;
    provider?: 'openweather';
    location?: string;
  };
};

const STORAGE_KEY = 'smartMirrorSettings';
const SERVER_URL = '/api/settings';

// In-memory cache for settings loaded from server
let settingsCache: AppSettings | null = null;

const defaultSettings: AppSettings = {
  jarvis: {
    model: 'gpt-realtime-mini',
    voice: 'echo',
    initialPrompt: 'You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the AI assistant from Iron Man. You are sophisticated, helpful, and possess a dry sense of humor. You address the user as "Sir" or by their preferred name, provide concise yet thorough responses, and maintain a calm, professional demeanor even in challenging situations. You have extensive knowledge and can assist with a wide variety of tasks, from technical problems to creative projects.',
    hotword: 'jarvis',
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
    maxOutputTokens: 800
  },
  imageGeneration: {
    model: 'dall-e-3',
    size: '1024x1024',
    quality: 'standard',
    partialImages: 0
  },
  integrations: require('./integrations').defaultIntegrationSettings,
  useServerProxy: true
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
    
    const serverSettings = await response.json() as Partial<AppSettings>;
    
    // Merge server settings with defaults
    const merged = {
      ...defaultSettings,
      ...serverSettings,
      jarvis: { ...defaultSettings.jarvis, ...(serverSettings?.jarvis ?? {}) },
      models: { ...defaultSettings.models, ...(serverSettings?.models ?? {}) },
      textChat: { ...defaultSettings.textChat, ...(serverSettings?.textChat ?? {}) },
      imageGeneration: { ...defaultSettings.imageGeneration, ...(serverSettings?.imageGeneration ?? {}) },
      integrations: { ...defaultSettings.integrations, ...(serverSettings?.integrations ?? {}) }
    } satisfies AppSettings;
    
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
      const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
      const merged = {
        ...defaultSettings,
        ...parsed,
        jarvis: { ...defaultSettings.jarvis, ...(parsed?.jarvis ?? {}) },
        models: { ...defaultSettings.models, ...(parsed?.models ?? {}) },
        textChat: { ...defaultSettings.textChat, ...(parsed?.textChat ?? {}) },
        imageGeneration: { ...defaultSettings.imageGeneration, ...(parsed?.imageGeneration ?? {}) },
        integrations: { ...defaultSettings.integrations, ...(parsed?.integrations ?? {}) }
      } satisfies AppSettings;
      
      settingsCache = merged;
      return merged;
    } catch (localError) {
      console.warn('Failed to read localStorage, using defaults', localError);
      settingsCache = defaultSettings;
      return defaultSettings;
    }
  }
}

/**
 * Read settings synchronously from cache (after loadSettingsFromServer has been called)
 * Falls back to localStorage then defaults if cache is empty
 */
export function readSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  
  // Return cached settings if available
  if (settingsCache) {
    return settingsCache;
  }
  
  // Fallback to localStorage
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    return {
      ...defaultSettings,
      ...parsed,
      jarvis: { ...defaultSettings.jarvis, ...(parsed?.jarvis ?? {}) },
      models: { ...defaultSettings.models, ...(parsed?.models ?? {}) },
      textChat: { ...defaultSettings.textChat, ...(parsed?.textChat ?? {}) },
      imageGeneration: { ...defaultSettings.imageGeneration, ...(parsed?.imageGeneration ?? {}) },
      integrations: { ...defaultSettings.integrations, ...(parsed?.integrations ?? {}) }
    } satisfies AppSettings;
  } catch (error) {
    console.warn('Failed to read settings', error);
    return defaultSettings;
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

export function updateIntegrations(partial: Partial<import('./integrations').IntegrationSettings>) {
  const current = readSettings();
  writeSettings({ ...current, integrations: { ...current.integrations, ...partial } });
}

export function updateIntegration<K extends import('./integrations').IntegrationId>(
  id: K,
  patch: Partial<import('./integrations').IntegrationSettings[K]>
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

export { defaultSettings as defaultAppSettings };

// Re-export integrations module for convenience
export type { IntegrationId, IntegrationSettings, WeatherIntegrationConfig } from './integrations';
export { defaultIntegrationSettings, integrationMetadata, isIntegrationConnected } from './integrations';
