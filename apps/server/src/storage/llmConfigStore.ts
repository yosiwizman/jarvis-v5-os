/**
 * LLM Configuration Store
 * 
 * Stores LLM provider configuration for the AKIOR platform.
 * Supports:
 * - OpenAI Cloud (API key required, fixed base URL)
 * - Local/OpenAI-Compatible (custom base URL, optional API key)
 * 
 * SECURITY:
 * - API keys are stored in secrets.json via secretStore (never exposed to clients)
 * - Only metadata (provider type, baseUrl host) is exposed via API
 * - Audit logging for all config changes
 */

import fs from 'fs';
import path from 'path';
import { upsertSecret, deleteSecret, readSecrets } from './secretStore.js';
import { logSystemEvent } from '../utils/logger.js';

// LLM Provider types
export type LLMProvider = 'openai-cloud' | 'local-compatible';

// Config stored on disk (no secrets)
export interface LLMConfigData {
  provider: LLMProvider;
  baseUrl?: string; // Only for local-compatible
  updatedAt: string;
}

// Config returned to clients (safe to expose)
export interface LLMConfigPublic {
  provider: LLMProvider;
  baseUrl?: string;
  baseUrlHost?: string; // Hostname only for display
  keyConfigured: boolean;
  updatedAt: string;
}

// Config for internal use (includes key check)
export interface LLMConfigInternal extends LLMConfigData {
  apiKey?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'llm-config.json');

// Default config
const DEFAULT_CONFIG: LLMConfigData = {
  provider: 'openai-cloud',
  updatedAt: new Date().toISOString(),
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Read LLM config from disk
 */
export function readLLMConfig(): LLMConfigData {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const data = JSON.parse(raw) as LLMConfigData;
      return {
        provider: data.provider || DEFAULT_CONFIG.provider,
        baseUrl: data.baseUrl,
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('[LLMConfigStore] Error reading config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Write LLM config to disk
 */
function writeLLMConfig(config: LLMConfigData): void {
  const data: LLMConfigData = {
    provider: config.provider,
    baseUrl: config.baseUrl,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get LLM config for client (no secrets)
 */
export function getLLMConfigPublic(): LLMConfigPublic {
  const config = readLLMConfig();
  const secrets = readSecrets();
  
  // Check if API key is configured
  const keyConfigured = config.provider === 'openai-cloud'
    ? Boolean(secrets.openai)
    : Boolean(secrets.llmApiKey);
  
  // Extract hostname from baseUrl for display
  let baseUrlHost: string | undefined;
  if (config.baseUrl) {
    try {
      const url = new URL(config.baseUrl);
      baseUrlHost = url.hostname;
    } catch {
      baseUrlHost = undefined;
    }
  }
  
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    baseUrlHost,
    keyConfigured,
    updatedAt: config.updatedAt,
  };
}

/**
 * Get LLM config for internal use (includes key)
 */
export function getLLMConfigInternal(): LLMConfigInternal {
  const config = readLLMConfig();
  const secrets = readSecrets();
  
  return {
    ...config,
    apiKey: config.provider === 'openai-cloud'
      ? secrets.openai
      : secrets.llmApiKey,
  };
}

/**
 * Check if LLM is properly configured
 */
export function isLLMConfigured(): { configured: boolean; reason?: string } {
  const config = readLLMConfig();
  const secrets = readSecrets();
  
  if (config.provider === 'openai-cloud') {
    if (!secrets.openai) {
      return { configured: false, reason: 'LLM not configured: OpenAI key missing' };
    }
    return { configured: true };
  }
  
  if (config.provider === 'local-compatible') {
    if (!config.baseUrl) {
      return { configured: false, reason: 'LLM not configured: base URL missing' };
    }
    // API key is optional for local providers
    return { configured: true };
  }
  
  return { configured: false, reason: 'LLM provider not configured' };
}

/**
 * Update LLM provider configuration
 */
export function updateLLMConfig(
  provider: LLMProvider,
  options: { baseUrl?: string; apiKey?: string }
): { ok: boolean; error?: string } {
  try {
    // Validate provider
    if (provider !== 'openai-cloud' && provider !== 'local-compatible') {
      return { ok: false, error: 'Invalid provider' };
    }
    
    // Validate baseUrl for local-compatible
    if (provider === 'local-compatible') {
      if (!options.baseUrl) {
        return { ok: false, error: 'Base URL is required for local/compatible provider' };
      }
      // Validate URL format
      try {
        new URL(options.baseUrl);
      } catch {
        return { ok: false, error: 'Invalid base URL format' };
      }
    }
    
    // Save config (no secrets)
    const config: LLMConfigData = {
      provider,
      baseUrl: provider === 'local-compatible' ? options.baseUrl : undefined,
      updatedAt: new Date().toISOString(),
    };
    writeLLMConfig(config);
    
    // Save API key if provided
    if (options.apiKey) {
      if (provider === 'openai-cloud') {
        upsertSecret('openai', options.apiKey);
      } else {
        // Store local provider key separately
        const secrets = readSecrets();
        (secrets as any).llmApiKey = options.apiKey;
        fs.writeFileSync(
          path.join(DATA_DIR, 'secrets.json'),
          JSON.stringify(secrets, null, 2)
        );
      }
    }
    
    // Audit log (no secrets!)
    logSystemEvent('llm_config_updated', {
      provider,
      hasBaseUrl: Boolean(options.baseUrl),
      hasApiKey: Boolean(options.apiKey),
    });
    
    return { ok: true };
  } catch (error) {
    console.error('[LLMConfigStore] Error updating config:', error);
    return { ok: false, error: 'Failed to update configuration' };
  }
}

/**
 * Get the effective base URL for the configured LLM provider
 */
export function getLLMBaseUrl(): string {
  const config = readLLMConfig();
  
  if (config.provider === 'openai-cloud') {
    return 'https://api.openai.com/v1';
  }
  
  return config.baseUrl || '';
}

/**
 * Get the effective API key for the configured LLM provider
 */
export function getLLMApiKey(): string | undefined {
  const config = readLLMConfig();
  const secrets = readSecrets();
  
  if (config.provider === 'openai-cloud') {
    return secrets.openai;
  }
  
  return (secrets as any).llmApiKey;
}
