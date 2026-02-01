import type { FastifyInstance } from 'fastify';
import mqtt from 'mqtt';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.join(serverRoot, 'data');
const bambuTokenPath = path.join(dataDir, 'bambu-token.json');
const bambuConfigPath = path.join(dataDir, 'bambu-config.json');

const API_BASE = 'https://api.bambulab.com';

// Token storage
interface BambuToken {
  accessToken: string;
  refreshToken: string;
  tokenExpiration: number;
}

interface PrinterConfig {
  printerSN: string;
  printerName?: string;
}

interface CloudPrinter {
  deviceId: string;
  name: string;
}

let bambuToken: BambuToken | null = null;
let cloudClient: mqtt.MqttClient | null = null;
let cloudPrinters: CloudPrinter[] = [];
let telemetryCacheMap: Record<string, any> = {};

// Load token from disk
async function loadBambuToken() {
  try {
    const data = await fsp.readFile(bambuTokenPath, 'utf-8');
    bambuToken = JSON.parse(data);
  } catch {
    bambuToken = null;
  }
}

// Save token to disk
async function saveBambuToken(tokenInfo: BambuToken) {
  bambuToken = tokenInfo;
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(bambuTokenPath, JSON.stringify(tokenInfo, null, 2));
}

// Load printer config
async function loadBambuConfig(): Promise<PrinterConfig[]> {
  try {
    const data = await fsp.readFile(bambuConfigPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save printer config
async function saveBambuConfig(config: PrinterConfig[]) {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(bambuConfigPath, JSON.stringify(config, null, 2));
}

// Connect to Cloud MQTT
async function connectMqttCloudClients(logger: any) {
  if (!bambuToken || !bambuToken.accessToken) {
    logger.warn('Skipping cloud MQTT: no valid token');
    return;
  }

  // Disconnect existing client if any
  if (cloudClient) {
    cloudClient.end();
    cloudClient = null;
  }

  // Fetch bound printers via BambuLab Cloud HTTP API
  const bindUrl = `${API_BASE}/v1/iot-service/api/user/bind`;
  logger.info(`Fetching printers via ${bindUrl}`);
  
  let printers: CloudPrinter[] = [];
  try {
    const res = await fetch(bindUrl, {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${bambuToken.accessToken}`, 
        Accept: 'application/json' 
      }
    });
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    
    const data = await res.json();
    printers = Array.isArray(data.devices)
      ? data.devices.map((d: any) => ({ deviceId: d.dev_id, name: d.name }))
      : [];
    
    logger.info(`Discovered ${printers.length} printers via user/bind`);
  } catch (e) {
    logger.error('Error fetching printers via user/bind:', e);
    return;
  }

  if (!printers.length) {
    logger.warn('No printers found via user/bind, aborting Cloud MQTT');
    return;
  }

  cloudPrinters = printers;
  
  // Save printer config
  const config: PrinterConfig[] = printers.map(p => ({
    printerSN: p.deviceId,
    printerName: p.name
  }));
  await saveBambuConfig(config);
  
  logger.info(`Using printers: ${cloudPrinters.map(p => p.deviceId).join(', ')}`);

  const token = bambuToken.accessToken;
  let username = process.env['bambu.cloud.username'];
  
  if (!username) {
    try {
      const prefRes = await fetch(`${API_BASE}/v1/design-user-service/my/preference`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (prefRes.ok) {
        const js = await prefRes.json();
        if (js.uid) username = `u_${js.uid}`;
      }
    } catch {}
  }
  
  if (!username) username = `u_${Math.random().toString(16).slice(2)}`;

  const rawUrl = process.env['bambu.cloud.url'] || process.env.BAMBU_CLOUD_URL || 'mqtts://us.mqtt.bambulab.com:8883';
  const brokerUrl = rawUrl.replace(/^ssl:\/\//, 'mqtts://');

  cloudClient = mqtt.connect(brokerUrl, {
    clientId: username,
    username,
    password: token,
    clean: true,
    reconnectPeriod: 0,
    protocol: 'mqtts' as any
  });

  cloudClient.on('connect', () => {
    logger.info('Connected to cloud MQTT at', brokerUrl);
    
    // Subscribe and send initial pushall
    cloudPrinters.forEach(({ deviceId }) => {
      const rep = `device/${deviceId}/report`;
      const req = `device/${deviceId}/request`;
      
      cloudClient!.subscribe(rep, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${rep}:`, err);
          return;
        }
        
        const seq = Date.now().toString();
        const msg = { 
          pushing: { 
            sequence_id: seq, 
            command: 'pushall', 
            version: 1, 
            push_target: 1 
          } 
        };
        cloudClient!.publish(req, JSON.stringify(msg));
      });
    });
  });

  // Periodically request full status
  const pushInterval = setInterval(() => {
    if (!cloudClient || !cloudClient.connected) return;
    
    cloudPrinters.forEach(({ deviceId }) => {
      const req = `device/${deviceId}/request`;
      const seq = Date.now().toString();
      const msg = { 
        pushing: { 
          sequence_id: seq, 
          command: 'pushall', 
          version: 1, 
          push_target: 1 
        } 
      };
      cloudClient!.publish(req, JSON.stringify(msg));
    });
  }, 5000);

  cloudClient.on('close', () => {
    clearInterval(pushInterval);
    logger.info('Cloud MQTT client disconnected');
  });

  cloudClient.on('message', (topic, buff) => {
    try {
      const msg = JSON.parse(buff.toString());
      const id = topic.split('/')[1];
      const update = msg.print || msg;
      
      // Merge with existing telemetry to handle partial updates
      telemetryCacheMap[id] = Object.assign({}, telemetryCacheMap[id] || {}, update);
    } catch (e) {
      logger.error('Cloud MQTT message error:', e);
    }
  });

  cloudClient.on('error', (err) => {
    logger.error('Cloud MQTT error:', err);
  });
}

