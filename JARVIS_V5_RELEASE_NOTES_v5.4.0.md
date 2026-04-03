# AKIOR V5.4.0 – Local LLM & Web Search

**Release Date:** December 6, 2025  
**Version:** v5.4.0

---

## Summary

AKIOR V5.4.0 is a significant milestone that transforms AKIOR into a **fully offline-capable AI operating system**. This release introduces **Local LLM integration**, enabling users to run AI models locally (via Ollama or custom HTTP APIs) with intelligent fallback to cloud services. Combined with the previously released Web Search and Weather integrations, comprehensive theming system, HUD with real-time metrics, and robust CI/CD pipeline, AKIOR V5 now offers a complete local-first AI experience with enterprise-grade reliability.

This release maintains 100% backward compatibility with cloud-only workflows while adding flexible routing options for cost optimization, offline operation, and privacy-conscious deployments.

---

## What's New in v5.4.0

### 🤖 Local LLM Integration

The headline feature of v5.4.0 is the **Local LLM integration**, which enables AKIOR to use locally-hosted language models instead of (or alongside) cloud APIs.

#### Key Features

- **Provider Support:**
  - **Ollama** (default) – Official local LLM runtime with simple HTTP API
  - **Custom HTTP** – Any OpenAI-compatible API endpoint (LM Studio, LocalAI, etc.)

- **Flexible Routing Modes:**
  - **Local as Primary:** Tries local model first, falls back to cloud GPT on failure
  - **Cloud as Primary:** Tries cloud GPT first, falls back to local model on failure  
  - **Legacy Cloud-Only:** Disabled local LLM (default, no breaking changes)

- **Full Configuration UI:**
  - Settings → Integrations → Local LLM
  - Provider selection dropdown
  - Base URL configuration (default: `http://127.0.0.1:11434`)
  - Model name input (e.g., `llama3.1`, `mistral`)
  - Temperature slider (0-1, default 0.7)
  - Max tokens input (optional)
  - API key field (for custom HTTP providers)
  - Real-time connection status badge (green "Connected" / gray "Not connected")

- **Text Chat Integration:**
  - New toggle: "Use Local LLM when available"
  - Radio buttons for priority selection (Local vs Cloud primary)
  - Web search augmentation works seamlessly with both local and cloud models
  - Graceful error handling with no crashes

#### Implementation Details

- **New Client:** `apps/server/src/clients/localLlmClient.ts`
  - Supports Ollama `/api/chat` endpoint
  - Supports custom OpenAI-compatible `/v1/chat/completions` endpoint
  - 30-second timeout with abort controller
  - Comprehensive error handling
  - Never logs API keys or full prompts

- **Updated Chat Route:** `apps/server/src/index.ts` `/openai/text-chat`
  - Three routing modes based on settings
  - Fallback logic at multiple failure points (connection, HTTP errors, timeouts)
  - Preserves existing tool calling and web search features
  - Returns optional `source` field in response (`'local-llm'` when local model is used)

- **Type System Updates:**
  - `LocalLLMIntegrationConfig` in `packages/shared/src/integrations.ts`
  - `useLocalLlm` and `localLlmPrimary` flags in `TextChatSettings`
  - Connection validation: enabled + baseUrl + model

#### Limitations

- **No streaming support:** Responses return in full after generation completes (future enhancement)
- **No tool calling:** Local LLMs don't support OpenAI's function calling API (tool calls only work with cloud GPT)
- **OpenAI-specific parameters ignored:** Reasoning effort and verbosity parameters are not passed to local models

### 📚 Comprehensive Documentation

- **NEW:** `LOCAL_LLM_INTEGRATION.md` – Complete setup guide with:
  - Ollama installation and configuration
  - Custom HTTP provider setup
  - Routing strategy explanations
  - Troubleshooting section (timeouts, connection refused, model not found)
  - Performance tips (quantized models, GPU usage)
  - Security notes (localhost, API keys, public exposure warnings)
  - Example configurations (offline-first, cost-optimized)

- **Updated:** `AKIOR_V5_TEST_PLAN.md` – Added comprehensive Local LLM test section
- **Updated:** `AKIOR_V5_REPO_OVERVIEW.md` – Updated version references

---

## Quick Recap of Earlier v5.x Releases

### v5.0.0 – Initial Local OS (June 2025)

- Holomat radial app launcher with draggable windows
- AKIOR voice assistant with real-time API
- 3D model generation and viewer
- Camera streaming and security dashboard
- Local HTTPS setup with mkcert + dev TLS proxy
- Server-side settings storage

### v5.2.0 – Theming, HUD, Weather & Integrations Cockpit (November 2025)

