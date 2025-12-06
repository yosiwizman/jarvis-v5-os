/**
 * Web Search Client
 * 
 * Generic HTTP client for web search providers (Tavily, SerpAPI, etc.)
 * Designed to work with any JSON-based search API that accepts queries and returns results.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { AppSettings, WebSearchIntegrationConfig } from '@shared/core';

export interface WebSearchQueryParams {
  query: string;
  maxResults?: number;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchResult =
  | { ok: true; results: WebSearchResultItem[] }
  | { ok: false; error: string };

/**
 * Load server settings to get web search configuration
 */
function loadSettings(): AppSettings | null {
  try {
    const settingsPath = join(process.cwd(), 'apps', 'server', 'data', 'settings.json');
    const raw = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(raw) as AppSettings;
  } catch (error) {
    console.warn('Failed to load settings for web search:', error);
    return null;
  }
}

/**
 * Run a web search query using the configured provider
 */
export async function runWebSearch(params: WebSearchQueryParams): Promise<WebSearchResult> {
  const settings = loadSettings();
  
  if (!settings?.integrations?.webSearch) {
    return { ok: false, error: 'web_search_not_configured' };
  }

  const config = settings.integrations.webSearch as WebSearchIntegrationConfig;

  if (!config.enabled || !config.baseUrl || !config.apiKey) {
    return { ok: false, error: 'web_search_not_configured' };
  }

  // Normalize base URL (remove trailing slashes)
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = `${base}/search`;

  // Prepare request body
  const body = {
    query: params.query,
    max_results: params.maxResults ?? 5,
    ...(config.defaultRegion && { region: config.defaultRegion })
  };

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  try {
    console.log(`[WebSearch] Querying ${base} for: "${params.query.substring(0, 50)}..."`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[WebSearch] HTTP ${response.status}: ${errorText}`);
      return { ok: false, error: 'web_search_request_failed' };
    }

    const data = await response.json();

    // Parse response - try to handle multiple provider formats
    let results: WebSearchResultItem[] = [];

    // Tavily format: { results: [{title, url, content}] }
    if (Array.isArray(data.results)) {
      results = data.results.map((item: any) => ({
        title: item.title || item.name || 'Untitled',
        url: item.url || item.link || '#',
        snippet: item.content || item.snippet || item.description || ''
      }));
    }
    // SerpAPI format: { organic_results: [{title, link, snippet}] }
    else if (Array.isArray(data.organic_results)) {
      results = data.organic_results.map((item: any) => ({
        title: item.title || 'Untitled',
        url: item.link || item.url || '#',
        snippet: item.snippet || item.description || ''
      }));
    }
    // Generic array format
    else if (Array.isArray(data)) {
      results = data.map((item: any) => ({
        title: item.title || item.name || 'Untitled',
        url: item.url || item.link || '#',
        snippet: item.snippet || item.content || item.description || ''
      }));
    }
    else {
      console.warn('[WebSearch] Unknown response format:', Object.keys(data));
      return { ok: false, error: 'web_search_invalid_response' };
    }

    // Limit results
    results = results.slice(0, params.maxResults ?? 5);

    console.log(`[WebSearch] Found ${results.length} results`);
    
    return { ok: true, results };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[WebSearch] Request timeout');
      return { ok: false, error: 'web_search_timeout' };
    }

    console.error('[WebSearch] Request failed:', error);
    return { ok: false, error: 'web_search_request_failed' };
  }
}
