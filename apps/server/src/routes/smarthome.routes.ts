import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readSettings } from '@shared/settings';
import * as alexaClient from '../clients/alexaClient.js';
import * as irobotClient from '../clients/irobotClient.js';
import * as nestClient from '../clients/nestClient.js';
import * as smartLightsClient from '../clients/smartLightsClient.js';
import { logger } from '../utils/logger.js';

// Request/Response schemas
const AlexaActionSchema = z.object({
  action: z.enum(['discover', 'control', 'getState']),
  deviceId: z.string().optional(),
  command: z.object({
    directive: z.string(),
    namespace: z.string(),
    payload: z.any().optional()
  }).optional()
});

const IRobotActionSchema = z.object({
  action: z.enum(['list', 'start', 'pause', 'dock', 'status']),
  robotId: z.string().optional()
});

const NestActionSchema = z.object({
  action: z.enum(['list', 'getState', 'setTemperature', 'setMode']),
  deviceId: z.string().optional(),
  temperature: z.number().optional(),
  unit: z.enum(['C', 'F']).optional(),
  mode: z.enum(['HEAT', 'COOL', 'HEATCOOL', 'OFF']).optional()
});

const SmartLightsActionSchema = z.object({
  action: z.enum(['discover', 'toggle', 'setState', 'schedule']),
  lightId: z.string().optional(),
  state: z.object({
    on: z.boolean().optional(),
    brightness: z.number().min(0).max(100).optional(),
    color: z.object({
      r: z.number().min(0).max(255),
      g: z.number().min(0).max(255),
      b: z.number().min(0).max(255)
    }).optional()
  }).optional(),
  inSeconds: z.number().optional()
});

