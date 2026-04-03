# AKIOR First-Run Setup Guide

This guide walks you through setting up AKIOR for the first time after deployment.

## Prerequisites

- AKIOR containers are running (`docker compose -f deploy/compose.akior.yml up -d`)
- You can access `https://akior.home.arpa` (or `https://akior.local`)
- You have an LLM provider: OpenAI API key OR local OpenAI-compatible server (e.g., Ollama)
- Optionally: Meshy API key for 3D model generation

## Quick Start

### Step 1: Set Owner PIN

1. Navigate to `https://akior.home.arpa/setup`
2. In Step 1, enter a 4-8 digit PIN
3. Confirm the PIN
4. Click "Set PIN"

**Important:** This PIN protects access to Setup and Settings. Store it securely - there is no automated recovery.

### Step 2: Trust HTTPS Certificate

**On the primary Windows machine:**

Run this command in PowerShell from the repository root:

```powershell
.\ops\trust-lan-https.ps1 -Apply
```

This extracts the Caddy CA certificate from the container and installs it to your Windows trust store.

**After installation, restart your browser completely** (close all windows).

**Verify:** Visit `https://akior.home.arpa/diagnostics` and check that "Trusted HTTPS" shows a green checkmark.

#### Multi-Device Trust (Other Devices on LAN)

To access AKIOR from other devices (phones, tablets, laptops), you need to install the CA certificate on each device:

1. In the Setup Wizard (`/setup`), click "Download Certificate" in Step 2
2. Transfer the `akior-ca.crt` file to your other device
3. Follow the device-specific instructions in the Setup Wizard:
   - **Windows:** Double-click → Install Certificate → Local Machine → Trusted Root
   - **macOS:** Double-click → Keychain Access → Always Trust
   - **iOS:** AirDrop/email → Settings → Profile Downloaded → Install → Trust
   - **Android:** Settings → Security → Install certificate (varies by manufacturer)

Alternatively, download from Settings or Diagnostics pages.

### Step 3: Configure LLM Provider

1. Navigate to `https://akior.home.arpa/setup`
2. In Step 4, select your LLM provider:
   - **OpenAI Cloud:** Enter your API key (starts with `sk-`)
   - **Local/Compatible:** Enter your local server URL
     - For Ollama: Use `http://host.docker.internal:11434/v1` (Docker) or `http://localhost:11434/v1` (native)
     - For LM Studio or other OpenAI-compatible servers: use their base URL
3. Click "Test Connection" to validate
4. Click "Save Provider" to store the configuration
5. Optionally add your Meshy API key for 3D features (Step 5)

**Docker Networking Note:**

When AKIOR runs in Docker and you want to use Ollama running on the host machine:
- The server container is configured with `host.docker.internal` pointing to the host
- Default: `OLLAMA_BASE_URL=http://host.docker.internal:11434`
- This is automatically set in `compose.akior.yml`
- Works on Docker Desktop (Windows/Mac) and Docker on Linux with `extra_hosts` configuration

### Step 4: Verify Setup

Visit `https://akior.home.arpa/diagnostics` and confirm:

- **System Status:** Shows "System Healthy" (green)
- **SHA Match:** Web and Server SHAs match
- **HTTPS Trust:** Shows "Trusted HTTPS" ✓

## What Each Step Does

### HTTPS Trust

AKIOR uses Caddy's internal Certificate Authority (CA) to provide HTTPS on your local network. Installing the CA certificate tells your browser to trust this internal CA.

**Why is this needed?**
- Browsers require a "secure context" for mic/camera access
- Without trust, browsers show certificate warnings
- Web APIs like `navigator.mediaDevices` won't work

### LLM Provider

**OpenAI Cloud:**
- Powers the Voice Assistant (realtime voice conversations)
- Powers the Chat interface
- Powers image analysis features
- Get your key at: https://platform.openai.com/api-keys

**Local/OpenAI-Compatible:**
- Use local models with Ollama, LM Studio, vLLM, etc.
- Default for Ollama in Docker: `http://host.docker.internal:11434/v1`
- Point to any OpenAI-compatible API endpoint
- No API key required (unless your local server requires it)
- See [LLM Providers Guide](../ops/llm-providers.md) for detailed Ollama setup

