# Agent C: Smart Home Integration, Camera Settings Enhancement & Lockdown Mode

## Overview

This document outlines the implementation plan for integrating smart home devices (Alexa, iRobot, Nest, smart lights), enhancing camera settings UI, and implementing a security lockdown mode for J.A.R.V.I.S. v6.0.0.

## Current System Analysis

### Existing Architecture
- **Version**: J.A.R.V.I.S. v6.0.0
- **Integration Pattern**: Client-based architecture with TypeScript clients in `apps/server/src/clients/`
- **Settings Management**: Centralized configuration in `packages/shared/src/integrations.ts` with UI in `apps/web/app/settings/page.tsx`
- **Camera System**: WebRTC streaming, motion detection backend, Socket.io real-time communication
- **Notification System**: Real-time SSE streaming with 6 notification types including `camera_alert`

### Existing Camera Capabilities
- ✅ Camera permissions management (`CameraSettings.tsx`)
- ✅ Live WebRTC streaming
- ✅ Security dashboard with camera grid
- ✅ Backend motion detection with notifications
- ✅ Camera connect/disconnect events
- ✅ Remote capture via voice commands

### Integration Pattern Reference
- **Examples**: Spotify, Gmail, Google Calendar, Weather, ElevenLabs, Azure TTS
- **Structure**: Config interfaces → Client modules → Server routes → Test functions → Settings UI

## Implementation Plan

### Phase 1: Smart Home Integration Foundation

#### 1.1 Add Integration Types and Interfaces
**Files**: `packages/shared/src/integrations.ts`, `packages/shared/src/types.ts`

**Changes to `integrations.ts`**:
```typescript
export type IntegrationId =
  | 'weather'
  | 'webSearch'
  | 'localLLM'
  | 'elevenLabs'
  | 'azureTTS'
  | 'spotify'
  | 'gmail'
  | 'googleCalendar'
  | 'alexa'        // NEW
  | 'irobot'       // NEW
  | 'nest'         // NEW
  | 'smartLights'; // NEW

// Alexa Smart Home Skill API
export interface AlexaIntegrationConfig {
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  region: string | null; // e.g., "NA" (North America)
}

// iRobot Home API
export interface IRobotIntegrationConfig {
  enabled: boolean;
  username: string | null; // iRobot account email
  password: string | null; // iRobot account password
  robotId: string | null;  // Optional: specific robot ID to control
}

// Google Nest Device Access API
export interface NestIntegrationConfig {
  enabled: boolean;
  projectId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  deviceId: string | null; // Thermostat device ID
}

// Smart Lights (Philips Hue, LIFX, Generic)
export interface SmartLightsIntegrationConfig {
  enabled: boolean;
  provider: 'hue' | 'lifx' | 'generic';
  apiKey: string | null;
  bridgeIp: string | null; // For Philips Hue bridge
}

// Update IntegrationSettings
export interface IntegrationSettings {
  // ... existing integrations
  alexa: AlexaIntegrationConfig;
  irobot: IRobotIntegrationConfig;
  nest: NestIntegrationConfig;
  smartLights: SmartLightsIntegrationConfig;
}

// Update defaultIntegrationSettings
export const defaultIntegrationSettings: IntegrationSettings = {
  // ... existing defaults
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

// Update integrationMetadata
export const integrationMetadata: Record<IntegrationId, IntegrationMetadata> = {
  // ... existing metadata
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
    description: 'Control iRobot vacuum cleaners',
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
    description: 'Control smart lighting systems (Hue, LIFX)',
    requiresApiKey: true,
    comingSoon: false
  }
};

// Update isIntegrationConnected
export function isIntegrationConnected(
  id: IntegrationId,
  config: IntegrationSettings[IntegrationId]
): boolean {
  // ... existing checks
  
  if (id === 'alexa') {
    const cfg = config as AlexaIntegrationConfig;
    return !!(cfg.enabled && cfg.clientId && cfg.clientSecret && cfg.refreshToken);
  }
  
  if (id === 'irobot') {
    const cfg = config as IRobotIntegrationConfig;
    return !!(cfg.enabled && cfg.username && cfg.password);
  }
  
  if (id === 'nest') {
    const cfg = config as NestIntegrationConfig;
    return !!(cfg.enabled && cfg.projectId && cfg.clientId && cfg.clientSecret && cfg.refreshToken);
  }
  
  if (id === 'smartLights') {
    const cfg = config as SmartLightsIntegrationConfig;
    return !!(cfg.enabled && cfg.apiKey);
  }
  
  return false;
}
```

