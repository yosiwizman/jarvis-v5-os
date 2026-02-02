/**
 * Remote Access Store
 *
 * Persists non-secret remote access configuration:
 * - mode: 'disabled' | 'tailscale'
 * - servePort: port being served (if enabled)
 *
 * SECURITY:
 * - Never stores auth keys or secrets
 * - Only stores operational state
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export type RemoteAccessMode = 'disabled' | 'tailscale';

export interface RemoteAccessConfig {
  mode: RemoteAccessMode;
  servePort?: number;
  enabledAt?: string;
  tailscaleHostname?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'remote-access.json');

const DEFAULT_CONFIG: RemoteAccessConfig = {
  mode: 'disabled',
};

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read remote access configuration
 */
export function getRemoteAccessConfig(): RemoteAccessConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }

    const content = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as RemoteAccessConfig;

    // Validate mode
    if (!['disabled', 'tailscale'].includes(config.mode)) {
      logger.warn({ mode: config.mode }, 'Invalid remote access mode, resetting to disabled');
      return { ...DEFAULT_CONFIG };
    }

    return config;
  } catch (error) {
    logger.error({ error }, 'Failed to read remote access config');
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save remote access configuration
 */
export function saveRemoteAccessConfig(config: Partial<RemoteAccessConfig>): RemoteAccessConfig {
  ensureDataDir();

  const currentConfig = getRemoteAccessConfig();
  const newConfig: RemoteAccessConfig = {
    ...currentConfig,
    ...config,
  };

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    logger.info({ mode: newConfig.mode }, 'Remote access config saved');
    return newConfig;
  } catch (error) {
    logger.error({ error }, 'Failed to save remote access config');
    throw error;
  }
}

/**
 * Enable remote access
 */
export function enableRemoteAccess(
  mode: RemoteAccessMode,
  servePort: number,
  tailscaleHostname?: string
): RemoteAccessConfig {
  return saveRemoteAccessConfig({
    mode,
    servePort,
    enabledAt: new Date().toISOString(),
    tailscaleHostname,
  });
}

/**
 * Disable remote access
 */
export function disableRemoteAccess(): RemoteAccessConfig {
  return saveRemoteAccessConfig({
    mode: 'disabled',
    servePort: undefined,
    enabledAt: undefined,
    tailscaleHostname: undefined,
  });
}

/**
 * Get public config (for status endpoints)
 */
export function getRemoteAccessPublicConfig(): {
  mode: RemoteAccessMode;
  servePort?: number;
  tailscaleHostname?: string;
} {
  const config = getRemoteAccessConfig();
  return {
    mode: config.mode,
    servePort: config.servePort,
    tailscaleHostname: config.tailscaleHostname,
  };
}
