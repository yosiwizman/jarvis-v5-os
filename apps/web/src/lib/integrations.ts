import type {
  WebSearchIntegrationConfig,
  LocalLLMIntegrationConfig,
  ElevenLabsIntegrationConfig,
  AzureTTSIntegrationConfig,
  SpotifyIntegrationConfig
} from '@shared/integrations';

export interface IntegrationTestResult {
  ok: boolean;
  message?: string;
}

export async function testWebSearchIntegration(
  config: WebSearchIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey) {
    return { ok: false, message: 'API key required' };
  }
  return { ok: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testLocalLLMIntegration(
  config: LocalLLMIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.baseUrl) {
    return { ok: false, message: 'Base URL required' };
  }
  return { ok: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testElevenLabsIntegration(
  config: ElevenLabsIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey) {
    return { ok: false, message: 'API key required' };
  }
  return { ok: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testAzureTTSIntegration(
  config: AzureTTSIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey || !config.region) {
    return { ok: false, message: 'API key and region required' };
  }
  return { ok: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testSpotifyIntegration(
  config: SpotifyIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.clientId || !config.clientSecret) {
    return { ok: false, message: 'Client ID and secret required' };
  }
  return { ok: true, message: 'Test stub – real integration not implemented yet' };
}
