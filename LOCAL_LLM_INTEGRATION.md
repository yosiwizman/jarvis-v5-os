# Local LLM Integration (v5.4.0)

AKIOR V5 now supports running with local LLM models through **Ollama** or custom OpenAI-compatible HTTP APIs.

---

## Features

- **Provider Support**: Ollama and custom HTTP endpoints
- **Flexible Routing**: Use local as primary with cloud fallback, or cloud as primary with local fallback
- **Seamless Integration**: Works with existing Text Chat UI and web search augmentation
- **Configurable**: Model, temperature, max tokens, and API key (for custom HTTP) settings

---

## Quick Start with Ollama

### 1. Install Ollama

Download and install Ollama from [https://ollama.com](https://ollama.com)

### 2. Pull a Model

```bash
ollama pull llama3.1
# or
ollama pull mistral
# or any other model
```

### 3. Verify Ollama is Running

Ollama automatically starts a local HTTP server on port **11434**. Test it:

```bash
curl http://127.0.0.1:11434/api/tags
```

You should see a list of installed models.

### 4. Configure AKIOR

1. Open **Settings** in AKIOR web UI
2. Navigate to **Integrations → Local LLM**
3. Enable the integration
4. Configure:
   - **Provider**: `Ollama (local HTTP)` (default)
   - **Base URL**: `http://127.0.0.1:11434` (default)
   - **Model**: `llama3.1` (or the model you pulled)
   - **Temperature**: `0.7` (default)
   - **Max Tokens**: Leave empty for model default

5. Scroll to **Text Chat** section
6. Enable **"Use Local LLM when available"**
7. Choose priority:
   - **Local LLM as primary, cloud as fallback** (recommended for offline use)
   - **Cloud as primary, local as fallback** (recommended for best quality with cost savings on failures)

---

## Custom HTTP Provider

If you're running a different local LLM server (LM Studio, LocalAI, etc.) that provides an OpenAI-compatible API:

1. Set **Provider** to `Custom HTTP API`
2. Set **Base URL** to your server URL (e.g., `http://localhost:1234`)
3. Set **Model** to the model name your server expects
4. Optionally set **API Key** if your server requires authentication
5. Configure **Temperature** and **Max Tokens** as desired

**Note**: The custom HTTP provider assumes OpenAI-style `/v1/chat/completions` endpoint.

---

## How Routing Works

### Local as Primary

When **"Local LLM as primary"** is selected:
1. Chat requests go to the local LLM first
2. If local fails (connection refused, timeout, error), AKIOR falls back to cloud GPT
3. If both fail, you'll receive an error

### Cloud as Primary

When **"Cloud as primary"** is selected:
1. Chat requests go to cloud GPT first
2. If cloud fails (rate limit, network error, etc.), AKIOR falls back to local LLM
3. If both fail, you'll receive an error

### Legacy Mode (Local Disabled)

If **"Use Local LLM when available"** is unchecked, AKIOR behaves exactly as before (cloud-only).

---

## Web Search Integration

Web search augmentation (if enabled in Text Chat settings) works the same way with local LLMs. Search results are added to the prompt before sending to the model.

---

## Troubleshooting

### "Not connected" Status

The integration shows "Not connected" if:
- **Enable** checkbox is unchecked, OR
- **Base URL** is empty, OR
- **Model** is empty

Make sure all three are set.

### Local LLM Timeouts

- Default timeout is **30 seconds**
- If your model is slow or your hardware is limited, requests may timeout
- Try a smaller/faster model (e.g., `llama3.1:8b` instead of `llama3.1:70b`)

### Connection Refused

- Make sure Ollama is running (`ollama serve` or check system tray)
- Verify the base URL is correct (`http://127.0.0.1:11434` for Ollama)
- Check firewall settings if using a remote server

### Model Not Found

- Pull the model with `ollama pull <model-name>`
- Verify the model name matches exactly (case-sensitive)

---

## Limitations

- **Streaming**: Not implemented yet. Responses are returned in full after generation completes.
- **Tool Calling**: Local LLMs do not support OpenAI's function calling API. Tool calls are only available with cloud GPT.
- **Reasoning Effort / Verbosity**: These parameters are ignored for local LLMs (OpenAI-specific).

---

## Performance Tips

- Use quantized models (e.g., `llama3.1:8b-instruct-q4_0`) for faster responses
- Lower the **Temperature** for more deterministic outputs
- Set **Max Tokens** to limit response length and speed up generation
- Run Ollama on a machine with a GPU for significant speed improvements

---

## Security Notes

- Ollama runs on localhost by default and does not require authentication
- Custom HTTP APIs may require an API key — store it securely in the AKIOR settings
- API keys are saved server-side in `apps/server/data/settings.json` and never sent to the browser
- **Never expose your local LLM server to the public internet without authentication**

---

## Examples

### Example: Offline-First Setup

**Use Case**: You want AKIOR to work even when you don't have internet access or want to avoid cloud API costs.

**Configuration**:
- Enable Local LLM
- Provider: Ollama
- Model: `llama3.1`
- Enable "Use Local LLM when available"
- Select "Local LLM as primary, cloud as fallback"
- Keep cloud OpenAI key configured (optional, for fallback)

**Behavior**: All chat requests go to your local Ollama model. If Ollama is down or errors out, AKIOR falls back to OpenAI.

---

### Example: Cost-Optimized Setup

**Use Case**: You have a cloud API key but want to save costs by using local LLM as a fallback when cloud is unavailable (e.g., rate limits).

**Configuration**:
- Enable Local LLM
- Provider: Ollama
- Model: `mistral`
- Enable "Use Local LLM when available"
- Select "Cloud as primary, local as fallback"

**Behavior**: All chat requests go to OpenAI cloud. If OpenAI returns an error (rate limit, network issue, etc.), AKIOR tries your local Mistral model.

---

## Version History

- **v5.4.0** (2025-12-06): Initial Local LLM integration with Ollama and custom HTTP support
