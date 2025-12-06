# Jarvis V5.6.0 – Azure Text-to-Speech Integration

**Release Date:** December 6, 2025  
**Version:** v5.6.0

---

## Summary

Jarvis V5.6.0 introduces **Azure Text-to-Speech** as a second TTS provider alongside ElevenLabs, giving users flexible voice synthesis options. This release adds full Azure TTS integration with a multi-provider architecture, allowing users to choose between ElevenLabs and Azure TTS (or disable TTS entirely) via a simple dropdown in Settings. The Chat UI intelligently uses the selected provider when it's configured and connected, maintaining full backward compatibility with v5.5.0.

All previous features from v5.0.0–v5.5.0 remain intact: ElevenLabs TTS, Local LLM support, Web Search, Weather integration, comprehensive theming, real-time HUD, and more. Azure TTS is **purely additive**—Jarvis continues to work exactly like v5.5.0 when Azure is not configured.

---

## What's New in v5.6.0

### 🎙️ Azure Text-to-Speech Integration

Azure TTS is now a fully supported TTS provider in Jarvis, offering high-quality neural voices from Microsoft's Azure Cognitive Services.

#### Azure TTS Configuration Card

Settings → Integrations → Azure TTS now features a complete configuration card:

- **Status pill:** Green "Connected" when API key + region + voice name are set, gray "Not connected" otherwise
- **Enable toggle:** Turn Azure TTS integration on/off
- **Region field:** Azure region (e.g., `eastus`, `westus`, `westeurope`)
- **API Key field:** Password-masked input for Azure Speech resource key
- **Voice Name field:** Azure neural voice name (e.g., `en-US-JennyNeural`, `en-GB-RyanNeural`)
- **Advanced settings (collapsible):**
  - **Style:** Optional expressive style for supported voices (e.g., `cheerful`, `sad`, `excited`)
  - **Rate:** Speech rate adjustment (e.g., `+10%`, `-20%`)
  - **Pitch:** Pitch adjustment in semitones (e.g., `+2st`, `-1st`)

All settings persist to server-side JSON and sync across devices on your LAN.

#### Backend Implementation

- **New Azure TTS client:** `apps/server/src/clients/azureTtsClient.ts`
  - Calls Azure TTS REST API: `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`
  - Builds SSML (Speech Synthesis Markup Language) with voice, style, rate, and pitch
  - XML-escapes user text to prevent SSML injection
  - 30-second timeout with abort controller
  - Robust error handling without logging API keys or full text

- **New TTS endpoint:** `POST /integrations/azure-tts/tts`
  - **Request body:** `{ text: string }` (required, non-empty)
  - **Success response (200):**
    - `Content-Type: audio/mpeg`
    - Returns MP3 audio stream
    - `Cache-Control: no-store` header
  - **Error responses:**
    - `400 Bad Request` if text is missing or empty
    - `503 Service Unavailable` with JSON `{ error: 'azure_tts_not_configured' }` when integration is disabled or unconfigured
    - `502 Bad Gateway` when Azure API call fails

#### Multi-Provider TTS Architecture

**Settings → Text Chat → Text-to-speech provider:**

New dropdown selector with three options:
- **None** — Disables TTS; no "Speak answer" button appears in Chat
- **ElevenLabs** — Uses ElevenLabs TTS (v5.5.0 default, preserves backward compatibility)
- **Azure TTS** — Uses Azure TTS

**Chat UI behavior:**
- The "🔊 Speak answer" button appears on assistant messages **only when the selected provider is connected**
- If `ttsProvider === 'azure'` and Azure is connected → uses `/integrations/azure-tts/tts`
- If `ttsProvider === 'elevenlabs'` and ElevenLabs is connected → uses `/integrations/elevenlabs/tts`
- If the selected provider is not connected → button is hidden
- Clicking the button sends message text to the appropriate endpoint and plays audio via Web Audio API
- "⏹ Stop" button appears while audio is playing

#### Configuration Model Updates

- **`AzureTTSIntegrationConfig`** in `packages/shared/src/integrations.ts`:
  ```typescript
  {
    enabled: boolean;
    apiKey: string | null;
    region: string | null;        // e.g. "eastus"
    voiceName: string | null;     // e.g. "en-US-JennyNeural"
    style: string | null;         // optional, for expressive styles
    rate: string | null;          // e.g. "+10%" or "-20%"
    pitch: string | null;         // e.g. "+2st" or "-1st"
  }
  ```

