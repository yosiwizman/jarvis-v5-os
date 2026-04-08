// Integration IDs
export type IntegrationId =
  | 'weather'
  | 'webSearch'
  | 'localLLM'
  | 'elevenLabs'
  | 'azureTTS'
  | 'spotify'
  | 'gmail'
  | 'googleCalendar'
  | 'alexa'
  | 'irobot'
  | 'nest'
  | 'smartLights';

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
  clientId: string | null;
  clientSecret: string | null;
  defaultMarket: string | null;  // e.g. "US", "GB", "DE"
}

export interface GmailIntegrationConfig {
  enabled: boolean;
  redirectUri: string | null;   // where Google will redirect after consent
  refreshToken: string | null;  // long-lived; obtained via manual flow
  userEmail: string | null;     // the Gmail account AKIOR is reading
}

export interface GoogleCalendarIntegrationConfig {
  enabled: boolean;
  redirectUri: string | null;   // where Google will redirect after consent
  refreshToken: string | null;  // long-lived; obtained via manual flow
  calendarId: string | null;    // e.g. "primary" or a specific calendar ID
}

export interface AlexaIntegrationConfig {
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  region: string | null;  // e.g. "NA" (North America), "EU", "FE" (Far East)
}

export interface IRobotIntegrationConfig {
  enabled: boolean;
  username: string | null;  // iRobot account email
  password: string | null;  // iRobot account password
  robotId: string | null;   // Optional: specific robot ID to control
}

export interface NestIntegrationConfig {
  enabled: boolean;
  projectId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  deviceId: string | null;  // Thermostat device ID
}

export interface SmartLightsIntegrationConfig {
  enabled: boolean;
  provider: 'hue' | 'lifx' | 'generic';
  apiKey: string | null;
  bridgeIp: string | null;  // For Philips Hue bridge
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
  alexa: AlexaIntegrationConfig;
  irobot: IRobotIntegrationConfig;
  nest: NestIntegrationConfig;
  smartLights: SmartLightsIntegrationConfig;
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
    clientId: null,
    clientSecret: null,
    defaultMarket: 'US'
  },
  gmail: {
    enabled: false,
    redirectUri: null,
    refreshToken: null,
    userEmail: null
  },
  googleCalendar: {
    enabled: false,
    redirectUri: null,
    refreshToken: null,
    calendarId: 'primary'
  },
  alexa: {
    enabled: false,
    clientId: null,
    clientSecret: null,
    refreshToken: null,
    region: 'NA'
  },
  irobot: {
    enabled: false,
    username: null,
    password: null,
    robotId: null
  },
  nest: {
    enabled: false,
    projectId: null,
    clientId: null,
    clientSecret: null,
    refreshToken: null,
    deviceId: null
  },
  smartLights: {
    enabled: false,
    provider: 'hue',
    apiKey: null,
    bridgeIp: null
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
    comingSoon: false
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect Gmail account using OAuth2 refresh token',
    requiresApiKey: true,
    comingSoon: false
  },
  googleCalendar: {
    id: 'googleCalendar',
    name: 'Google Calendar',
    description: 'Connect Google Calendar via OAuth2 (refresh token). Backend test endpoint available; calendar UI coming later.',
    requiresApiKey: true,
    comingSoon: false
  },
  alexa: {
    id: 'alexa',
    name: 'Amazon Alexa',
    description: 'Control Alexa-enabled smart home devices via voice',
    requiresApiKey: true,
    comingSoon: false
  },
  irobot: {
    id: 'irobot',
    name: 'iRobot Roomba',
    description: 'Control iRobot vacuum cleaners (start/stop/dock)',
    requiresApiKey: true,
    comingSoon: false
  },
  nest: {
    id: 'nest',
    name: 'Google Nest',
    description: 'Control Nest thermostat and devices',
    requiresApiKey: true,
    comingSoon: false
  },
  smartLights: {
    id: 'smartLights',
    name: 'Smart Lights',
    description: 'Control smart lighting systems (Philips Hue, LIFX)',
    requiresApiKey: true,
    comingSoon: false
  }
};

// Connection Status Helpers

export function isIntegrationConnected(
  id: IntegrationId,
  config: IntegrationSettings[IntegrationId]
): boolean {
  if (!config || !config.enabled) return false;

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
    case 'spotify': {
      const spotifyConfig = config as SpotifyIntegrationConfig;
      return !!(spotifyConfig.clientId && spotifyConfig.clientSecret);
    }
    case 'gmail': {
      const gmailConfig = config as GmailIntegrationConfig;
      return !!(
        gmailConfig.refreshToken &&
        gmailConfig.userEmail
      );
    }
    case 'googleCalendar': {
      const calConfig = config as GoogleCalendarIntegrationConfig;
      return !!(
        calConfig.refreshToken &&
        calConfig.calendarId
      );
    }
    case 'alexa': {
      const alexaConfig = config as AlexaIntegrationConfig;
      return !!(
        alexaConfig.clientId &&
        alexaConfig.clientSecret &&
        alexaConfig.refreshToken
      );
    }
    case 'irobot': {
      const irobotConfig = config as IRobotIntegrationConfig;
      return !!(
        irobotConfig.username &&
        irobotConfig.password
      );
    }
    case 'nest': {
      const nestConfig = config as NestIntegrationConfig;
      return !!(
        nestConfig.projectId &&
        nestConfig.clientId &&
        nestConfig.clientSecret &&
        nestConfig.refreshToken
      );
    }
    case 'smartLights': {
      const lightsConfig = config as SmartLightsIntegrationConfig;
      return !!(lightsConfig.apiKey);
    }
    default:
      return false;
  }
}
