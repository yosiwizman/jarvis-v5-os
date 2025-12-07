/**
 * Nest Client
 * 
 * Interface for Google Nest Device Access API
 * Controls Nest thermostats and devices
 */

export interface NestConfig {
  projectId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  deviceId?: string | null;
}

export interface NestThermostat {
  id: string;
  name: string;
  currentTemperature: number;  // Celsius
  targetTemperature: number;   // Celsius
  mode: 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF';
  hvacStatus: 'OFF' | 'HEATING' | 'COOLING';
  humidity: number;
}

// Module-level token cache
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Fetch access token using refresh token
 */
async function fetchAccessToken(cfg: NestConfig): Promise<string> {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now + 60000) {
    return accessToken;
  }

  console.log('[Nest] Fetching access token');

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
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
      console.error('[Nest] Token fetch failed:', error.substring(0, 200));
      throw new Error(`Nest token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Nest token response missing access_token');
    }

    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);

    console.log(`[Nest] Token cached, expires in ${Math.floor((data.expires_in || 3600) / 60)} minutes`);

    return accessToken!;
  } catch (error) {
    console.error('[Nest] Token fetch error:', (error as Error).message);
    throw error;
  }
}

/**
 * Get thermostat devices
 */
export async function getDevices(cfg: NestConfig): Promise<NestThermostat[]> {
  const token = await fetchAccessToken(cfg);

  console.log('[Nest] Fetching devices');

  try {
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${cfg.projectId}/devices`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Nest] Device fetch failed:', error.substring(0, 200));
      throw new Error(`Nest device fetch failed: ${response.status}`);
    }

    const data = await response.json();

    const thermostats: NestThermostat[] = [];
    if (data.devices && Array.isArray(data.devices)) {
      for (const device of data.devices) {
        if (device.type?.includes('THERMOSTAT')) {
          const traits = device.traits || {};
          thermostats.push({
            id: device.name.split('/').pop() || device.name,
            name: traits['sdm.devices.traits.Info']?.customName || 'Thermostat',
            currentTemperature: traits['sdm.devices.traits.Temperature']?.ambientTemperatureCelsius || 0,
            targetTemperature: traits['sdm.devices.traits.ThermostatTemperatureSetpoint']?.heatCelsius || 
                               traits['sdm.devices.traits.ThermostatTemperatureSetpoint']?.coolCelsius || 0,
            mode: traits['sdm.devices.traits.ThermostatMode']?.mode || 'OFF',
            hvacStatus: traits['sdm.devices.traits.ThermostatHvac']?.status || 'OFF',
            humidity: traits['sdm.devices.traits.Humidity']?.ambientHumidityPercent || 0
          });
        }
      }
    }

    console.log(`[Nest] Found ${thermostats.length} thermostats`);
    return thermostats;
  } catch (error) {
    console.error('[Nest] Get devices error:', (error as Error).message);
    throw error;
  }
}

/**
 * Set thermostat temperature
 */
export async function setTemperature(
  cfg: NestConfig,
  temperature: number,
  deviceId?: string,
  unit: 'C' | 'F' = 'C'
): Promise<void> {
  const token = await fetchAccessToken(cfg);
  const id = deviceId || cfg.deviceId;

  if (!id) {
    throw new Error('Device ID is required');
  }

  // Convert Fahrenheit to Celsius if needed
  const tempCelsius = unit === 'F' ? (temperature - 32) * (5 / 9) : temperature;

  console.log(`[Nest] Setting temperature to ${temperature}°${unit} (${tempCelsius.toFixed(1)}°C) for device ${id}`);

  try {
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${cfg.projectId}/devices/${id}:executeCommand`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
          params: { heatCelsius: tempCelsius }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Nest] Set temperature failed:', error.substring(0, 200));
      throw new Error(`Nest set temperature failed: ${response.status}`);
    }

    console.log(`[Nest] Temperature set successfully`);
  } catch (error) {
    console.error('[Nest] Set temperature error:', (error as Error).message);
    throw error;
  }
}

/**
 * Set thermostat mode
 */
export async function setMode(
  cfg: NestConfig,
  mode: 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF',
  deviceId?: string
): Promise<void> {
  const token = await fetchAccessToken(cfg);
  const id = deviceId || cfg.deviceId;

  if (!id) {
    throw new Error('Device ID is required');
  }

  console.log(`[Nest] Setting mode to ${mode} for device ${id}`);

  try {
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${cfg.projectId}/devices/${id}:executeCommand`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.ThermostatMode.SetMode',
          params: { mode }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Nest] Set mode failed:', error.substring(0, 200));
      throw new Error(`Nest set mode failed: ${response.status}`);
    }

    console.log(`[Nest] Mode set successfully`);
  } catch (error) {
    console.error('[Nest] Set mode error:', (error as Error).message);
    throw error;
  }
}

/**
 * Get thermostat state
 */
export async function getThermostatState(cfg: NestConfig, deviceId?: string): Promise<NestThermostat | null> {
  const thermostats = await getDevices(cfg);
  const id = deviceId || cfg.deviceId;
  
  if (!id) {
    return thermostats[0] || null;
  }
  
  return thermostats.find(t => t.id === id) || null;
}

/**
 * Test connection to Nest API
 */
export async function testConnection(cfg: NestConfig): Promise<{ ok: boolean; message?: string }> {
  try {
    await fetchAccessToken(cfg);
    const devices = await getDevices(cfg);
    return { 
      ok: true, 
      message: `Connected successfully. Found ${devices.length} thermostat(s).` 
    };
  } catch (error) {
    return { 
      ok: false, 
      message: (error as Error).message 
    };
  }
}