**Changes to `types.ts`** (Camera & Security):
```typescript
// Camera Settings Configuration
export interface CameraSettings {
  cameraId: string;
  enabled: boolean;
  friendlyName: string;
  motionDetection: {
    enabled: boolean;
    sensitivity: number; // 1-100
    cooldownSeconds: number; // seconds between alerts
  };
  motionZones?: MotionZone[]; // future feature
}

export interface MotionZone {
  id: string;
  name: string;
  enabled: boolean;
  coordinates: { x: number; y: number; width: number; height: number };
}

// Lockdown Mode State
export interface LockdownState {
  active: boolean;
  activatedAt: number | null;
  activatedBy: 'manual' | 'auto' | null;
  features: {
    doorsLocked: boolean;
    alarmArmed: boolean;
    camerasSecured: boolean;
  };
}
```

#### 1.2 Create Smart Home Client Modules
**Directory**: `apps/server/src/clients/`

**1. `alexaClient.ts`**: Amazon Alexa Smart Home Skill API
```typescript
/**
 * Alexa Smart Home Client
 * 
 * Interface for Alexa Smart Home Skill API
 * Provides device discovery and control
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
    console.error('[Alexa] Token fetch failed:', error);
    throw new Error(`Alexa token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return accessToken!;
}

/**
 * Discover Alexa-enabled devices
 */
export async function discoverDevices(cfg: AlexaConfig): Promise<AlexaDevice[]> {
  const token = await fetchAccessToken(cfg);

  console.log('[Alexa] Discovering devices');

  const response = await fetch('https://api.amazonalexa.com/v1/devices', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
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
    console.error('[Alexa] Device control failed:', error);
    throw new Error(`Alexa device control failed: ${response.status}`);
  }

  return response.json();
}

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
```

**2. `irobotClient.ts`**: iRobot Home API
```typescript
/**
 * iRobot Client
 * 
 * Interface for iRobot Home API
 * Controls Roomba and other iRobot devices
 */

export interface IRobotConfig {
  username: string;
  password: string;
  robotId?: string | null;
}

export interface IRobotDevice {
  id: string;
  name: string;
  model: string;
  firmwareVersion: string;
  batteryLevel: number;
  status: 'idle' | 'cleaning' | 'charging' | 'paused' | 'error';
  connected: boolean;
}

let authToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Authenticate with iRobot API
 */
async function authenticate(cfg: IRobotConfig): Promise<string> {
  const now = Date.now();
  if (authToken && tokenExpiresAt > now + 60000) {
    return authToken;
  }

  console.log('[iRobot] Authenticating');

  const response = await fetch('https://unauth2.prod.iot.irobotapi.com/v2/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: cfg.username,
      password: cfg.password
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[iRobot] Authentication failed:', error);
    throw new Error(`iRobot authentication failed: ${response.status}`);
  }

  const data = await response.json();
  authToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return authToken!;
}

/**
 * Get list of robots
 */
export async function getRobots(cfg: IRobotConfig): Promise<IRobotDevice[]> {
  const token = await authenticate(cfg);

  console.log('[iRobot] Fetching robot list');

  const response = await fetch('https://unauth2.prod.iot.irobotapi.com/v2/robots', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`iRobot robot list failed: ${response.status}`);
  }

  const data = await response.json();

  const robots: IRobotDevice[] = [];
  if (data.robots && Array.isArray(data.robots)) {
    for (const robot of data.robots) {
      robots.push({
        id: robot.id,
        name: robot.name || `Robot ${robot.id.slice(0, 8)}`,
        model: robot.sku || 'Unknown',
        firmwareVersion: robot.softwareVer || 'Unknown',
        batteryLevel: robot.batPct || 0,
        status: parseRobotStatus(robot.cleanMissionStatus?.phase),
        connected: robot.connected === true
      });
    }
  }

  console.log(`[iRobot] Found ${robots.length} robots`);
  return robots;
}

