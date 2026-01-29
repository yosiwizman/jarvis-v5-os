/**
 * Lockdown Service
 * 
 * Manages security lockdown mode with real-time Socket.io broadcasting
 * Coordinates with smart home devices to lock doors, arm alarms, and secure cameras
 */

import type { Server as SocketServer } from 'socket.io';
import type { LockdownState, CameraSettings } from '@shared/core';
import { readSettings } from '@shared/core';
import { controlDevice as controlAlexaDevice } from '../clients/alexaClient.js';
import { setLightState } from '../clients/smartLightsClient.js';
import { writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Helper function to write settings
function writeSettings(settings: any): void {
  writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8').catch(err => {
    console.error('[LockdownService] Failed to write settings:', err);
  });
}

export class LockdownService {
  private io: SocketServer;
  private currentState: LockdownState;

  constructor(io: SocketServer) {
    this.io = io;
    
    // Load initial state from settings
    const settings = readSettings();
    this.currentState = settings.lockdownState ?? {
      active: false,
      activatedAt: null,
      activatedBy: null,
      features: {
        doorsLocked: false,
        alarmArmed: false,
        camerasSecured: false
      }
    };
  }

  /**
   * Get current lockdown state
   */
  getState(): LockdownState {
    return { ...this.currentState };
  }

  /**
   * Activate lockdown mode
   */
  async activate(activatedBy: 'manual' | 'auto' = 'manual'): Promise<{ success: boolean; state: LockdownState; errors: string[] }> {
    console.log(`[LockdownService] Activating lockdown mode (${activatedBy})...`);
    
    const errors: string[] = [];
    const features = {
      doorsLocked: false,
      alarmArmed: false,
      camerasSecured: false
    };

    try {
      // 1. Lock all doors via smart home integration
      const doorsResult = await this.lockDoors();
      features.doorsLocked = doorsResult.success;
      if (!doorsResult.success) {
        errors.push(`Door locking: ${doorsResult.error}`);
      }

      // 2. Arm alarm system (via smart lights red flash + sound notification)
      const alarmResult = await this.armAlarm();
      features.alarmArmed = alarmResult.success;
      if (!alarmResult.success) {
        errors.push(`Alarm arming: ${alarmResult.error}`);
      }

      // 3. Secure all cameras (mark as secured in settings)
      const cameraResult = await this.secureCameras();
      features.camerasSecured = cameraResult.success;
      if (!cameraResult.success) {
        errors.push(`Camera securing: ${cameraResult.error}`);
      }

      // Update lockdown state
      this.currentState = {
        active: true,
        activatedAt: Date.now(),
        activatedBy,
        features
      };

      // Persist to settings
      this.saveState();

      // Broadcast to all connected clients
      this.broadcastState();

      console.log('[LockdownService] Lockdown activated:', features);
      
      return {
        success: true,
        state: this.currentState,
        errors
      };
    } catch (error) {
      console.error('[LockdownService] Error activating lockdown:', error);
      errors.push(`Activation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        state: this.currentState,
        errors
      };
    }
  }

  /**
   * Deactivate lockdown mode
   */
  async deactivate(): Promise<{ success: boolean; state: LockdownState; errors: string[] }> {
    console.log('[LockdownService] Deactivating lockdown mode...');
    
    const errors: string[] = [];

    try {
      // 1. Unlock doors
      const doorsResult = await this.unlockDoors();
      if (!doorsResult.success) {
        errors.push(`Door unlocking: ${doorsResult.error}`);
      }

      // 2. Disarm alarm
      const alarmResult = await this.disarmAlarm();
      if (!alarmResult.success) {
        errors.push(`Alarm disarming: ${alarmResult.error}`);
      }

      // 3. Release camera security lock
      const cameraResult = await this.releaseCameras();
      if (!cameraResult.success) {
        errors.push(`Camera release: ${cameraResult.error}`);
      }

      // Update lockdown state
      this.currentState = {
        active: false,
        activatedAt: null,
        activatedBy: null,
        features: {
          doorsLocked: false,
          alarmArmed: false,
          camerasSecured: false
        }
      };

      // Persist to settings
      this.saveState();

      // Broadcast to all connected clients
      this.broadcastState();

      console.log('[LockdownService] Lockdown deactivated');
      
      return {
        success: true,
        state: this.currentState,
        errors
      };
    } catch (error) {
      console.error('[LockdownService] Error deactivating lockdown:', error);
      errors.push(`Deactivation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        state: this.currentState,
        errors
      };
    }
  }

