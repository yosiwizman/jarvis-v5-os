/**
 * Azure TTS Client
 * 
 * Client for Azure Cognitive Services Text-to-Speech API
 * Synthesizes text into speech using neural voices from Azure
 */

export interface AzureTtsConfig {
  apiKey: string;
  region: string;
  voiceName: string;
  style?: string | null;
  rate?: string | null;
  pitch?: string | null;
}

/**
 * Simple XML escape helper for user text
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build SSML (Speech Synthesis Markup Language) string
 */
function buildSsml(text: string, cfg: AzureTtsConfig): string {
  const escapedText = escapeXml(text);
  
  // Extract language code from voice name (e.g. "en-US" from "en-US-JennyNeural")
  const langMatch = cfg.voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
  const xmlLang = langMatch ? langMatch[1] : 'en-US';
  
  // Check if we need prosody or express-as tags
  const hasProsody = cfg.rate || cfg.pitch;
  const hasStyle = cfg.style;
  
  let voiceContent = escapedText;
  
  // Wrap in prosody if rate or pitch is specified
  if (hasProsody) {
    const rateAttr = cfg.rate ? ` rate="${cfg.rate}"` : '';
    const pitchAttr = cfg.pitch ? ` pitch="${cfg.pitch}"` : '';
    voiceContent = `<prosody${rateAttr}${pitchAttr}>${voiceContent}</prosody>`;
  }
  
  // Wrap in express-as if style is specified (for expressive voices)
  if (hasStyle && cfg.style) {
    voiceContent = `<mstts:express-as style="${cfg.style}">${voiceContent}</mstts:express-as>`;
  }
  
  // Build full SSML
  const ssml = `<speak version="1.0" xml:lang="${xmlLang}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="${cfg.voiceName}">
    ${voiceContent}
  </voice>
</speak>`;
  
  return ssml;
}

/**
 * Synthesize text to speech using Azure TTS API
 * @returns Buffer containing MP3 audio data
 */
export async function synthesizeWithAzureTts(
  text: string,
  cfg: AzureTtsConfig,
  abortSignal?: AbortSignal
): Promise<Buffer> {
  const url = `https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  
  // Build SSML request body
  const ssml = buildSsml(text, cfg);
  
  try {
    console.log(`[Azure TTS] Synthesizing text (${text.length} chars) with voice "${cfg.voiceName}" in region "${cfg.region}"`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    // Use provided abort signal if available, otherwise use our timeout controller
    const signal = abortSignal || controller.signal;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cfg.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'jarvis-v5-azure-tts'
      },
      body: ssml,
      signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // Log error without sensitive details
      console.error(`[Azure TTS] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Azure TTS API returned ${response.status}`);
    }
    
    // Get response as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[Azure TTS] Successfully synthesized ${buffer.length} bytes of audio`);
    
    return buffer;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Azure TTS] Request timeout after 30 seconds');
      throw new Error('Azure TTS request timeout');
    }
    
    // Log error without exposing API key or full text
    console.error('[Azure TTS] Synthesis failed:', (error as Error).message);
    throw error;
  }
}