/**
 * Start cleaning mission
 */
export async function startCleaning(cfg: IRobotConfig, robotId?: string): Promise<void> {
  const token = await authenticate(cfg);
  const id = robotId || cfg.robotId;

  if (!id) {
    throw new Error('Robot ID is required');
  }

  console.log(`[iRobot] Starting cleaning mission for robot ${id}`);

  const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: 'start' })
  });

  if (!response.ok) {
    throw new Error(`iRobot start cleaning failed: ${response.status}`);
  }
}

/**
 * Pause cleaning mission
 */
export async function pauseCleaning(cfg: IRobotConfig, robotId?: string): Promise<void> {
  const token = await authenticate(cfg);
  const id = robotId || cfg.robotId;

  if (!id) {
    throw new Error('Robot ID is required');
  }

  console.log(`[iRobot] Pausing cleaning mission for robot ${id}`);

  const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: 'pause' })
  });

  if (!response.ok) {
    throw new Error(`iRobot pause cleaning failed: ${response.status}`);
  }
}

/**
 * Return to dock
 */
export async function returnToDock(cfg: IRobotConfig, robotId?: string): Promise<void> {
  const token = await authenticate(cfg);
  const id = robotId || cfg.robotId;

  if (!id) {
    throw new Error('Robot ID is required');
  }

  console.log(`[iRobot] Sending robot ${id} to dock`);

  const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: 'dock' })
  });

  if (!response.ok) {
    throw new Error(`iRobot return to dock failed: ${response.status}`);
  }
}

function parseRobotStatus(phase?: string): IRobotDevice['status'] {
  if (!phase) return 'idle';
  const lower = phase.toLowerCase();
  if (lower.includes('run') || lower.includes('clean')) return 'cleaning';
  if (lower.includes('charge')) return 'charging';
  if (lower.includes('pause') || lower.includes('stop')) return 'paused';
  if (lower.includes('error') || lower.includes('stuck')) return 'error';
  return 'idle';
}
```

**3. `nestClient.ts`**: Google Nest Device Access API
```typescript
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
  currentTemperature: number;
  targetTemperature: number;
  mode: 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF';
  hvacStatus: 'OFF' | 'HEATING' | 'COOLING';
  humidity: number;
}

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
    console.error('[Nest] Token fetch failed:', error);
    throw new Error(`Nest token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return accessToken!;
}

/**
 * Get thermostat devices
 */
export async function getDevices(cfg: NestConfig): Promise<NestThermostat[]> {
  const token = await fetchAccessToken(cfg);

  console.log('[Nest] Fetching devices');

  const response = await fetch(
    `https://smartdevicemanagement.googleapis.com/v1/enterprises/${cfg.projectId}/devices`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Nest device fetch failed: ${response.status}`);
  }

  const data = await response.json();

  const thermostats: NestThermostat[] = [];
  if (data.devices && Array.isArray(data.devices)) {
    for (const device of data.devices) {
      if (device.type?.includes('THERMOSTAT')) {
        const traits = device.traits || {};
        thermostats.push({
          id: device.name.split('/').pop(),
          name: traits['sdm.devices.traits.Info']?.customName || 'Thermostat',
          currentTemperature: traits['sdm.devices.traits.Temperature']?.ambientTemperatureCelsius || 0,
          targetTemperature: traits['sdm.devices.traits.ThermostatTemperatureSetpoint']?.heatCelsius || 0,
          mode: traits['sdm.devices.traits.ThermostatMode']?.mode || 'OFF',
          hvacStatus: traits['sdm.devices.traits.ThermostatHvac']?.status || 'OFF',
          humidity: traits['sdm.devices.traits.Humidity']?.ambientHumidityPercent || 0
        });
      }
    }
  }

  console.log(`[Nest] Found ${thermostats.length} thermostats`);
  return thermostats;
}

