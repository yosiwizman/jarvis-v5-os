/**
 * Enhanced Logger
 * 
 * Structured logging with file rotation and multiple log streams.
 * Uses Pino for high-performance JSON logging with rotating file streams.
 */

import pino from 'pino';
import { createStream } from 'rotating-file-stream';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// Ensure logs directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Create a rotating file stream for logs
 * Rotates daily, keeps 30 days of logs
 */
function createLogStream(filename: string) {
  return createStream(filename, {
    interval: '1d', // Rotate daily
    maxFiles: 30,   // Keep 30 days of logs
    path: LOGS_DIR,
    compress: 'gzip' // Compress old logs
  });
}

// Create separate streams for different log types
const appStream = createLogStream('app.log');
const errorStream = createLogStream('error.log');
const securityStream = createLogStream('security.log');
const actionsStream = createLogStream('actions.log');

// Define log levels
const levels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10
};

/**
 * Main application logger
 * Logs all levels to app.log and console
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => {
        return { level: label };
      },
      bindings: (bindings) => {
        return {
          pid: bindings.pid,
          hostname: bindings.hostname,
          node_version: process.version
        };
      }
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      env: process.env.NODE_ENV || 'development'
    }
  },
  pino.multistream([
    // Write all logs to app.log
    { level: 'trace', stream: appStream },
    // Write error and fatal to error.log
    { level: 'error', stream: errorStream },
    // Pretty print to console in development
    ...(process.env.NODE_ENV !== 'production'
      ? [
          {
            level: 'trace',
            stream: pino.transport({
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname'
              }
            })
          }
        ]
      : [])
  ])
);

/**
 * Security event logger
 * Logs security-related events to dedicated file
 */
export const securityLogger = logger.child({ component: 'security' });

/**
 * Action logger
 * Logs user actions and system events
 */
export const actionLogger = logger.child({ component: 'actions' });

/**
 * Helper functions for common log scenarios
 */

export function logApiRequest(method: string, url: string, statusCode: number, duration: number, metadata?: Record<string, any>) {
  logger.info({
    type: 'api_request',
    method,
    url,
    statusCode,
    duration,
    ...metadata
  }, `${method} ${url} ${statusCode} - ${duration}ms`);
}

export function logNotificationEvent(event: 'scheduled' | 'delivered' | 'failed', notificationId: string, type: string, metadata?: Record<string, any>) {
  logger.info({
    type: 'notification',
    event,
    notificationId,
    notificationType: type,
    ...metadata
  }, `Notification ${event}: ${type} (${notificationId})`);
}

export function logConversation(action: 'started' | 'ended' | 'saved', conversationId: string, messageCount?: number, metadata?: Record<string, any>) {
  logger.info({
    type: 'conversation',
    action,
    conversationId,
    messageCount,
    ...metadata
  }, `Conversation ${action}: ${conversationId}${messageCount ? ` (${messageCount} messages)` : ''}`);
}

export function logFunctionExecution(functionName: string, duration: number, success: boolean, metadata?: Record<string, any>) {
  actionLogger.info({
    type: 'function_execution',
    functionName,
    duration,
    success,
    ...metadata
  }, `Function ${functionName} ${success ? 'completed' : 'failed'} in ${duration}ms`);
}

export function logSecurityEvent(eventType: string, deviceId: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>) {
  const logFn = severity === 'critical' || severity === 'high' ? securityLogger.error : securityLogger.info;
  
  logFn({
    type: 'security',
    eventType,
    deviceId,
    severity,
    ...metadata
  }, `Security event: ${eventType} on ${deviceId} [${severity}]`);
}

export function logIntegrationEvent(integration: string, event: 'connected' | 'disconnected' | 'error' | 'sync', metadata?: Record<string, any>) {
  const logFn = event === 'error' ? logger.error : logger.info;
  
  logFn({
    type: 'integration',
    integration,
    event,
    ...metadata
  }, `Integration ${integration}: ${event}`);
}

export function logSystemEvent(event: string, metadata?: Record<string, any>) {
  logger.info({
    type: 'system',
    event,
    ...metadata
  }, `System event: ${event}`);
}

export function logUserAction(action: string, userId?: string, metadata?: Record<string, any>) {
  actionLogger.info({
    type: 'user_action',
    action,
    userId,
    ...metadata
  }, `User action: ${action}${userId ? ` (user: ${userId})` : ''}`);
}

export function logError(error: Error, context?: string, metadata?: Record<string, any>) {
  logger.error({
    type: 'error',
    context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...metadata
  }, `Error${context ? ` in ${context}` : ''}: ${error.message}`);
}

/**
 * Fastify logger adapter
 * Wraps pino logger with Fastify-compatible interface
 */
export function createFastifyLogger() {
  return {
    logger,
    // Fastify expects these properties
    level: logger.level,
    fatal: logger.fatal.bind(logger),
    error: logger.error.bind(logger),
    warn: logger.warn.bind(logger),
    info: logger.info.bind(logger),
    debug: logger.debug.bind(logger),
    trace: logger.trace.bind(logger),
    child: logger.child.bind(logger)
  };
}

/**
 * Express/Fastify request logger middleware
 */
export function createRequestLogger() {
  return (req: any, reply: any, done: any) => {
    const start = Date.now();
    
    // Use reply.raw for Node.js EventEmitter methods
    reply.raw.once('finish', () => {
      const duration = Date.now() - start;
      logApiRequest(
        req.method,
        req.url,
        reply.raw.statusCode,
        duration,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      );
    });
    
    done();
  };
}

// Log startup
logger.info({ logsDir: LOGS_DIR }, 'Logger initialized');

export default logger;
