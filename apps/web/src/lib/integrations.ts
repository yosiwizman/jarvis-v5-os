import type {
  WebSearchIntegrationConfig,
  LocalLLMIntegrationConfig,
  ElevenLabsIntegrationConfig,
  AzureTTSIntegrationConfig,
  SpotifyIntegrationConfig,
  AlexaIntegrationConfig,
  IRobotIntegrationConfig,
  NestIntegrationConfig,
  SmartLightsIntegrationConfig
} from '@shared/integrations';
import { buildServerUrl } from './api';

export interface IntegrationTestResult {
  success: boolean;
  message: string;
}

export async function testWebSearchIntegration(
  config: WebSearchIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey) {
    return { success: false, message: 'API key required' };
  }
  return { success: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testLocalLLMIntegration(
  config: LocalLLMIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.baseUrl) {
    return { success: false, message: 'Base URL required' };
  }
  return { success: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testElevenLabsIntegration(
  config: ElevenLabsIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey) {
    return { success: false, message: 'API key required' };
  }
  return { success: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testAzureTTSIntegration(
  config: AzureTTSIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.apiKey || !config.region) {
    return { success: false, message: 'API key and region required' };
  }
  return { success: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testSpotifyIntegration(
  config: SpotifyIntegrationConfig
): Promise<IntegrationTestResult> {
  // Stub - real implementation coming soon
  if (!config.clientId || !config.clientSecret) {
    return { success: false, message: 'Client ID and secret required' };
  }
  return { success: true, message: 'Test stub – real integration not implemented yet' };
}

export async function testAlexaIntegration(
  config: AlexaIntegrationConfig
): Promise<IntegrationTestResult> {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    return { success: false, message: 'Client ID, Client Secret, and Refresh Token required' };
  }

  try {
    const response = await fetch(buildServerUrl('/api/smarthome/alexa/test'));
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
  }
}

export async function testIRobotIntegration(
  config: IRobotIntegrationConfig
): Promise<IntegrationTestResult> {
  if (!config.username || !config.password) {
    return { success: false, message: 'Username and Password required' };
  }

  try {
    const response = await fetch(buildServerUrl('/api/smarthome/irobot/test'));
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
  }
}

export async function testNestIntegration(
  config: NestIntegrationConfig
): Promise<IntegrationTestResult> {
  if (!config.projectId || !config.clientId || !config.clientSecret || !config.refreshToken) {
    return { success: false, message: 'Project ID, Client ID, Client Secret, and Refresh Token required' };
  }

  try {
    const response = await fetch(buildServerUrl('/api/smarthome/nest/test'));
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
  }
}

export async function testSmartLightsIntegration(
  config: SmartLightsIntegrationConfig
): Promise<IntegrationTestResult> {
  if (!config.apiKey) {
    return { success: false, message: 'API Key required' };
  }

  if (config.provider === 'hue' && !config.bridgeIp) {
    return { success: false, message: 'Bridge IP required for Philips Hue' };
  }

  try {
    const response = await fetch(buildServerUrl('/api/smarthome/lights/test'));
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
  }
}