// Register routes
export function register3DPrintRoutes(fastify: FastifyInstance) {
  // Initialize on startup
  (async () => {
    await loadBambuToken();
    
    if (bambuToken && bambuToken.accessToken && bambuToken.tokenExpiration > Date.now()) {
      logger.info('Valid Bambu token found, connecting to Cloud MQTT');
      await connectMqttCloudClients(fastify.log);
    } else {
      logger.info('No valid Bambu token found, skipping Cloud MQTT');
    }
  })();

  // Login endpoint
  fastify.post('/3dprint/login', async (req, reply) => {
    const { username, password } = req.body as any;
    
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }
    
    logger.info({
      username,
      hasPassword: !!password
    }, 'API /api/3dprint/login called');

    try {
      const authResponse = await fetch(`${API_BASE}/v1/user-service/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: username, password, apiError: '' })
      });

      // Log the HTTP status
      logger.info({ status: authResponse.status }, 'Bambu Labs login response status');

      let authData;
      try {
        authData = await authResponse.json();
        // Log what Bambu actually returned
        logger.info({ authData }, 'Bambu Labs auth response data');
      } catch (e) {
        logger.error({ err: e }, 'Failed to parse login response');
        return reply.status(500).send({ error: 'Invalid login response' });
      }

      // Direct login success (password was correct)
      if (authData.success) {
        logger.info('Direct login successful (password authenticated)');
        const tokenInfo: BambuToken = {
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          tokenExpiration: Date.now() + authData.expiresIn * 1000
        };
        await saveBambuToken(tokenInfo);

        // Connect to Cloud MQTT
        try {
          await connectMqttCloudClients(fastify.log);
          logger.info('Cloud MQTT client started after login');
        } catch (e) {
          logger.error({ err: e }, 'Error starting Cloud MQTT after login');
        }

        return reply.send({ success: true });
      }

      // Verification code required flow
      if (authData.loginType === 'verifyCode') {
        logger.info('Verification code required - sending email');
        
        // Trigger verification code email
        const codeResp = await fetch(`${API_BASE}/v1/user-service/user/sendemail/code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, type: 'codeLogin' })
        });

        logger.info({ status: codeResp.status }, 'Verification email send status');

        if (codeResp.ok) {
          logger.info('Verification code email sent successfully');
          return reply.status(401).send({ error: 'Verification code required' });
        } else {
          const txt = await codeResp.text();
          logger.error({ response: txt, status: codeResp.status }, 'Failed to send verification code email');
          // Return the ACTUAL error from Bambu Labs, not a generic message
          return reply.status(500).send({ error: txt || 'Failed to send verification code' });
        }
      }

      // If authData has an error message, return it
      if (authData.error) {
        logger.error({ error: authData.error }, 'Bambu Labs returned error');
        return reply.status(403).send({ error: authData.error });
      }

      // Other login types (e.g., two-factor)
      if (authData.loginType) {
        logger.warn({ loginType: authData.loginType }, 'Unsupported login type');
        return reply.status(403).send({ error: `Login type '${authData.loginType}' not supported` });
      }

      // Return the full auth data for debugging if nothing else matches
      logger.error({ authData }, 'Unexpected auth response structure');
      return reply.status(403).send({ 
        error: authData.message || authData.error || 'Login failed - invalid credentials' 
      });
    } catch (err) {
      logger.error({ err }, 'Error during login');
      return reply.status(500).send({ error: 'Login error' });
    }
  });

  // Verify code endpoint (passwordless login step 2)
  fastify.post('/3dprint/verify', async (req, reply) => {
    const { email, code } = req.body as any;
    
    logger.info({
      email,
      codeLength: code?.length
    }, 'API /api/3dprint/verify called - verifying email code');

    try {
      // Send email + code to Bambu Labs (no password needed!)
      const response = await fetch(`${API_BASE}/v1/user-service/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: email, code })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ error: errorText }, 'Verification code rejected by Bambu Labs');
        return reply.status(401).send({ error: 'Invalid verification code' });
      }

      const data = await response.json();
      
      if (!data.accessToken) {
        logger.error('No access token in verification response');
        return reply.status(500).send({ error: 'Invalid response from Bambu Labs' });
      }

      logger.info('Verification successful - passwordless login complete');

      const tokenInfo: BambuToken = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiration: Date.now() + data.expiresIn * 1000
      };
      await saveBambuToken(tokenInfo);

      // Connect to Cloud MQTT
      try {
        await connectMqttCloudClients(fastify.log);
        logger.info('Cloud MQTT client started after verification');
      } catch (e) {
        logger.error({ err: e }, 'Error starting Cloud MQTT after verification');
      }

      reply.send({ success: true });
    } catch (err) {
      logger.error({ err }, 'Error during verification');
      reply.status(500).send({ error: 'Verification failed' });
    }
  });

  // Token status endpoint
  fastify.get('/3dprint/token-status', async (req, reply) => {
    if (bambuToken && bambuToken.accessToken && bambuToken.tokenExpiration > Date.now()) {
      reply.send({ loggedIn: true });
    } else {
      reply.send({ loggedIn: false });
    }
  });

  // Get printer config
  fastify.get('/3dprint/config', async (req, reply) => {
    const config = await loadBambuConfig();
    reply.send(config);
  });

  // Get printer statuses
  fastify.get('/3dprint/status', async (req, reply) => {
    reply.send(telemetryCacheMap);
  });

  // Send printer command
  fastify.post('/3dprint/:sn/:cmd', async (req, reply) => {
    const { sn, cmd } = req.params as { sn: string; cmd: string };
    
    if (!cloudClient || !cloudClient.connected) {
      return reply.status(503).send({ error: 'MQTT client not connected' });
    }

    const req_topic = `device/${sn}/request`;
    const seq = Date.now().toString();
    
    let message: any;
    if (cmd === 'pause') {
      message = { print: { sequence_id: seq, command: 'pause', param: '' } };
    } else if (cmd === 'resume') {
      message = { print: { sequence_id: seq, command: 'resume', param: '' } };
    } else if (cmd === 'stop') {
      message = { print: { sequence_id: seq, command: 'stop', param: '' } };
    } else {
      return reply.status(400).send({ error: 'Invalid command' });
    }

    cloudClient.publish(req_topic, JSON.stringify(message));
    logger.info(`Sent ${cmd} command to ${sn}`);
    
    reply.send({ success: true });
  });

  // Get print history/tasks
  fastify.get('/3dprint/tasks', async (req, reply) => {
    if (!bambuToken || !bambuToken.accessToken) {
      return reply.send([]);
    }

    try {
      const tasksUrl = `${API_BASE}/v1/user-service/my/tasks`;
      const res = await fetch(tasksUrl, {
        headers: { Authorization: `Bearer ${bambuToken.accessToken}` }
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      const data = await res.json();
      reply.send(data.hits || []);
    } catch (e) {
      logger.error({ err: e }, 'Error fetching tasks');
      reply.send([]);
    }
  });
}

