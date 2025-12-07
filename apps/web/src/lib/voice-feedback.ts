/**
 * Voice Feedback System
 * Provides TTS responses using configured provider
 */

import { readSettings } from '@shared/settings';

export type VoiceFeedbackProvider = 'realtime' | 'elevenlabs' | 'azure' | 'none';

export interface VoiceFeedbackOptions {
  text: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Speak a response using the configured TTS provider
 */
export async function speakResponse(options: VoiceFeedbackOptions): Promise<boolean> {
  const settings = readSettings();
  const provider = (settings as any).voiceFeedbackProvider || 'none';
  
  if (provider === 'none') {
    console.log('[VoiceFeedback] Provider disabled, skipping TTS');
    return false;
  }
  
  try {
    switch (provider) {
      case 'realtime':
        return await speakWithRealtime(options.text);
      
      case 'elevenlabs':
        return await speakWithElevenLabs(options.text);
      
      case 'azure':
        return await speakWithAzure(options.text);
      
      default:
        console.warn('[VoiceFeedback] Unknown provider:', provider);
        return false;
    }
  } catch (error) {
    console.error('[VoiceFeedback] Failed to speak:', error);
    return false;
  }
}

/**
 * Speak using OpenAI Realtime API
 * Note: This requires an active Realtime API session
 */
async function speakWithRealtime(text: string): Promise<boolean> {
  // The Realtime API voice response is handled by the session itself
  // This is a placeholder for future integration where we might
  // send text back through the data channel to be spoken
  console.log('[VoiceFeedback] Realtime API TTS:', text);
  
  // In a full implementation, this would send the text through
  // the WebRTC data channel to be spoken by the active session
  return false; // Not implemented yet
}

/**
 * Speak using ElevenLabs TTS
 */
async function speakWithElevenLabs(text: string): Promise<boolean> {
  try {
    const response = await fetch('/api/integrations/elevenlabs/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      if (error.error === 'elevenlabs_not_configured') {
        console.warn('[VoiceFeedback] ElevenLabs not configured');
        return false;
      }
      
      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve(true);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        resolve(false);
      };
      
      audio.play().catch(() => resolve(false));
    });
  } catch (error) {
    console.error('[VoiceFeedback] ElevenLabs TTS error:', error);
    return false;
  }
}

/**
 * Speak using Azure TTS
 */
async function speakWithAzure(text: string): Promise<boolean> {
  try {
    const response = await fetch('/api/integrations/azure-tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      if (error.error === 'azure_tts_not_configured') {
        console.warn('[VoiceFeedback] Azure TTS not configured');
        return false;
      }
      
      throw new Error(`Azure TTS failed: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve(true);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        resolve(false);
      };
      
      audio.play().catch(() => resolve(false));
    });
  } catch (error) {
    console.error('[VoiceFeedback] Azure TTS error:', error);
    return false;
  }
}

/**
 * Helper to speak feedback after function execution
 */
export async function speakFunctionResult(
  functionName: string, 
  result: { success: boolean; message: string }
): Promise<void> {
  if (result.success && result.message) {
    await speakResponse({ 
      text: result.message, 
      priority: 'normal' 
    });
  }
}

/**
 * Check if voice feedback is enabled
 */
export function isVoiceFeedbackEnabled(): boolean {
  const settings = readSettings();
  const provider = (settings as any).voiceFeedbackProvider || 'none';
  return provider !== 'none';
}
