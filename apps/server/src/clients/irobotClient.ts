/**
 * iRobot Client
 * 
 * Interface for iRobot Home API
 * Controls Roomba and other iRobot vacuum devices
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

// Module-level token cache
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

  try {
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
      console.error('[iRobot] Authentication failed:', error.substring(0, 200));
      throw new Error(`iRobot authentication failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('iRobot response missing access_token');
    }

    authToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);

    console.log(`[iRobot] Authenticated, token expires in ${Math.floor((data.expires_in || 3600) / 60)} minutes`);

    return authToken!;
  } catch (error) {
    console.error('[iRobot] Authentication error:', (error as Error).message);
    throw error;
  }
}

/**
 * Get list of robots
 */
export async function getRobots(cfg: IRobotConfig): Promise<IRobotDevice[]> {
  const token = await authenticate(cfg);

  console.log('[iRobot] Fetching robot list');

  try {
    const response = await fetch('https://unauth2.prod.iot.irobotapi.com/v2/robots', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[iRobot] Robot list failed:', error.substring(0, 200));
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
  } catch (error) {
    console.error('[iRobot] Get robots error:', (error as Error).message);
    throw error;
  }
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

  try {
    const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: 'start' })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[iRobot] Start cleaning failed:', error.substring(0, 200));
      throw new Error(`iRobot start cleaning failed: ${response.status}`);
    }

    console.log(`[iRobot] Cleaning mission started successfully`);
  } catch (error) {
    console.error('[iRobot] Start cleaning error:', (error as Error).message);
    throw error;
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

  try {
    const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: 'pause' })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[iRobot] Pause cleaning failed:', error.substring(0, 200));
      throw new Error(`iRobot pause cleaning failed: ${response.status}`);
    }

    console.log(`[iRobot] Cleaning mission paused successfully`);
  } catch (error) {
    console.error('[iRobot] Pause cleaning error:', (error as Error).message);
    throw error;
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

  try {
    const response = await fetch(`https://unauth2.prod.iot.irobotapi.com/v2/robots/${id}/clean`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: 'dock' })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[iRobot] Return to dock failed:', error.substring(0, 200));
      throw new Error(`iRobot return to dock failed: ${response.status}`);
    }

    console.log(`[iRobot] Robot returning to dock successfully`);
  } catch (error) {
    console.error('[iRobot] Return to dock error:', (error as Error).message);
    throw error;
  }
}

/**
 * Get robot status
 */
export async function getRobotStatus(cfg: IRobotConfig, robotId?: string): Promise<IRobotDevice | null> {
  const robots = await getRobots(cfg);
  const id = robotId || cfg.robotId;
  
  if (!id) {
    return robots[0] || null;
  }
  
  return robots.find(r => r.id === id) || null;
}

/**
 * Test connection to iRobot API
 */
export async function testConnection(cfg: IRobotConfig): Promise<{ ok: boolean; message?: string }> {
  try {
    await authenticate(cfg);
    const robots = await getRobots(cfg);
    return { 
      ok: true, 
      message: `Connected successfully. Found ${robots.length} robot(s).` 
    };
  } catch (error) {
    return { 
      ok: false, 
      message: (error as Error).message 
    };
  }
}

// Helper function

function parseRobotStatus(phase?: string): IRobotDevice['status'] {
  if (!phase) return 'idle';
  const lower = phase.toLowerCase();
  if (lower.includes('run') || lower.includes('clean')) return 'cleaning';
  if (lower.includes('charge')) return 'charging';
  if (lower.includes('pause') || lower.includes('stop')) return 'paused';
  if (lower.includes('error') || lower.includes('stuck')) return 'error';
  return 'idle';
}
