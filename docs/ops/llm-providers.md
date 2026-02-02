# LLM Provider Configuration

AKIOR supports multiple LLM backends through a unified provider abstraction layer.

## Supported Providers

### OpenAI Cloud (Default)
Use OpenAI's API directly with your API key.

- **Provider ID**: `openai-cloud`
- **Requirements**: Valid OpenAI API key
- **Base URL**: Fixed at `https://api.openai.com/v1`

```
Provider: OpenAI Cloud
API Key: sk-...
```

### Local / OpenAI-Compatible
Use any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.).

- **Provider ID**: `local-compatible`
- **Requirements**: Base URL pointing to compatible endpoint
- **API Key**: Optional (some local servers require authentication)

```
Provider: Local / Compatible
Base URL: http://localhost:11434/v1
API Key: (optional)
```

## Configuration

### Via Setup Wizard (Recommended)
1. Navigate to **Settings** → **Setup Wizard**
2. Complete Step 3: LLM Provider
3. Select your provider type
4. Enter required credentials
5. Test connection before saving

### Via API (Admin Only)

```bash
# Get current config (secrets redacted)
curl -X GET https://akior.home/api/admin/llm/config \
  -H "Cookie: akior_admin_session=..."

# Update config
curl -X POST https://akior.home/api/admin/llm/config \
  -H "Content-Type: application/json" \
  -H "Cookie: akior_admin_session=..." \
  -d '{"provider": "openai-cloud", "apiKey": "sk-..."}'

# Test connection
curl -X POST https://akior.home/api/admin/llm/test \
  -H "Content-Type: application/json" \
  -H "Cookie: akior_admin_session=..." \
  -d '{"provider": "openai-cloud", "apiKey": "sk-..."}'
```

## Health Status

LLM provider status is reported in the health endpoint:

```bash
curl https://akior.home/api/health/status
```

Response includes:
```json
{
  "level": "healthy",
  "details": {
    "llm": {
      "provider": "openai-cloud",
      "configured": true,
      "baseUrlHost": "api.openai.com"
    }
  }
}
```

## Security

- API keys are stored securely using the secret store
- Keys are **never** returned in API responses
- Only the presence (boolean) of keys is exposed
- Admin authentication (Owner PIN) required for all LLM config endpoints

## Troubleshooting

### "LLM provider not configured"
- Visit Setup Wizard to configure your provider
- Check that API key or base URL is set correctly

### Connection test fails
- **OpenAI Cloud**: Verify API key is valid at platform.openai.com
- **Local/Compatible**: Ensure local server is running and accessible
- Check network/firewall if using remote endpoints

### "401 Unauthorized" on config endpoints
- Ensure you've authenticated with Owner PIN
- Check that `akior_admin_session` cookie is present

## Local LLM Setup Examples

### Ollama
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Ollama serves at http://localhost:11434/v1 by default
```

In AKIOR:
- Provider: Local / Compatible
- Base URL: `http://localhost:11434/v1`
- API Key: (leave empty)

### LM Studio
1. Start LM Studio server
2. Enable "OpenAI Compatible Server" in settings
3. Note the server URL (usually `http://localhost:1234/v1`)

In AKIOR:
- Provider: Local / Compatible
- Base URL: `http://localhost:1234/v1`
- API Key: (leave empty unless configured in LM Studio)

### vLLM
```bash
# Start vLLM with OpenAI-compatible API
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct
```

In AKIOR:
- Provider: Local / Compatible
- Base URL: `http://localhost:8000/v1`
- API Key: (as configured)
