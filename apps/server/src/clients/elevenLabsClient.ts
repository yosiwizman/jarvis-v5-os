/**
 * ElevenLabs TTS Client
 * 
 * Client for ElevenLabs text-to-speech API
 * Synthesizes text into high-quality speech using neural voices
 */

export interface ElevenLabsTtsOptions {
  text: string;
  apiKey: string;
  voiceId: string;
  modelId?: string | null;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
}

/**
 * Synthesize text to speech using ElevenLabs API
 * @returns Buffer containing MP3 audio data
 */
export async function synthesizeWithElevenLabs(opts: ElevenLabsTtsOptions): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}`;
  
  // Build request body
  const body: any = {
    text: opts.text,
    model_id: opts.modelId || 'eleven_multilingual_v2',
    voice_settings: {
      stability: opts.stability ?? 0.5,
      similarity_boost: opts.similarityBoost ?? 0.75
    }
  };

  // Add style if provided (only supported by some models)
  if (opts.style !== null && opts.style !== undefined) {
    body.voice_settings.style = opts.style;
  }

  try {
    console.log(`[ElevenLabs] Synthesizing text (${opts.text.length} chars) with voice "${opts.voiceId}"`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': opts.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[ElevenLabs] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`ElevenLabs API returned ${response.status}`);
    }

    // Get response as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[ElevenLabs] Successfully synthesized ${buffer.length} bytes of audio`);
    
    return buffer;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[ElevenLabs] Request timeout after 30 seconds');
      throw new Error('ElevenLabs request timeout');
    }

    console.error('[ElevenLabs] Synthesis failed:', (error as Error).message);
    throw error;
  }
}