- **Full theming system:** Light/Dark modes, custom accent colors, persistent preferences
- **HUD with live metrics:** CPU load, memory usage, system stats on all pages
- **Weather integration:** OpenWeather API with location-based forecasts
- **Integrations cockpit:** Centralized UI for managing Weather, Web Search, Local LLM (placeholder), and future integrations
- **System metrics API:** Real-time OS stats at `/api/system/metrics`
- **Enhanced settings persistence:** Server-side JSON storage with multi-device sync

### v5.3.0 – Web Search Integration (November 2025)

- **Web Search integration:** Generic HTTP client for Tavily, SerpAPI, and other search providers
- **Web-aware chat:** Enable web search in Text Chat settings for up-to-date information
- **Settings UI:** Configuration card with Base URL, API key, and region inputs
- **Backend client:** `webSearchClient.ts` with timeout handling and multiple provider format support
- **Smoke tests:** Automated endpoint verification for `/integrations/web-search` (503 expected when unconfigured)

### v5.4.0 – Local LLM Integration (December 2025)

- **Local LLM support:** Ollama and custom HTTP API providers
- **Intelligent routing:** Local-primary, cloud-primary, and legacy modes with automatic fallback
- **Full configuration UI:** Provider, model, temperature, max tokens, API key
- **Text Chat integration:** Toggle for local LLM usage with priority selection
- **Comprehensive documentation:** Setup guides, troubleshooting, performance tips

---

## How to Run AKIOR V5.4.0 Locally

### Prerequisites