/**
 * Set thermostat temperature
 */
export async function setTemperature(
  cfg: NestConfig,
  temperature: number,
  deviceId?: string
): Promise<void> {
  const token = await fetchAccessToken(cfg);
  const id = deviceId || cfg.deviceId;

  if (!id) {
    throw new Error('Device ID is required');
  }

  console.log(`[Nest] Setting temperature to ${temperature}°C for device ${id}`);

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
        params: { heatCelsius: temperature }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Nest set temperature failed: ${response.status}`);
  }
}
```

**4. `smartLightsClient.ts`**: Unified Smart Lights Interface
```typescript
/**
 * Smart Lights Client
 * 
 * Unified interface for smart lighting systems
 * Supports Philips Hue, LIFX, and generic HTTP lights
 */

export interface SmartLightsConfig {
  provider: 'hue' | 'lifx' | 'generic';
  apiKey: string;
  bridgeIp?: string | null; // For Philips Hue
}

export interface SmartLight {
  id: string;
  name: string;
  on: boolean;
  brightness: number; // 0-100
  color?: { r: number; g: number; b: number };
  reachable: boolean;
}

/**
 * Discover lights based on provider
 */
export async function discoverLights(cfg: SmartLightsConfig): Promise<SmartLight[]> {
  switch (cfg.provider) {
    case 'hue':
      return discoverHueLights(cfg);
    case 'lifx':
      return discoverLIFXLights(cfg);
    case 'generic':
      return []; // Generic provider doesn't support discovery
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

/**
 * Set light state
 */
export async function setLightState(
  cfg: SmartLightsConfig,
  lightId: string,
  state: { on?: boolean; brightness?: number; color?: { r: number; g: number; b: number } }
): Promise<void> {
  switch (cfg.provider) {
    case 'hue':
      return setHueLightState(cfg, lightId, state);
    case 'lifx':
      return setLIFXLightState(cfg, lightId, state);
    case 'generic':
      throw new Error('Generic provider not implemented');
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

/**
 * Toggle light on/off
 */
export async function toggleLight(cfg: SmartLightsConfig, lightId: string): Promise<void> {
  console.log(`[SmartLights] Toggling light ${lightId}`);
  const lights = await discoverLights(cfg);
  const light = lights.find(l => l.id === lightId);
  if (!light) {
    throw new Error(`Light ${lightId} not found`);
  }
  await setLightState(cfg, lightId, { on: !light.on });
}

// Philips Hue implementation
async function discoverHueLights(cfg: SmartLightsConfig): Promise<SmartLight[]> {
  if (!cfg.bridgeIp) {
    throw new Error('Bridge IP is required for Philips Hue');
  }

  console.log('[Hue] Discovering lights');

  const response = await fetch(`http://${cfg.bridgeIp}/api/${cfg.apiKey}/lights`);

  if (!response.ok) {
    throw new Error(`Hue discovery failed: ${response.status}`);
  }

  const data = await response.json();

  const lights: SmartLight[] = [];
  for (const [id, light] of Object.entries<any>(data)) {
    lights.push({
      id,
      name: light.name,
      on: light.state.on,
      brightness: Math.round((light.state.bri / 254) * 100),
      reachable: light.state.reachable
    });
  }

  console.log(`[Hue] Found ${lights.length} lights`);
  return lights;
}

async function setHueLightState(
  cfg: SmartLightsConfig,
  lightId: string,
  state: { on?: boolean; brightness?: number }
): Promise<void> {
  if (!cfg.bridgeIp) {
    throw new Error('Bridge IP is required for Philips Hue');
  }

  console.log(`[Hue] Setting light ${lightId} state`);

  const body: any = {};
  if (state.on !== undefined) body.on = state.on;
  if (state.brightness !== undefined) body.bri = Math.round((state.brightness / 100) * 254);

  const response = await fetch(`http://${cfg.bridgeIp}/api/${cfg.apiKey}/lights/${lightId}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Hue set state failed: ${response.status}`);
  }
}