**Meshy (Optional):**
- Enables 3D model generation from images
- Used by the "3D Model" and "Capture" features
- Get your key at: https://www.meshy.ai/api

## Safe Degraded Mode

AKIOR is designed to handle incomplete setup gracefully. When the system is not fully configured:

**Expected Behavior:**
- UI displays "Setup Required" banner on /menu
- No 500 errors or exception spam in browser console
- API endpoints that require setup return **HTTP 428 (Precondition Required)** with structured error:
  ```json
  {
    "ok": false,
    "error": { "code": "SETUP_REQUIRED", "message": "..." },
    "setup": { "ownerPin": false, "llm": false }
  }
  ```
- Admin endpoints return **HTTP 401 (Unauthorized)** when setup is complete but user is not authenticated
- Features that depend on setup are gated and won't attempt to make requests
- Diagnostic endpoints (/api/health/status) remain accessible and report setup state

**What Gets Gated:**
- Voice Assistant (requires LLM provider configuration)
- Image generation (requires OpenAI API key)
- 3D model generation (requires Meshy API key)
- Admin-only settings and configuration pages (require Owner PIN authentication)

**What Remains Available:**
- Setup wizard (/setup)
- Diagnostics page (/diagnostics)
- Menu page (shows available features and setup requirements)
- Public health check endpoints

This design ensures a clean first-run experience without error noise while clearly guiding users through configuration.

## Troubleshooting

### "Setup Required" still showing after configuring LLM

1. Hard-refresh the page (Ctrl+Shift+R)
2. Check `/api/health/status` directly to verify LLM provider status
3. Ensure the configuration was saved successfully (look for green confirmation)

### Certificate still not trusted after installation

1. **Close ALL browser windows** and reopen
2. Clear browser cache
3. Try in incognito/private window first
4. Verify certificate is installed: `.\ops\trust-lan-https.ps1 -Verify`

### Can't reach AKIOR at all

1. Check containers are running: `docker compose -f deploy/compose.akior.yml ps`
2. Check DNS resolution: `nslookup akior.home.arpa`
3. Try the fallback hostname: `https://akior.local`
4. Run DNS doctor: `.\ops\dns-doctor.ps1 -Apply -UseLoopback`

### Voice Assistant shows error

1. Verify LLM provider is configured (check `/setup` or `/settings`)
2. Ensure HTTPS is trusted (mic/camera requires secure context)
3. Check browser console for specific error messages
4. Note: Realtime voice requires OpenAI Cloud provider

### Step 5: Remote Access (Optional)

If you want to access AKIOR from outside your home network (e.g., from work or while traveling), you can enable secure remote access via Tailscale:

1. Install [Tailscale](https://tailscale.com/download) on the AKIOR host machine
2. Login: `tailscale login`
3. In the Setup Wizard, Step 3 (Remote Access), click "Enable Remote Access"
4. Access AKIOR from any device on your Tailscale network using your machine's Tailscale hostname

**Security:** This uses Tailscale's WireGuard VPN - no ports are opened on your router.

See [Remote Access Guide](../ops/remote-access.md) for details.

## Post-Setup

Once setup is complete:

1. **Voice Assistant:** `/akior` - Full-screen voice interface
2. **Menu:** `/menu` - All available features
3. **Settings:** `/settings` - Advanced configuration
4. **Diagnostics:** `/diagnostics` - System health

## Redeploy After Changes

If you update the code, redeploy with:

```powershell
.\ops\deploy.ps1 -Rebuild
```

This rebuilds both web and server containers with matching SHAs.

## Related Documentation

- [Owner PIN Authentication](../security/owner-pin.md) - PIN reset and security details
- [Trusted LAN HTTPS](../networking/trusted-lan-https.md) - Detailed certificate trust guide
- [DNS Setup](../ops/dns-setup.md) - Hostname configuration
- [LLM Providers](../ops/llm-providers.md) - OpenAI and local LLM configuration
- [Remote Access](../ops/remote-access.md) - Tailscale Serve for secure remote access
