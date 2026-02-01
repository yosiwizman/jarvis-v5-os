/**
 * Lockdown Mode API Routes
 * 
 * Provides REST endpoints for managing security lockdown mode
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLockdownService } from '../services/lockdownService.js';

const ActivateLockdownSchema = z.object({
  activatedBy: z.enum(['manual', 'auto']).optional().default('manual')
});

export async function registerLockdownRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/lockdown/status
   * Get current lockdown mode status
   */
  fastify.get('/lockdown/status', async (request, reply) => {
    try {
      const lockdownService = getLockdownService();
      const state = lockdownService.getState();
      
      return reply.code(200).send({
        success: true,
        state
      });
    } catch (error) {
      console.error('[Lockdown API] Error getting status:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get lockdown status'
      });
    }
  });

  /**
   * POST /api/lockdown/activate
   * Activate lockdown mode
   */
  fastify.post('/lockdown/activate', async (request, reply) => {
    try {
      const body = ActivateLockdownSchema.parse(request.body);
      const lockdownService = getLockdownService();
      
      console.log(`[Lockdown API] Activating lockdown (${body.activatedBy})`);
      
      const result = await lockdownService.activate(body.activatedBy);
      
      if (result.success) {
        return reply.code(200).send({
          success: true,
          state: result.state,
          warnings: result.errors.length > 0 ? result.errors : undefined
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to activate lockdown',
          errors: result.errors
        });
      }
    } catch (error) {
      console.error('[Lockdown API] Error activating lockdown:', error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors
        });
      }
      
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate lockdown'
      });
    }
  });

  /**
   * POST /api/lockdown/deactivate
   * Deactivate lockdown mode
   */
  fastify.post('/lockdown/deactivate', async (request, reply) => {
    try {
      const lockdownService = getLockdownService();
      
      console.log('[Lockdown API] Deactivating lockdown');
      
      const result = await lockdownService.deactivate();
      
      if (result.success) {
        return reply.code(200).send({
          success: true,
          state: result.state,
          warnings: result.errors.length > 0 ? result.errors : undefined
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to deactivate lockdown',
          errors: result.errors
        });
      }
    } catch (error) {
      console.error('[Lockdown API] Error deactivating lockdown:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate lockdown'
      });
    }
  });

  /**
   * POST /api/lockdown/toggle
   * Toggle lockdown mode (activate if inactive, deactivate if active)
   */
  fastify.post('/lockdown/toggle', async (request, reply) => {
    try {
      const body = ActivateLockdownSchema.parse(request.body);
      const lockdownService = getLockdownService();
      const currentState = lockdownService.getState();
      
      console.log(`[Lockdown API] Toggling lockdown (currently ${currentState.active ? 'active' : 'inactive'})`);
      
      const result = currentState.active
        ? await lockdownService.deactivate()
        : await lockdownService.activate(body.activatedBy);
      
      if (result.success) {
        return reply.code(200).send({
          success: true,
          state: result.state,
          action: currentState.active ? 'deactivated' : 'activated',
          warnings: result.errors.length > 0 ? result.errors : undefined
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: `Failed to ${currentState.active ? 'deactivate' : 'activate'} lockdown`,
          errors: result.errors
        });
      }
    } catch (error) {
      console.error('[Lockdown API] Error toggling lockdown:', error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors
        });
      }
      
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle lockdown'
      });
    }
  });

  console.log('[Lockdown API] Routes registered');
}