// LIFX implementation
async function discoverLIFXLights(cfg: SmartLightsConfig): Promise<SmartLight[]> {
  console.log('[LIFX] Discovering lights');

  const response = await fetch('https://api.lifx.com/v1/lights/all', {
    headers: { 'Authorization': `Bearer ${cfg.apiKey}` }
  });

  if (!response.ok) {
    throw new Error(`LIFX discovery failed: ${response.status}`);
  }

  const data = await response.json();

  const lights: SmartLight[] = [];
  for (const light of data) {
    lights.push({
      id: light.id,
      name: light.label,
      on: light.power === 'on',
      brightness: Math.round(light.brightness * 100),
      color: light.color ? {
        r: Math.round(light.color.hue / 360 * 255),
        g: Math.round(light.color.saturation * 255),
        b: Math.round(light.brightness * 255)
      } : undefined,
      reachable: light.connected
    });
  }

  console.log(`[LIFX] Found ${lights.length} lights`);
  return lights;
}

async function setLIFXLightState(
  cfg: SmartLightsConfig,
  lightId: string,
  state: { on?: boolean; brightness?: number }
): Promise<void> {
  console.log(`[LIFX] Setting light ${lightId} state`);

  if (state.on !== undefined) {
    const power = state.on ? 'on' : 'off';
    await fetch(`https://api.lifx.com/v1/lights/id:${lightId}/state`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ power })
    });
  }

  if (state.brightness !== undefined) {
    await fetch(`https://api.lifx.com/v1/lights/id:${lightId}/state`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ brightness: state.brightness / 100 })
    });
  }
}
```

### Phase 2: Server Routes and API Endpoints

*[Continue with detailed implementation for remaining phases...]*

---

## Testing Strategy

### Unit Tests
- Test each client module independently with mock APIs
- Validate token refresh flows
- Test error handling and timeouts

### Integration Tests
- Test full authentication flows with real credentials (in dev environment)
- Verify device discovery and control commands
- Test voice command integration

### Manual Testing Checklist
- [ ] Configure all smart home integrations in Settings
- [ ] Test connection for each integration
- [ ] Verify device discovery for each provider
- [ ] Test device control via UI
- [ ] Test voice commands for each device type
- [ ] Verify camera settings modifications
- [ ] Test motion detection with different sensitivity values
- [ ] Test lockdown mode activation/deactivation
- [ ] Verify notifications during lockdown mode
- [ ] Test smart home control dashboard

## Security Considerations

1. **API Keys**: Store in server-side encrypted storage (existing pattern)
2. **Refresh Tokens**: Implement token rotation for OAuth flows
3. **Network Security**: All API calls from server, not client
4. **Lockdown Mode**: Require manual confirmation for activation
5. **Camera Access**: Respect camera permission settings

## Future Enhancements

1. Motion zone editing with canvas overlay
2. RTSP stream support for IP cameras
3. Advanced automation rules (e.g., "When motion detected at night, turn on lights")
4. Smart lock integration for lockdown mode
5. Integration with home alarm systems
6. Voice-activated lockdown mode with confirmation
7. Geofencing for automatic home/away modes
8. Energy usage tracking for smart devices

## Timeline Estimate

- Phase 1: Integration Foundation - 2-3 days
- Phase 2: Server Routes - 1-2 days
- Phase 3: Frontend Integration - 2-3 days
- Phase 4: Testing & Polish - 1-2 days

**Total**: 6-10 days for full implementation

## Dependencies

- No new npm packages required (using existing `undici` for HTTP requests)
- Developer accounts needed for:
  - Amazon Alexa Developer Console
  - iRobot account
  - Google Cloud Console (for Nest)
  - Philips Hue Bridge or LIFX account

---

## Notes

- All integrations follow the existing pattern established by Spotify, Gmail, etc.
- Smart home clients are server-side only for security
- Camera settings stored in JSON file (similar to existing settings)
- Lockdown mode state is in-memory initially (can be persisted later)
- Motion zones are placeholder UI for future implementation
