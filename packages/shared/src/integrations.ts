// Integration IDs
export type IntegrationId =
  | 'weather'
  | 'webSearch'
  | 'localLLM'
  | 'elevenLabs'
  | 'azureTTS'
  | 'spotify'
  | 'gmail'
  | 'googleCalendar';

// Individual Integration Configs

export interface WeatherIntegrationConfig {
  enabled: boolean;
  provider: 'openweather';
  defaultLocation: string;  // e.g. "Miami,US"
}

export interface WebSearchIntegrationConfig {
  enabled: boolean;
  baseUrl: string | null;       // e.g. "https://api.tavily.com" or "https://serpapi.com"
  apiKey: string | null;        // API key for authentication
  defaultRegion: string | null; // e.g. "us", "uk" (optional, provider-specific)
}

export interface LocalLLMIntegrationConfig {
  enabled: boolean;
  provider: 'ollama' | 'custom-http';
  baseUrl: string | null;      // e.g. "http://127.0.0.1:11434"
  apiKey: string | null;       // optional, used only for custom-http
  model: string | null;        // e.g. "llama3.1"
  temperature: number | null;  // e.g. 0.7
  maxTokens: number | null;    // optional
}

export interface ElevenLabsIntegrationConfig {
  enabled: boolean;
  apiKey: string | null;
  voiceId: string | null;        // target voice
  modelId: string | null;        // e.g. "eleven_multilingual_v2"
  stability: number | null;      // optional voice setting
  similarityBoost: number | null;
  style: number | null;          // optional style intensity
}

export interface AzureTTSIntegrationConfig {
  enabled: boolean;
  apiKey: string | null;
  region: string | null;      // e.g. "eastus"
  voiceName: string | null;   // e.g. "en-US-JennyNeural"
  style: string | null;       // optional, for expressive styles
  rate: string | null;        // e.g. "+0%" or "-20%"
  pitch: string | null;       // e.g. "+0%" or "+2st"
}

export interface SpotifyIntegrationConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

export interface GmailIntegrationConfig {
  enabled: boolean;
}

export interface GoogleCalendarIntegrationConfig {
  enabled: boolean;
}

// Master Integration Settings

export interface IntegrationSettings {
  weather: WeatherIntegrationConfig;
  webSearch: WebSearchIntegrationConfig;
  localLLM: LocalLLMIntegrationConfig;
  elevenLabs: ElevenLabsIntegrationConfig;
  azureTTS: AzureTTSIntegrationConfig;
  spotify: SpotifyIntegrationConfig;
  gmail: GmailIntegrationConfig;
  googleCalendar: GoogleCalendarIntegrationConfig;
}

// Default Values

export const defaultIntegrationSettings: IntegrationSettings = {
  weather: {
    enabled: false,
    provider: 'openweather',
    defaultLocation: 'Miami,US'
  },
  webSearch: {
    enabled: false,
    baseUrl: null,
    apiKey: null,
    defaultRegion: null
  },
  localLLM: {
    enabled: false,
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    apiKey: null,
    model: 'llama3.1',
    temperature: 0.7,
    maxTokens: null
  },
  elevenLabs: {
    enabled: false,
    apiKey: null,
    voiceId: null,
    modelId: 'eleven_multilingual_v2',
    stability: null,
    similarityBoost: null,
    style: null
  },
  azureTTS: {
    enabled: false,
    apiKey: null,
    region: 'eastus',
    voiceName: 'en-US-JennyNeural',
    style: null,
    rate: null,
    pitch: null
  },
  spotify: {
    enabled: false,
    clientId: '',
    clientSecret: ''
  },
  gmail: {
    enabled: false
  },
  googleCalendar: {
    enabled: false
  }
};

// Integration Metadata

export interface IntegrationMetadata {
  id: IntegrationId;
  name: string;
  description: string;
  requiresApiKey: boolean;
  comingSoon: boolean;
}

export const integrationMetadata: Record<IntegrationId, IntegrationMetadata> = {
  weather: {
    id: 'weather',
    name: 'Weather',
    description: 'Used by HUD and widgets to show live weather',
    requiresApiKey: true,
    comingSoon: false
  },
  webSearch: {
    id: 'webSearch',
    name: 'Web Search',
    description: 'Used for web-aware answers and browsing',
    requiresApiKey: true,
    comingSoon: false
  },
  localLLM: {
    id: 'localLLM',
    name: 'Local LLM',
    description: 'Connect your local model server (Ollama, LM Studio, etc.)',
    requiresApiKey: false,
    comingSoon: false
  },
  elevenLabs: {
    id: 'elevenLabs',
    name: 'ElevenLabs',
    description: 'High-quality neural voice generation',
    requiresApiKey: true,
    comingSoon: false
  },
  azureTTS: {
    id: 'azureTTS',
    name: 'Azure TTS',
    description: 'Cloud TTS voices from Azure',
    requiresApiKey: true,
    comingSoon: false
  },
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    description: 'Media playback and context via Spotify',
    requiresApiKey: true,
    comingSoon: true
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Future email capabilities',
    requiresApiKey: false,
    comingSoon: true
  },
  googleCalendar: {
    id: 'googleCalendar',
    name: 'Google Calendar',
    description: 'Future calendar and scheduling',
    requiresApiKey: false,
    comingSoon: true
  }
};

// Connection Status Helpers

export function isIntegrationConnected(
  id: IntegrationId,
  config: IntegrationSettings[IntegrationId]
): boolean {
  if (!config.enabled) return false;

  switch (id) {
    case 'weather':
      return !!(config as WeatherIntegrationConfig).defaultLocation;
    case 'webSearch': {
      const wsConfig = config as WebSearchIntegrationConfig;
      return !!(wsConfig.baseUrl && wsConfig.apiKey);
    }
    case 'localLLM': {
      const llmConfig = config as LocalLLMIntegrationConfig;
      return !!(llmConfig.baseUrl && llmConfig.model);
    }
    case 'elevenLabs': {
      const elConfig = config as ElevenLabsIntegrationConfig;
      return !!(elConfig.apiKey && elConfig.voiceId);
    }
    case 'azureTTS': {
      const azConfig = config as AzureTTSIntegrationConfig;
      return !!(azConfig.apiKey && azConfig.region && azConfig.voiceName);
    }
    case 'spotify':
      return !!(config as SpotifyIntegrationConfig).clientId &&
             !!(config as SpotifyIntegrationConfig).clientSecret;
    case 'gmail':
    case 'googleCalendar':
      return config.enabled; // No extra requirements yet
    default:
      return false;
  }
}