- **Node.js 20+**
- **npm** (comes with Node)
- **mkcert** (for HTTPS certificates): [Installation guide](https://github.com/FiloSottile/mkcert#installation)
- **OpenAI API key** (for cloud features): [Get API key](https://platform.openai.com/api-keys)
- **(Optional) Ollama** (for local LLM): [Install Ollama](https://ollama.com)

### Installation

```bash
# Clone the repository (if not already done)
git clone https://github.com/yosiwizman/akior-v5-os.git
cd akior-v5-os

# Checkout v5.4.0
git checkout v5.4.0

# Install dependencies
npm install
```

### Running the System

```bash
# Start all services (HTTPS proxy, Next.js, Fastify server)
npm start
```

This will:
1. Auto-generate TLS certificates for your local network (via mkcert)
2. Start the Fastify API server on `https://0.0.0.0:1234`
3. Start the Next.js dev server on `http://localhost:3001`
4. Start the HTTPS proxy on `https://localhost:3000`

### Access the App

- **Local machine:** `https://localhost:3000`
- **Other devices on LAN:** `https://<your-ip>:3000` (IP shown in terminal)

### Running Tests

```bash
# Local smoke tests (requires system running)
npm run smoke

# CI smoke tests (starts system, runs tests, stops system)
npm run ci:smoke

# Type checking
npm run typecheck

# Build verification
npm run build
```

---

## How to Configure Local LLM

For detailed setup instructions, see **`LOCAL_LLM_INTEGRATION.md`** in the repository root.

### Quick Setup with Ollama

1. **Install Ollama:**
   - Download from [https://ollama.com](https://ollama.com)
   - Follow platform-specific installation instructions

2. **Pull a model:**
   ```bash
   ollama pull llama3.1
   # or
   ollama pull mistral
   ```

3. **Verify Ollama is running:**
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```
   You should see a list of installed models.

4. **Configure in AKIOR:**
   - Open `https://localhost:3000/settings`
   - Navigate to **Integrations → Local LLM**
   - Check **Enable**
   - Provider: `Ollama (local HTTP)` (default)
   - Base URL: `http://127.0.0.1:11434` (default)
   - Model: `llama3.1` (or the model you pulled)
   - Temperature: `0.7` (default)
   - Status should change to green **"Connected"**

5. **Enable in Text Chat:**
   - Scroll to **Text Chat** section in Settings
   - Check **"Use Local LLM when available"**
   - Select routing priority:
     - **Local LLM as primary** (recommended for offline use)
     - **Cloud as primary** (recommended for best quality with cost savings)

6. **Test it:**
   - Go to `https://localhost:3000/chat`
   - Send a message (e.g., "Say hello in one sentence")
   - Response will come from your local model (check DevTools Network tab for requests to `http://127.0.0.1:11434`)

### Custom HTTP Provider

If you're using LM Studio, LocalAI, or another OpenAI-compatible server:

1. Set **Provider** to `Custom HTTP API`
2. Set **Base URL** to your server URL (e.g., `http://localhost:1234`)
3. Set **Model** to the model name your server expects
4. Optionally set **API Key** if your server requires authentication
5. Configure **Temperature** and **Max Tokens** as desired

**Note:** The custom HTTP provider assumes OpenAI-style `/v1/chat/completions` endpoint.

---

## Known Limitations

### Local LLM

- **No streaming support:** Local LLM responses are returned in full after generation completes (non-streaming). This is a deliberate simplification for v5.4.0 and may be enhanced in future releases.
- **No tool/function calling:** Local LLMs do not support OpenAI's function calling API. Tool calls (e.g., "generate an image," "create a 3D model") only work with cloud GPT.
- **Reasoning effort / verbosity ignored:** These are OpenAI-specific parameters and are not passed to local models.

### Integrations

- **Web Search:** Requires separate API key (Tavily, SerpAPI, etc.) and configuration in Settings → Integrations → Web Search.
- **Weather:** Requires `OPENWEATHER_API_KEY` environment variable on the server.
- **Audio/TTS Integrations:** Azure TTS, ElevenLabs, Spotify, Gmail, and Google Calendar are marked as "Coming soon" (placeholder UI only).

### System

- **HTTPS required:** Camera streaming and certain browser APIs require HTTPS. Use `npm start` (includes HTTPS proxy) for full functionality.
- **mkcert required:** For trusted local certificates. First-time users may see certificate warnings (safe to accept for local development).

---

## Architecture Notes

### Local LLM Routing Flow

```
User Message
    ↓
/openai/text-chat route
    ↓
Load settings (useLocalLlm, localLlmPrimary, localLLM config)
    ↓
┌─────────────────────────────────────────────────────┐
│ LOCAL-PRIMARY MODE                                  │
├─────────────────────────────────────────────────────┤
│ 1. Try callLocalLlm() → Ollama/Custom HTTP         │
│    ├─ Success → Return { message, source: 'local-llm' }
│    └─ Failure → Log warning, fallback to cloud     │
│ 2. Try OpenAI Responses API                        │
│    ├─ Success → Return { message, responseId }     │
│    └─ Failure → Return 503 error                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ CLOUD-PRIMARY MODE                                  │
├─────────────────────────────────────────────────────┤
│ 1. Try OpenAI Responses API                        │
│    ├─ Success → Return { message, responseId }     │
│    └─ Failure → Log warning, fallback to local     │
│ 2. Try callLocalLlm() → Ollama/Custom HTTP         │
│    ├─ Success → Return { message, source: 'local-llm' }
│    └─ Failure → Return error                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ LEGACY MODE (local disabled)                       │
├─────────────────────────────────────────────────────┤
│ 1. Try OpenAI Responses API                        │
│    ├─ Success → Return { message, responseId }     │
│    └─ Failure → Return error                       │
└─────────────────────────────────────────────────────┘
```

### Web Search Augmentation

Web search results (when enabled in Text Chat settings) are added to the prompt **before** routing to either local or cloud backend. This means web search works seamlessly regardless of which LLM backend is used.

---

## Migration from v5.3.0

**No breaking changes.** If you're upgrading from v5.3.0:

1. Pull the latest code: `git pull origin main`
2. Checkout v5.4.0: `git checkout v5.4.0`
3. Install dependencies: `npm install`
4. Rebuild packages: `npm run build`
5. Start the system: `npm start`

Local LLM is **disabled by default**, so your existing cloud-only workflow continues unchanged. Enable it in Settings when you're ready.

---

## Quality Assurance

### Test Results (v5.4.0)

- ✅ **TypeScript compilation:** 0 errors (`npm run typecheck`)
- ✅ **Production build:** All packages built successfully, 19 routes generated
- ✅ **CI smoke tests:** 8/8 checks passed
  - 5 page routes (Home, Settings, Chat, Menu, Holomat)
  - 3 API endpoints (System metrics, 3D print status, Web search)

### GitHub Actions CI

- Workflow: `.github/workflows/akior-ci.yml`
- Triggers: Push to `main` or `feature/*` branches, pull requests to `main`
- Steps: Install, typecheck, build, smoke tests
- Node.js: 20 LTS on `ubuntu-latest`
- Status: ✅ Passing on v5.4.0

---

## Contributors

**Lead Developer:** Max (CTO)  
**Product Owner:** Mr. W  
**Release Manager:** Max  

---

## Next Steps

### Recommended Actions

1. **Test Local LLM:** Install Ollama, configure in Settings, verify end-to-end functionality
2. **Review Documentation:** Read `LOCAL_LLM_INTEGRATION.md` for advanced configuration
3. **Run Test Plan:** Follow `AKIOR_V5_TEST_PLAN.md` for comprehensive QA
4. **Deploy v5.4.0:** Tag and push to production (if applicable)

### Future Enhancements (v5.5.0+)

- **Streaming support** for local LLM responses
- **Tool calling** for local models (via custom implementations)
- **Audio/TTS integrations** (Azure TTS, ElevenLabs)
- **Calendar and email integrations** (Google Calendar, Gmail)
- **Performance optimizations** (model caching, connection pooling)

---

## Support & Resources

- **Repository:** [https://github.com/yosiwizman/akior-v5-os](https://github.com/yosiwizman/akior-v5-os)
- **Documentation:** See repository root for detailed guides
- **Issues:** Report bugs via GitHub Issues
- **Discussions:** Use GitHub Discussions for questions and feature requests

---

**Thank you for using AKIOR V5!** 🚀