  /**
   * Lock all doors via Alexa smart locks
   */
  private async lockDoors(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const alexaConfig = settings.integrations?.alexa;

      if (!alexaConfig?.enabled || !alexaConfig.clientId) {
        return { success: false, error: 'Alexa integration not configured' };
      }

      // Get list of door locks from Alexa
      // Note: This is a simplified implementation. In production, you'd query for actual lock devices.
      const doorDevices = ['Front Door', 'Back Door', 'Garage Door'];
      
      // Create properly typed config
      const alexaCfg: import('../clients/alexaClient.js').AlexaConfig = {
        clientId: alexaConfig.clientId!,
        clientSecret: alexaConfig.clientSecret!,
        refreshToken: alexaConfig.refreshToken!,
        region: alexaConfig.region || undefined
      };
      
      const lockResults = await Promise.allSettled(
        doorDevices.map(deviceName =>
          controlAlexaDevice(alexaCfg, deviceName, {
            directive: 'Lock',
            namespace: 'Alexa.LockController'
          })
        )
      );

      const allLocked = lockResults.every(result => result.status === 'fulfilled');
      
      if (!allLocked) {
        const failedDevices = doorDevices.filter((_, i) => lockResults[i].status === 'rejected');
        return { success: false, error: `Failed to lock: ${failedDevices.join(', ')}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to lock doors' 
      };
    }
  }

  /**
   * Unlock all doors
   */
  private async unlockDoors(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const alexaConfig = settings.integrations?.alexa;

      if (!alexaConfig?.enabled || !alexaConfig.clientId) {
        return { success: true }; // No-op if not configured
      }

      const doorDevices = ['Front Door', 'Back Door', 'Garage Door'];
      
      const alexaCfg: import('../clients/alexaClient.js').AlexaConfig = {
        clientId: alexaConfig.clientId!,
        clientSecret: alexaConfig.clientSecret!,
        refreshToken: alexaConfig.refreshToken!,
        region: alexaConfig.region || undefined
      };
      
      const unlockResults = await Promise.allSettled(
        doorDevices.map(deviceName =>
          controlAlexaDevice(alexaCfg, deviceName, {
            directive: 'Unlock',
            namespace: 'Alexa.LockController'
          })
        )
      );

      const allUnlocked = unlockResults.every(result => result.status === 'fulfilled');
      
      if (!allUnlocked) {
        const failedDevices = doorDevices.filter((_, i) => unlockResults[i].status === 'rejected');
        return { success: false, error: `Failed to unlock: ${failedDevices.join(', ')}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to unlock doors' 
      };
    }
  }

