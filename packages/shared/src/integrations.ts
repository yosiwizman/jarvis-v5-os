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
  baseUrl?: string;        // e.g. "http://localhost:11434"
  modelName?: string;
}

export interface ElevenLabsIntegrationConfig {
  enabled: boolean;
  apiKey?: string;
  defaultVoiceId?: string;
}

export interface AzureTTSIntegrationConfig {
  enabled: boolean;
  apiKey?: string;
  region?: string;
  voiceName?: string;
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
    baseUrl: '',
    modelName: ''
  },
  elevenLabs: {
    enabled: false,
    apiKey: '',
    defaultVoiceId: ''
  },
  azureTTS: {
    enabled: false,
    apiKey: '',
    region: '',
    voiceName: ''
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
    comingSoon: true
  },
  elevenLabs: {
    id: 'elevenLabs',
    name: 'ElevenLabs',
    description: 'High-quality neural voice generation',
    requiresApiKey: true,
    comingSoon: true
  },
  azureTTS: {
    id: 'azureTTS',
    name: 'Azure TTS',
    description: 'Cloud TTS voices from Azure',
    requiresApiKey: true,
    comingSoon: true
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
    case 'localLLM':
      return !!(config as LocalLLMIntegrationConfig).baseUrl;
    case 'elevenLabs':
      return !!(config as ElevenLabsIntegrationConfig).apiKey;
    case 'azureTTS':
      return !!(config as AzureTTSIntegrationConfig).apiKey;
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