export function registerSmartHomeRoutes(fastify: FastifyInstance) {
  // Alexa routes
  fastify.post('/api/smarthome/alexa', async (req, reply) => {
    try {
      const body = AlexaActionSchema.parse(req.body);
      const settings = readSettings();
      const alexaConfig = settings.integrations.alexa;

      if (!alexaConfig.enabled || !alexaConfig.clientId || !alexaConfig.clientSecret || !alexaConfig.refreshToken) {
        return reply.status(400).send({ 
          ok: false, 
          error: 'Alexa integration not configured. Please configure in Settings.' 
        });
      }

      const config: alexaClient.AlexaConfig = {
        clientId: alexaConfig.clientId,
        clientSecret: alexaConfig.clientSecret,
        refreshToken: alexaConfig.refreshToken,
        region: alexaConfig.region || undefined
      };

      switch (body.action) {
        case 'discover': {
          const devices = await alexaClient.discoverDevices(config);
          return reply.send({ ok: true, devices });
        }
        case 'control': {
          if (!body.deviceId || !body.command) {
            return reply.status(400).send({ ok: false, error: 'deviceId and command are required for control action' });
          }
          const result = await alexaClient.controlDevice(config, body.deviceId, body.command);
          return reply.send({ ok: true, result });
        }
        case 'getState': {
          if (!body.deviceId) {
            return reply.status(400).send({ ok: false, error: 'deviceId is required for getState action' });
          }
          const state = await alexaClient.getDeviceState(config, body.deviceId);
          return reply.send({ ok: true, state });
        }
      }
    } catch (error) {
      logger.error(error, '[Alexa] API error');
      return reply.status(500).send({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // iRobot routes
  fastify.post('/api/smarthome/irobot', async (req, reply) => {
    try {
      const body = IRobotActionSchema.parse(req.body);
      const settings = readSettings();
      const irobotConfig = settings.integrations.irobot;

      if (!irobotConfig.enabled || !irobotConfig.username || !irobotConfig.password) {
        return reply.status(400).send({ 
          ok: false, 
          error: 'iRobot integration not configured. Please configure in Settings.' 
        });
      }

      const config: irobotClient.IRobotConfig = {
        username: irobotConfig.username,
        password: irobotConfig.password,
        robotId: irobotConfig.robotId || undefined
      };

      switch (body.action) {
        case 'list': {
          const robots = await irobotClient.getRobots(config);
          return reply.send({ ok: true, robots });
        }
        case 'start': {
          await irobotClient.startCleaning(config, body.robotId);
          return reply.send({ ok: true, message: 'Cleaning started' });
        }
        case 'pause': {
          await irobotClient.pauseCleaning(config, body.robotId);
          return reply.send({ ok: true, message: 'Cleaning paused' });
        }
        case 'dock': {
          await irobotClient.returnToDock(config, body.robotId);
          return reply.send({ ok: true, message: 'Returning to dock' });
        }
        case 'status': {
          const status = await irobotClient.getRobotStatus(config, body.robotId);
          return reply.send({ ok: true, status });
        }
      }
    } catch (error) {
      logger.error(error, '[iRobot] API error');
      return reply.status(500).send({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Nest routes
  fastify.post('/api/smarthome/nest', async (req, reply) => {
    try {
      const body = NestActionSchema.parse(req.body);
      const settings = readSettings();
      const nestConfig = settings.integrations.nest;

      if (!nestConfig.enabled || !nestConfig.projectId || !nestConfig.clientId || 
          !nestConfig.clientSecret || !nestConfig.refreshToken) {
        return reply.status(400).send({ 
          ok: false, 
          error: 'Nest integration not configured. Please configure in Settings.' 
        });
      }

      const config: nestClient.NestConfig = {
        projectId: nestConfig.projectId,
        clientId: nestConfig.clientId,
        clientSecret: nestConfig.clientSecret,
        refreshToken: nestConfig.refreshToken,
        deviceId: nestConfig.deviceId || undefined
      };

      switch (body.action) {
        case 'list': {
          const devices = await nestClient.getDevices(config);
          return reply.send({ ok: true, devices });
        }
        case 'getState': {
          const state = await nestClient.getThermostatState(config, body.deviceId);
          return reply.send({ ok: true, state });
        }
        case 'setTemperature': {
          if (body.temperature === undefined) {
            return reply.status(400).send({ ok: false, error: 'temperature is required for setTemperature action' });
          }
          await nestClient.setTemperature(config, body.temperature, body.deviceId, body.unit || 'C');
          return reply.send({ ok: true, message: 'Temperature set successfully' });
        }
        case 'setMode': {
          if (!body.mode) {
            return reply.status(400).send({ ok: false, error: 'mode is required for setMode action' });
          }
          await nestClient.setMode(config, body.mode, body.deviceId);
          return reply.send({ ok: true, message: 'Mode set successfully' });
        }
      }
    } catch (error) {
      logger.error(error, '[Nest] API error');
      return reply.status(500).send({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Smart Lights routes
  fastify.post('/api/smarthome/lights', async (req, reply) => {
    try {
      const body = SmartLightsActionSchema.parse(req.body);
      const settings = readSettings();
      const lightsConfig = settings.integrations.smartLights;

      if (!lightsConfig.enabled || !lightsConfig.apiKey) {
        return reply.status(400).send({ 
          ok: false, 
          error: 'Smart Lights integration not configured. Please configure in Settings.' 
        });
      }

      const config: smartLightsClient.SmartLightsConfig = {
        provider: lightsConfig.provider,
        apiKey: lightsConfig.apiKey,
        bridgeIp: lightsConfig.bridgeIp || undefined
      };

      switch (body.action) {
        case 'discover': {
          const lights = await smartLightsClient.discoverLights(config);
          return reply.send({ ok: true, lights });
        }
        case 'toggle': {
          if (!body.lightId) {
            return reply.status(400).send({ ok: false, error: 'lightId is required for toggle action' });
          }
          await smartLightsClient.toggleLight(config, body.lightId);
          return reply.send({ ok: true, message: 'Light toggled' });
        }
        case 'setState': {
          if (!body.lightId || !body.state) {
            return reply.status(400).send({ ok: false, error: 'lightId and state are required for setState action' });
          }
          await smartLightsClient.setLightState(config, body.lightId, body.state);
          return reply.send({ ok: true, message: 'Light state updated' });
        }
        case 'schedule': {
          if (!body.lightId || !body.state || body.inSeconds === undefined) {
            return reply.status(400).send({ 
              ok: false, 
              error: 'lightId, state, and inSeconds are required for schedule action' 
            });
          }
          const result = await smartLightsClient.scheduleLight(config, body.lightId, body.inSeconds, body.state);
          return reply.send({ ok: true, ...result });
        }
      }
    } catch (error) {
      logger.error(error, '[SmartLights] API error');
      return reply.status(500).send({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  // Test connection endpoints
  fastify.get('/api/smarthome/alexa/test', async (req, reply) => {
    const settings = readSettings();
    const alexaConfig = settings.integrations.alexa;

    if (!alexaConfig.enabled || !alexaConfig.clientId || !alexaConfig.clientSecret || !alexaConfig.refreshToken) {
      return reply.send({ ok: false, message: 'Alexa integration not configured' });
    }

    const result = await alexaClient.testConnection({
      clientId: alexaConfig.clientId,
      clientSecret: alexaConfig.clientSecret,
      refreshToken: alexaConfig.refreshToken,
      region: alexaConfig.region || undefined
    });

    return reply.send(result);
  });

  fastify.get('/api/smarthome/irobot/test', async (req, reply) => {
    const settings = readSettings();
    const irobotConfig = settings.integrations.irobot;

    if (!irobotConfig.enabled || !irobotConfig.username || !irobotConfig.password) {
      return reply.send({ ok: false, message: 'iRobot integration not configured' });
    }

    const result = await irobotClient.testConnection({
      username: irobotConfig.username,
      password: irobotConfig.password,
      robotId: irobotConfig.robotId || undefined
    });

    return reply.send(result);
  });

  fastify.get('/api/smarthome/nest/test', async (req, reply) => {
    const settings = readSettings();
    const nestConfig = settings.integrations.nest;

    if (!nestConfig.enabled || !nestConfig.projectId || !nestConfig.clientId || 
        !nestConfig.clientSecret || !nestConfig.refreshToken) {
      return reply.send({ ok: false, message: 'Nest integration not configured' });
    }

    const result = await nestClient.testConnection({
      projectId: nestConfig.projectId,
      clientId: nestConfig.clientId,
      clientSecret: nestConfig.clientSecret,
      refreshToken: nestConfig.refreshToken,
      deviceId: nestConfig.deviceId || undefined
    });

    return reply.send(result);
  });

  fastify.get('/api/smarthome/lights/test', async (req, reply) => {
    const settings = readSettings();
    const lightsConfig = settings.integrations.smartLights;

    if (!lightsConfig.enabled || !lightsConfig.apiKey) {
      return reply.send({ ok: false, message: 'Smart Lights integration not configured' });
    }

    try {
      const lights = await smartLightsClient.discoverLights({
        provider: lightsConfig.provider,
        apiKey: lightsConfig.apiKey,
        bridgeIp: lightsConfig.bridgeIp || undefined
      });
      return reply.send({ ok: true, message: `Connected successfully. Found ${lights.length} light(s).` });
    } catch (error) {
      return reply.send({ ok: false, message: error instanceof Error ? error.message : 'Connection failed' });
    }
  });
}
