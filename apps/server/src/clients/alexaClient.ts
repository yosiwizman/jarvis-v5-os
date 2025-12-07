/**
 * Alexa Smart Home Client
 * 
 * Interface for Alexa Smart Home Skill API
 * Provides device discovery and control via OAuth2
 */

export interface AlexaConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region?: string;
}

export interface AlexaDevice {
  id: string;
  name: string;
  type: 'light' | 'switch' | 'thermostat' | 'lock' | 'other';
  capabilities: string[];
  online: boolean;
}

// Module-level token cache
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Fetch access token using refresh token
 */
async function fetchAccessToken(cfg: AlexaConfig): Promise<string> {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now + 60000) {
    return accessToken;
  }

  console.log('[Alexa] Fetching access token via refresh token');

  try {
    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Alexa] Token fetch failed:', error.substring(0, 200));
      throw new Error(`Alexa token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Alexa token response missing access_token');
    }

    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);

    console.log(`[Alexa] Token cached, expires in ${Math.floor((data.expires_in || 3600) / 60)} minutes`);

    return accessToken!;
  } catch (error) {
    console.error('[Alexa] Token fetch error:', (error as Error).message);
    throw error;
  }
}

/**
 * Discover Alexa-enabled devices
 */
export async function discoverDevices(cfg: AlexaConfig): Promise<AlexaDevice[]> {
  const token = await fetchAccessToken(cfg);

  console.log('[Alexa] Discovering devices');

  try {
    const response = await fetch('https://api.amazonalexa.com/v1/devices', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Alexa] Device discovery failed:', error.substring(0, 200));
      throw new Error(`Alexa device discovery failed: ${response.status}`);
    }

    const data = await response.json();

    // Parse and return devices
    const devices: AlexaDevice[] = [];
    if (data.endpoints && Array.isArray(data.endpoints)) {
      for (const endpoint of data.endpoints) {
        devices.push({
          id: endpoint.endpointId,
          name: endpoint.friendlyName || endpoint.endpointId,
          type: parseDeviceType(endpoint.displayCategories?.[0]),
          capabilities: endpoint.capabilities?.map((c: any) => c.interface) || [],
          online: endpoint.connectivity?.value === 'OK'
        });
      }
    }

    console.log(`[Alexa] Discovered ${devices.length} devices`);
    return devices;
  } catch (error) {
    console.error('[Alexa] Device discovery error:', (error as Error).message);
    throw error;
  }
}

/**
 * Control an Alexa device
 */
export async function controlDevice(
  cfg: AlexaConfig,
  deviceId: string,
  command: { directive: string; namespace: string; payload?: any }
): Promise<any> {
  const token = await fetchAccessToken(cfg);

  console.log(`[Alexa] Controlling device ${deviceId}: ${command.directive}`);

  try {
    const response = await fetch('https://api.amazonalexa.com/v3/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: {
          header: {
            namespace: command.namespace,
            name: command.directive,
            messageId: generateMessageId(),
            payloadVersion: '3'
          },
          endpoint: { endpointId: deviceId },
          payload: command.payload || {}
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Alexa] Device control failed:', error.substring(0, 200));
      throw new Error(`Alexa device control failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('[Alexa] Device control error:', (error as Error).message);
    throw error;
  }
}

/**
 * Get device state
 */
export async function getDeviceState(
  cfg: AlexaConfig,
  deviceId: string
): Promise<any> {
  const token = await fetchAccessToken(cfg);

  console.log(`[Alexa] Getting device state for ${deviceId}`);

  try {
    const response = await fetch(`https://api.amazonalexa.com/v1/devices/${deviceId}/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Alexa] Get device state failed:', error.substring(0, 200));
      throw new Error(`Alexa get device state failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('[Alexa] Get device state error:', (error as Error).message);
    throw error;
  }
}

/**
 * Test connection to Alexa API
 */
export async function testConnection(cfg: AlexaConfig): Promise<{ ok: boolean; message?: string }> {
  try {
    await fetchAccessToken(cfg);
    const devices = await discoverDevices(cfg);
    return { 
      ok: true, 
      message: `Connected successfully. Found ${devices.length} device(s).` 
    };
  } catch (error) {
    return { 
      ok: false, 
      message: (error as Error).message 
    };
  }
}

// Helper functions

function parseDeviceType(category?: string): AlexaDevice['type'] {
  if (!category) return 'other';
  const lower = category.toLowerCase();
  if (lower.includes('light')) return 'light';
  if (lower.includes('switch')) return 'switch';
  if (lower.includes('thermostat')) return 'thermostat';
  if (lower.includes('lock')) return 'lock';
  return 'other';
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