  /**
   * Arm alarm system (visual alarm via smart lights)
   */
  private async armAlarm(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const lightsConfig = settings.integrations?.smartLights;

      if (!lightsConfig?.enabled || !lightsConfig.apiKey) {
        return { success: false, error: 'Smart lights not configured for alarm' };
      }

      // Flash all lights red as alarm indicator
      // In production, you'd also trigger actual alarm system
      try {
        const lights = await import('../clients/smartLightsClient.js');
        const discoveredLights = await lights.discoverLights({
          provider: lightsConfig.provider,
          apiKey: lightsConfig.apiKey!,
          bridgeIp: lightsConfig.bridgeIp ?? undefined
        });

        // Set all lights to red at 100% brightness
        await Promise.all(
          discoveredLights.map(light =>
            setLightState(
              {
                provider: lightsConfig.provider,
                apiKey: lightsConfig.apiKey!,
                bridgeIp: lightsConfig.bridgeIp ?? undefined
              },
              light.id,
              { on: true, brightness: 100, color: { r: 255, g: 0, b: 0 } }
            )
          )
        );

        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to arm alarm lights' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to arm alarm' 
      };
    }
  }

  /**
   * Disarm alarm system
   */
  private async disarmAlarm(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const lightsConfig = settings.integrations?.smartLights;

      if (!lightsConfig?.enabled || !lightsConfig.apiKey) {
        return { success: true }; // No-op if not configured
      }

      // Restore lights to normal (turn off red alarm)
      try {
        const lights = await import('../clients/smartLightsClient.js');
        const discoveredLights = await lights.discoverLights({
          provider: lightsConfig.provider,
          apiKey: lightsConfig.apiKey!,
          bridgeIp: lightsConfig.bridgeIp ?? undefined
        });

        // Turn off all lights (or restore previous state)
        await Promise.all(
          discoveredLights.map(light =>
            setLightState(
              {
                provider: lightsConfig.provider,
                apiKey: lightsConfig.apiKey!,
                bridgeIp: lightsConfig.bridgeIp ?? undefined
              },
              light.id,
              { on: false }
            )
          )
        );

        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to disarm alarm lights' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to disarm alarm' 
      };
    }
  }

  /**
   * Secure all cameras (disable recording, block unauthorized access)
   */
  private async secureCameras(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const cameras = settings.cameras ?? [];

      if (cameras.length === 0) {
        return { success: true }; // No cameras to secure
      }

      // Mark all cameras as secured in settings
      // In production, this would also send commands to camera firmware
      const securedCameras = cameras.map((camera: CameraSettings): CameraSettings => ({
        ...camera,
        enabled: false, // Disable camera feeds during lockdown
        motionDetection: {
          ...camera.motionDetection,
          enabled: true, // Keep motion detection active
          sensitivity: 100 // Max sensitivity during lockdown
        }
      }));

      // Update settings
      const updatedSettings = {
        ...settings,
        cameras: securedCameras
      };
      writeSettings(updatedSettings);

      console.log(`[LockdownService] Secured ${cameras.length} cameras`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to secure cameras' 
      };
    }
  }

  /**
   * Release camera security lock
   */
  private async releaseCameras(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettings();
      const cameras = settings.cameras ?? [];

      if (cameras.length === 0) {
        return { success: true }; // No cameras to release
      }

      // Restore camera settings to normal
      const releasedCameras = cameras.map((camera: CameraSettings): CameraSettings => ({
        ...camera,
        enabled: true, // Re-enable camera feeds
        motionDetection: {
          ...camera.motionDetection,
          sensitivity: 50 // Reset to default sensitivity
        }
      }));

      // Update settings
      const updatedSettings = {
        ...settings,
        cameras: releasedCameras
      };
      writeSettings(updatedSettings);

      console.log(`[LockdownService] Released ${cameras.length} cameras`);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to release cameras' 
      };
    }
  }

  /**
   * Save lockdown state to persistent settings
   */
  private saveState(): void {
    try {
      const settings = readSettings();
      const updatedSettings = {
        ...settings,
        lockdownState: this.currentState
      };
      writeSettings(updatedSettings);
      console.log('[LockdownService] State saved to settings');
    } catch (error) {
      console.error('[LockdownService] Failed to save state:', error);
    }
  }

  /**
   * Broadcast lockdown state to all connected Socket.io clients
   */
  private broadcastState(): void {
    try {
      this.io.emit('lockdown:state', this.currentState);
      console.log('[LockdownService] Broadcasted state to all clients:', this.currentState);
    } catch (error) {
      console.error('[LockdownService] Failed to broadcast state:', error);
    }
  }
}

// Singleton instance
let lockdownServiceInstance: LockdownService | null = null;

export function initializeLockdownService(io: SocketServer): LockdownService {
  if (!lockdownServiceInstance) {
    lockdownServiceInstance = new LockdownService(io);
    console.log('[LockdownService] Service initialized');
  }
  return lockdownServiceInstance;
}

export function getLockdownService(): LockdownService {
  if (!lockdownServiceInstance) {
    throw new Error('LockdownService not initialized. Call initializeLockdownService first.');
  }
  return lockdownServiceInstance;
}
