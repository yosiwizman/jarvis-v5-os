/**
 * LLM Configuration Routes
 * 
 * Admin-only endpoints for managing LLM provider configuration.
 * Protected by Owner PIN session authentication.
 * 
 * Endpoints:
 * - GET  /api/admin/llm/config  → Get current config (no secrets)
 * - POST /api/admin/llm/config  → Update provider config
 * - POST /api/admin/llm/test    → Test connectivity
 * 
 * SECURITY:
 * - All endpoints require admin session
 * - API keys are never returned in responses
 * - API keys are never logged
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifySessionToken } from '../auth/sessionToken.js';
import {
  getLLMConfigPublic,
  updateLLMConfig,
  getLLMBaseUrl,
  getLLMApiKey,
  type LLMProvider,
} from '../storage/llmConfigStore.js';
import { logSystemEvent } from '../utils/logger.js';
import {
  RateLimitPresets,
  checkRateLimit,
  getClientIp,
  requireCsrf,
  audit,
} from '../security/index.js';

// Request body types
interface UpdateConfigBody {
  provider: LLMProvider;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Middleware to verify admin session
 */
async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const sessionCookie = request.cookies['akior_admin_session'];
  
  if (!sessionCookie) {
    reply.status(401).send({ ok: false, error: 'Authentication required' });
    return false;
  }
  
  const isValid = verifySessionToken(sessionCookie);
  if (!isValid) {
    reply.status(401).send({ ok: false, error: 'Invalid or expired session' });
    return false;
  }
  
  return true;
}

/**
 * Register LLM configuration routes
 */
export function registerLLMRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/admin/llm/config
   * Returns current LLM configuration (no secrets)
   */
  fastify.get('/api/admin/llm/config', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    
    const config = getLLMConfigPublic();
    return {
      ok: true,
      config,
    };
  });

  /**
   * POST /api/admin/llm/config
   * Update LLM provider configuration
   * 
   * SECURITY:
   * - 401 if not authenticated
   * - 429 if rate limited
   * - 403 if CSRF invalid
   */
  fastify.post('/api/admin/llm/config', async (request, reply) => {
    const ip = getClientIp(request);
    
    if (!(await requireAdmin(request, reply))) return;
    
    // Rate limit
    const rateCheck = checkRateLimit({ ...RateLimitPresets.ADMIN_MODERATE, routeKey: 'llm-config' }, ip);
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header('Retry-After', String(rateCheck.response.retryAfterSec))
        .header('Cache-Control', 'no-store')
        .send(rateCheck.response);
    }
    
    // CSRF protection
    if (!(await requireCsrf(request, reply))) return;
    
    const body = request.body as UpdateConfigBody;
    
    // Validate provider
    if (!body.provider) {
      return reply.status(400).send({ ok: false, error: 'provider is required' });
    }
    
    if (body.provider !== 'openai-cloud' && body.provider !== 'local-compatible') {
      return reply.status(400).send({ 
        ok: false, 
        error: 'Invalid provider. Must be "openai-cloud" or "local-compatible"' 
      });
    }
    
    // For OpenAI Cloud, API key is required
    if (body.provider === 'openai-cloud' && !body.apiKey) {
      // Check if we already have an OpenAI key configured
      const existingConfig = getLLMConfigPublic();
      if (!existingConfig.keyConfigured || existingConfig.provider !== 'openai-cloud') {
        return reply.status(400).send({ 
          ok: false, 
          error: 'API key is required for OpenAI Cloud provider' 
        });
      }
    }
    
    // For local-compatible, base URL is required
    if (body.provider === 'local-compatible' && !body.baseUrl) {
      return reply.status(400).send({ 
        ok: false, 
        error: 'Base URL is required for Local/OpenAI-Compatible provider' 
      });
    }
    
    // Validate API key format if provided (basic sanity checks)
    if (body.apiKey) {
      if (body.provider === 'openai-cloud' && !body.apiKey.startsWith('sk-')) {
        return reply.status(400).send({ 
          ok: false, 
          error: 'Invalid OpenAI API key format (should start with sk-)' 
        });
      }
    }
    
    // Update configuration
    const result = updateLLMConfig(body.provider, {
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }
    
    // Return updated config (no secrets)
    const updatedConfig = getLLMConfigPublic();
    
    // Audit log
    await audit.llmConfigSaved(ip, body.provider);
    
    return {
      ok: true,
      config: updatedConfig,
    };
  });

  /**
   * POST /api/admin/llm/test
   * Test LLM connectivity with current configuration
   * 
   * SECURITY:
   * - 401 if not authenticated
   * - 429 if rate limited (light limit for testing)
   */
  fastify.post('/api/admin/llm/test', async (request, reply) => {
    const ip = getClientIp(request);
    
    if (!(await requireAdmin(request, reply))) return;
    
    // Rate limit (light limit for test endpoints)
    const rateCheck = checkRateLimit({ ...RateLimitPresets.ADMIN_LIGHT, routeKey: 'llm-test' }, ip);
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header('Retry-After', String(rateCheck.response.retryAfterSec))
        .header('Cache-Control', 'no-store')
        .send(rateCheck.response);
    }
    
    const config = getLLMConfigPublic();
    const baseUrl = getLLMBaseUrl();
    const apiKey = getLLMApiKey();
    
    // Check if configured
    if (config.provider === 'openai-cloud' && !apiKey) {
      return reply.status(400).send({ 
        ok: false, 
        error: 'OpenAI API key not configured' 
      });
    }
    
    if (config.provider === 'local-compatible' && !baseUrl) {
      return reply.status(400).send({ 
        ok: false, 
        error: 'Base URL not configured for local provider' 
      });
    }
    
    const startTime = Date.now();
    
    try {
      // Test endpoint - use /models for OpenAI-compatible APIs
      const testUrl = config.provider === 'openai-cloud'
        ? 'https://api.openai.com/v1/models'
        : `${baseUrl}/models`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      
      if (response.ok) {
        logSystemEvent('llm_test_success', { 
          provider: config.provider, 
          latencyMs 
        });
        
        // Audit log
        await audit.llmTestRun(ip, true, config.provider);
        
        return {
          ok: true,
          latencyMs,
          message: 'Connection successful',
        };
      } else if (response.status === 401) {
        await audit.llmTestRun(ip, false, config.provider);
        return {
          ok: false,
          latencyMs,
          error: 'Authentication failed - invalid API key',
        };
      } else {
        await audit.llmTestRun(ip, false, config.provider);
        return {
          ok: false,
          latencyMs,
          error: `Server returned status ${response.status}`,
        };
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      // Sanitize error message (never expose full error details)
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timed out (10s)';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error - unable to reach server';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused - server not reachable';
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'DNS lookup failed - invalid hostname';
        }
      }
      
      logSystemEvent('llm_test_failed', { 
        provider: config.provider, 
        error: errorMessage,
        latencyMs 
      });
      
      // Audit log
      await audit.llmTestRun(ip, false, config.provider);
      
      return {
        ok: false,
        latencyMs,
        error: errorMessage,
      };
    }
  });
}
