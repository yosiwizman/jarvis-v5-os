/**
 * Smart Lights Client
 * 
 * Unified interface for smart lighting systems
 * Supports Philips Hue and LIFX
 */

export interface SmartLightsConfig {
  provider: 'hue' | 'lifx' | 'generic';
  apiKey: string;        // Hue username or LIFX token
  bridgeIp?: string | null; // Required for Hue
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
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

/**
 * Set light state (on/off, brightness, optional color)
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
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

/**
 * Toggle light on/off
 */
export async function toggleLight(cfg: SmartLightsConfig, lightId: string): Promise<void> {
  const lights = await discoverLights(cfg);
  const light = lights.find(l => l.id === lightId);
  if (!light) throw new Error(`Light ${lightId} not found`);
  await setLightState(cfg, lightId, { on: !light.on });
}

/**
 * Schedule a light action after delay (simple mock scheduler)
 */
export async function scheduleLight(
  cfg: SmartLightsConfig,
  lightId: string,
  inSeconds: number,
  state: { on?: boolean; brightness?: number }
): Promise<{ scheduled: boolean; eta: number }> {
  // NOTE: For a real implementation tie into cron/persistent scheduler.
  setTimeout(() => {
    setLightState(cfg, lightId, state).catch(err => console.error('[SmartLights] Scheduled action failed:', err));
  }, Math.max(0, inSeconds) * 1000);
  return { scheduled: true, eta: Date.now() + inSeconds * 1000 };
}

// Philips Hue implementation
async function discoverHueLights(cfg: SmartLightsConfig): Promise<SmartLight[]> {
  if (!cfg.bridgeIp) throw new Error('Bridge IP is required for Philips Hue');
  const response = await fetch(`http://${cfg.bridgeIp}/api/${cfg.apiKey}/lights`);
  if (!response.ok) throw new Error(`Hue discovery failed: ${response.status}`);
  const data = await response.json();
  const lights: SmartLight[] = [];
  for (const [id, light] of Object.entries<any>(data)) {
    lights.push({
      id,
      name: light.name,
      on: !!light.state.on,
      brightness: Math.round(((light.state.bri ?? 0) / 254) * 100),
      reachable: !!light.state.reachable
    });
  }
  return lights;
}

async function setHueLightState(
  cfg: SmartLightsConfig,
  lightId: string,
  state: { on?: boolean; brightness?: number; color?: { r: number; g: number; b: number } }
): Promise<void> {
  if (!cfg.bridgeIp) throw new Error('Bridge IP is required for Philips Hue');
  const body: any = {};
  if (state.on !== undefined) body.on = state.on;
  if (state.brightness !== undefined) body.bri = Math.round((state.brightness / 100) * 254);
  // Color conversion to Hue XY is non-trivial; omit for initial version.
  const response = await fetch(`http://${cfg.bridgeIp}/api/${cfg.apiKey}/lights/${lightId}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Hue set state failed: ${response.status}`);
}

// LIFX implementation
async function discoverLIFXLights(cfg: SmartLightsConfig): Promise<SmartLight[]> {
  const response = await fetch('https://api.lifx.com/v1/lights/all', {
    headers: { 'Authorization': `Bearer ${cfg.apiKey}` }
  });
  if (!response.ok) throw new Error(`LIFX discovery failed: ${response.status}`);
  const data = await response.json();
  const lights: SmartLight[] = [];
  for (const light of data) {
    lights.push({
      id: light.id,
      name: light.label,
      on: light.power === 'on',
      brightness: Math.round((light.brightness ?? 0) * 100),
      color: light.color ? {
        r: Math.round((light.color.hue / 360) * 255),
        g: Math.round((light.color.saturation ?? 0) * 255),
        b: Math.round((light.brightness ?? 0) * 255)
      } : undefined,
      reachable: !!light.connected
    });
  }
  return lights;
}

async function setLIFXLightState(
  cfg: SmartLightsConfig,
  lightId: string,
  state: { on?: boolean; brightness?: number; color?: { r: number; g: number; b: number } }
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json'
  } as const;

  if (state.on !== undefined) {
    const power = state.on ? 'on' : 'off';
    const res = await fetch(`https://api.lifx.com/v1/lights/id:${lightId}/state`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ power })
    });
    if (!res.ok) throw new Error(`LIFX power set failed: ${res.status}`);
  }

  if (state.brightness !== undefined) {
    const res = await fetch(`https://api.lifx.com/v1/lights/id:${lightId}/state`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ brightness: Math.max(0, Math.min(1, state.brightness / 100)) })
    });
    if (!res.ok) throw new Error(`LIFX brightness set failed: ${res.status}`);
  }

  // Color setting via RGB -> HSB conversion skipped for brevity.
}
