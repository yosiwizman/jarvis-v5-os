/**
 * Local LLM Client
 * 
 * Generic client for local LLM servers (Ollama, LM Studio, etc.)
 * Supports both Ollama-specific /api/chat endpoint and OpenAI-compatible APIs.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { AppSettings, LocalLLMIntegrationConfig } from '@shared/core';

export interface LocalLlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalLlmQueryParams {
  messages: LocalLlmMessage[];
  systemPrompt?: string;
}

export type LocalLlmResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Load server settings to get local LLM configuration
 */
function loadSettings(): AppSettings | null {
  try {
    const settingsPath = join(process.cwd(), 'apps', 'server', 'data', 'settings.json');
    const raw = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(raw) as AppSettings;
  } catch (error) {
    console.warn('[LocalLLM] Failed to load settings:', error);
    return null;
  }
}

/**
 * Call local LLM using Ollama's /api/chat endpoint
 */
async function callOllama(
  config: LocalLLMIntegrationConfig,
  params: LocalLlmQueryParams
): Promise<LocalLlmResult> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') ?? '';
  const url = `${baseUrl}/api/chat`;

  const messages: any[] = [];
  
  // Add system prompt if provided
  if (params.systemPrompt) {
    messages.push({
      role: 'system',
      content: params.systemPrompt
    });
  }

  // Add conversation messages
  messages.push(...params.messages.map(m => ({
    role: m.role,
    content: m.content
  })));

  const body = {
    model: config.model,
    messages,
    stream: false,
    options: {
      temperature: config.temperature ?? 0.7,
      ...(config.maxTokens && { num_predict: config.maxTokens })
    }
  };

  try {
    console.log(`[LocalLLM] Calling Ollama at ${baseUrl} with model "${config.model}"`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[LocalLLM] Ollama HTTP ${response.status}: ${errorText}`);
      return { ok: false, error: 'local_llm_request_failed' };
    }

    const data = await response.json();

    // Ollama response format: { message: { role, content }, done: true }
    const messageContent = data?.message?.content;
    
    if (typeof messageContent === 'string' && messageContent.trim()) {
      console.log(`[LocalLLM] Received ${messageContent.length} chars from Ollama`);
      return { ok: true, message: messageContent.trim() };
    }

    console.warn('[LocalLLM] Ollama response missing message content:', Object.keys(data));
    return { ok: false, error: 'local_llm_invalid_response' };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[LocalLLM] Ollama request timeout');
      return { ok: false, error: 'local_llm_timeout' };
    }

    console.error('[LocalLLM] Ollama request failed:', error);
    return { ok: false, error: 'local_llm_connection_failed' };
  }
}

/**
 * Call local LLM using OpenAI-compatible HTTP API
 */
async function callCustomHttp(
  config: LocalLLMIntegrationConfig,
  params: LocalLlmQueryParams
): Promise<LocalLlmResult> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') ?? '';
  // Assume OpenAI-style endpoint: /v1/chat/completions
  const url = `${baseUrl}/v1/chat/completions`;

  const messages: any[] = [];
  
  // Add system prompt if provided
  if (params.systemPrompt) {
    messages.push({
      role: 'system',
      content: params.systemPrompt
    });
  }

  // Add conversation messages
  messages.push(...params.messages.map(m => ({
    role: m.role,
    content: m.content
  })));

  const body: any = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7
  };

  if (config.maxTokens) {
    body.max_tokens = config.maxTokens;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  // Add Authorization header if API key is present
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  try {
    console.log(`[LocalLLM] Calling custom HTTP at ${baseUrl} with model "${config.model}"`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[LocalLLM] Custom HTTP ${response.status}: ${errorText}`);
      return { ok: false, error: 'local_llm_request_failed' };
    }

    const data = await response.json();

    // OpenAI-style response format: { choices: [{ message: { role, content } }] }
    const messageContent = data?.choices?.[0]?.message?.content;
    
    if (typeof messageContent === 'string' && messageContent.trim()) {
      console.log(`[LocalLLM] Received ${messageContent.length} chars from custom HTTP`);
      return { ok: true, message: messageContent.trim() };
    }

    console.warn('[LocalLLM] Custom HTTP response missing content:', Object.keys(data));
    return { ok: false, error: 'local_llm_invalid_response' };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[LocalLLM] Custom HTTP request timeout');
      return { ok: false, error: 'local_llm_timeout' };
    }

    console.error('[LocalLLM] Custom HTTP request failed:', error);
    return { ok: false, error: 'local_llm_connection_failed' };
  }
}

/**
 * Query the configured local LLM
 */
export async function callLocalLlm(params: LocalLlmQueryParams): Promise<LocalLlmResult> {
  const settings = loadSettings();
  
  if (!settings?.integrations?.localLLM) {
    return { ok: false, error: 'local_llm_not_configured' };
  }

  const config = settings.integrations.localLLM;

  if (!config.enabled || !config.baseUrl || !config.model) {
    return { ok: false, error: 'local_llm_not_configured' };
  }

  // Route to appropriate provider
  switch (config.provider) {
    case 'ollama':
      return callOllama(config, params);
    case 'custom-http':
      return callCustomHttp(config, params);
    default:
      console.error(`[LocalLLM] Unknown provider: ${config.provider}`);
      return { ok: false, error: 'local_llm_invalid_provider' };
  }
}