- **`TtsProvider`** type in `packages/shared/src/settings.ts`:
  ```typescript
  type TtsProvider = 'none' | 'elevenlabs' | 'azure';
  ```

- **`TextChatSettings.ttsProvider`** field:
  - Default: `'elevenlabs'` (for v5.5.0 backward compatibility)
  - Determines which TTS endpoint the Chat UI calls

---

## How to Configure Azure TTS

### Prerequisites

1. **Azure Speech resource:**
   - Sign up for Azure at [https://portal.azure.com](https://portal.azure.com)
   - Create a Speech resource in your desired region
   - Note the **Region** (e.g., `eastus`) and **API Key** from the resource's Keys and Endpoint page

2. **Choose a voice:**
   - Azure offers 400+ neural voices across 140+ languages
   - Browse voices at [Azure TTS Voice Gallery](https://azure.microsoft.com/en-us/products/ai-services/text-to-speech/#overview)
   - Voice names follow the format: `{locale}-{voiceName}Neural` (e.g., `en-US-JennyNeural`)

### Configuration Steps

1. **Open Settings:**
   - Navigate to `https://localhost:3000/settings` (or your LAN IP)
   - Scroll to **Integrations → Azure TTS**

2. **Enable Integration:**
   - Check the **"Enable"** checkbox

3. **Enter Configuration:**
   - **Region:** Enter your Azure Speech resource region (e.g., `eastus`)
   - **API Key:** Paste your Azure Speech resource key (password-masked)
   - **Voice Name:** Enter the voice name (e.g., `en-US-JennyNeural`)

4. **Optional: Configure Advanced Settings:**
   - Click **"Advanced Settings"** to expand
   - **Style:** Enter an expressive style if your voice supports it (e.g., `cheerful`, `sad`, `excited`)
   - **Rate:** Adjust speech rate (e.g., `+10%` for faster, `-20%` for slower)
   - **Pitch:** Adjust pitch in semitones (e.g., `+2st` for higher, `-1st` for lower)

5. **Verify Connection:**
   - Status pill should change to green **"Connected"**
   - If not connected, double-check Region, API Key, and Voice Name

6. **Select Provider in Text Chat:**
   - Scroll to **Settings → Text chat**
   - Find the **"Text-to-speech provider"** dropdown
   - Select **"Azure TTS"**

### Usage in Chat

1. **Navigate to Chat:**
   - Go to `https://localhost:3000/chat`

2. **Send a Message:**
   - Type a message and click **"Send"**
   - Wait for assistant response

3. **Speak the Answer:**
   - Click **"🔊 Speak answer"** button below the assistant message
   - Audio synthesized via Azure TTS will play immediately
   - Button changes to **"⏹ Stop"** while playing

4. **Stop Playback:**
   - Click **"⏹ Stop"** to stop audio playback early
   - Or let audio finish naturally

**Note:** If Azure TTS is not configured or the endpoint returns 503, the button will not appear. Jarvis continues to function normally without TTS.

---

## Quick Recap of Earlier v5.x Releases

### v5.0.0 – Initial Local OS (June 2025)

- Holomat radial app launcher with draggable windows
- Jarvis voice assistant with real-time API
- 3D model generation and viewer
- Camera streaming and security dashboard
- Local HTTPS setup with mkcert + dev TLS proxy
- Server-side settings storage

### v5.2.0 – Theming, HUD, Weather & Integrations Cockpit (November 2025)

- **Full theming system:** Light/Dark modes, custom accent colors, persistent preferences
- **HUD with live metrics:** CPU load, memory usage, system stats on all pages
- **Weather integration:** OpenWeather API with location-based forecasts
- **Integrations cockpit:** Centralized UI for managing integrations
- **System metrics API:** Real-time OS stats at `/api/system/metrics`

### v5.3.0 – Web Search Integration (November 2025)

- **Web Search integration:** Generic HTTP client for Tavily, SerpAPI, and other search providers
- **Web-aware chat:** Enable web search in Text Chat settings for up-to-date information
- **Settings UI:** Configuration card with Base URL, API key, and region inputs

### v5.4.0 – Local LLM Integration (December 2025)

- **Local LLM support:** Ollama and custom HTTP API providers
- **Intelligent routing:** Local-primary, cloud-primary, and legacy modes with automatic fallback
- **Full configuration UI:** Provider, model, temperature, max tokens, API key

### v5.5.0 – ElevenLabs TTS Integration (December 2025)

- **ElevenLabs text-to-speech:** High-quality neural voice generation
- **Full configuration UI:** API key, voice ID, model ID, advanced voice settings
- **Chat UI "Speak answer" button:** Play assistant responses aloud with one click

### v5.6.0 – Azure TTS Integration (December 2025)

- **Azure Text-to-Speech:** Second TTS provider with Microsoft's neural voices
- **Multi-provider architecture:** Choose between ElevenLabs, Azure TTS, or None
- **Full configuration UI:** Region, API key, voice name, style, rate, pitch
- **Settings-driven provider selection:** Explicit provider choice in Text Chat settings

---

## Architecture Overview

### Azure TTS Flow

```
User clicks "🔊 Speak answer" on assistant message
    ↓
Chat UI calls getActiveTtsProvider()
    ↓
┌─────────────────────────────────────────────────┐
│ Provider Selection Logic                        │
├─────────────────────────────────────────────────┤
│ textChat.ttsProvider === 'azure'                │
│   AND azureTTS is connected?                    │
│   ├─ YES → Return { endpoint: '/integrations/  │
│   │         azure-tts/tts', name: 'Azure TTS' } │
│   └─ NO → Check ElevenLabs or return null       │
└─────────────────────────────────────────────────┘
    ↓
POST to /integrations/azure-tts/tts with { text }
    ↓
Server validates Azure TTS configuration
    ↓
┌─────────────────────────────────────────────────┐
│ Configuration Check                             │
├─────────────────────────────────────────────────┤
│ Enabled? API Key? Region? Voice Name?          │
│   ├─ NO → Return 503 with JSON error           │
│   └─ YES → Continue to Azure API               │
└─────────────────────────────────────────────────┘
    ↓
Call synthesizeWithAzureTts() in azureTtsClient.ts
    ↓
Build SSML with voice, style, rate, pitch
    ↓
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
    Headers: Ocp-Apim-Subscription-Key, Content-Type: application/ssml+xml
    Body: SSML string with escaped user text
    ↓
┌─────────────────────────────────────────────────┐
│ Azure TTS API Response                          │
├─────────────────────────────────────────────────┤
│ Success → Return audio/mpeg MP3 buffer         │
│ Error → Throw error (network, rate limit, etc.)│
└─────────────────────────────────────────────────┘
    ↓
Server returns audio/mpeg stream to client
    ↓
Chat UI creates Audio object from blob
    ↓
Audio.play() → User hears assistant message
    ↓
On audio end → Clean up blob URL, reset button state
```

### SSML Generation

Azure TTS uses SSML (Speech Synthesis Markup Language) to control voice synthesis:

```xml
<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="en-US-JennyNeural">
    <prosody rate="+10%" pitch="+0st">
      <mstts:express-as style="cheerful">
        User's message text goes here (XML-escaped)
      </mstts:express-as>
    </prosody>
  </voice>
</speak>
```

- **Voice tag:** Specifies the neural voice by name
- **Prosody tag:** Controls rate and pitch (optional, only if configured)
- **Express-as tag:** Controls expressive style (optional, only if configured and voice supports it)
- **User text:** Always XML-escaped to prevent SSML injection

---

## Quality Gates

All quality gates passed for v5.6.0:

### Automated Checks

- ✅ **TypeScript compilation:** 0 errors (`npm run typecheck`)
  - Server, Web, and Shared packages all compile cleanly

- ✅ **Production build:** All packages built successfully, 19 routes generated
  - Next.js production build completes without warnings
  - Chat page: 9.93 kB (includes multi-provider TTS logic)
  - Settings page: 12 kB (includes Azure TTS card)

- ✅ **CI smoke tests:** 10/10 checks passed (`npm run ci:smoke`)
  - 5 page routes: Home, Settings, Chat, Menu, Holomat
  - 5 API endpoints:
    - System metrics (200 expected)
    - 3D print token status (200 expected)
    - Web Search unconfigured (503 expected)
    - ElevenLabs TTS unconfigured (503 expected)
    - **NEW:** Azure TTS unconfigured (503 expected)

### Manual Testing

- ✅ **Settings UI:** Azure TTS card displays correctly with all fields
- ✅ **Connection status:** Green "Connected" when configured, gray "Not connected" when unconfigured
- ✅ **Provider selector:** Dropdown in Text Chat settings with None/ElevenLabs/Azure options
- ✅ **Chat UI:** "Speak answer" button appears/disappears based on selected provider
- ✅ **TTS playback:** Audio plays successfully when configured with valid Azure credentials
- ✅ **Error handling:** Graceful 503 error when unconfigured, no crashes

---

## Backward Compatibility

### No Breaking Changes

- **Default `ttsProvider`:** Set to `'elevenlabs'` in settings defaults
- **Existing behavior preserved:** If Azure TTS is never configured, Jarvis behaves exactly like v5.5.0
- **ElevenLabs unchanged:** ElevenLabs integration works identically to v5.5.0
- **Settings migration:** All previous integration settings (Weather, Web Search, Local LLM, ElevenLabs) remain intact

### Upgrade from v5.5.0

If you're upgrading from v5.5.0:

1. Pull the latest code: `git pull origin main`
2. Checkout v5.6.0: `git checkout v5.6.0`
3. Install dependencies: `npm install` (if needed)
4. Rebuild packages: `npm run build`
5. Start the system: `npm start`

Your existing ElevenLabs configuration will continue to work. The new TTS provider selector defaults to `'elevenlabs'`, maintaining your v5.5.0 workflow. Configure Azure TTS in Settings only when you're ready to try it.

---

## Known Limitations

### Azure TTS

- **No streaming:** Audio is synthesized in full before playback begins (non-streaming)
- **Manual voice entry:** Voice name must be typed; no voice picker UI yet (see Future Work)
- **Internet required:** Azure TTS API requires internet access (even if using Local LLM for chat)
- **API rate limits:** Azure free tier has character/hour limits; monitor usage in Azure portal
- **Network errors:** If Azure API is unreachable or returns an error (bad key, rate limit), TTS fails gracefully; Chat continues without audio
- **One message at a time:** Only one assistant message can be spoken at a time

### ElevenLabs TTS

- **No streaming:** Audio is synthesized in full before playback (same as Azure)
- **API rate limits:** Free-tier accounts have character limits per month

### Other Integrations

- **Local LLM:** No tool calling support (function calls only work with cloud GPT). No streaming responses.
- **Web Search:** Requires separate API key (Tavily, SerpAPI, etc.)
- **Weather:** Requires `OPENWEATHER_API_KEY` environment variable on the server

### System

- **HTTPS required:** Camera streaming and certain browser APIs require HTTPS. Use `npm start` for full functionality.
- **mkcert required:** For trusted local certificates

---

## Future Work (v5.7.0+)

### Voice Selection UI

- Add a voice browser/picker in Settings
- Fetch available voices from Azure `/voices/list` endpoint
- Display voice names, languages, genders, and sample audio for easy selection
- Similar UI for ElevenLabs voice browsing

### SSML Preview / Test Voice

- Add a "Test Voice" button in Settings
- Synthesizes a sample phrase with current config
- Helps users preview voice/style/rate/pitch before using in Chat

### Streaming TTS

- Both Azure and ElevenLabs support streaming
- Implement progressive audio playback for faster perceived response time
- Start playing audio as soon as first chunks arrive

### Provider Auto-Detection

- Optionally auto-select provider based on what's configured
- If only one provider is connected, use it automatically
- Reduce configuration burden for users with single provider

### Rate Limiting UI

- Display character usage/limits for free-tier accounts
- Warn users before exceeding quotas
- Real-time usage tracking for both Azure and ElevenLabs

### Additional TTS Providers

- Google Cloud Text-to-Speech (similar REST API architecture)
- AWS Polly
- OpenAI TTS (simple HTTP API)
- Extensible provider system for easy third-party additions

### Voice Cloning

- Azure supports custom neural voices
- Add UI for uploading voice samples
- Train custom voices directly from Jarvis

---

## Migration from v5.5.0

**No breaking changes.** If you're upgrading from v5.5.0:

1. Pull the latest code: `git pull origin main`
2. Checkout v5.6.0: `git checkout v5.6.0`
3. Install dependencies: `npm install`
4. Rebuild packages: `npm run build`
5. Start the system: `npm start`

Azure TTS is **disabled by default**. Your existing ElevenLabs workflow continues unchanged. Enable Azure TTS in Settings when you're ready to use it.

---

## Contributors

**Lead Developer:** Max (CTO)  
**Product Owner:** Mr. W  
**Release Manager:** Max  

---

## Support & Resources

- **Repository:** [https://github.com/yosiwizman/jarvis-v5-os](https://github.com/yosiwizman/jarvis-v5-os)
- **Documentation:** See repository root for detailed guides
- **Issues:** Report bugs via GitHub Issues
- **Discussions:** Use GitHub Discussions for questions and feature requests
- **Azure TTS Docs:** [https://learn.microsoft.com/en-us/azure/ai-services/speech-service/](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)

---

**Thank you for using Jarvis V5!** 🚀🎙️
