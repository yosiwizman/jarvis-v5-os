# AKIOR First-Run Setup Guide

This guide walks you through setting up AKIOR for the first time after deployment.

## Prerequisites

- AKIOR containers are running (`docker compose -f deploy/compose.jarvis.yml up -d`)
- You can access `https://akior.home.arpa` (or `https://akior.local`)
- You have an OpenAI API key (required)
- Optionally: Meshy API key for 3D model generation

## Quick Start

### Step 1: Trust HTTPS Certificate (Windows)

Run this command in PowerShell from the repository root:

```powershell
.\ops\trust-lan-https.ps1 -Apply
```

This extracts the Caddy CA certificate from the container and installs it to your Windows trust store.

**After installation, restart your browser completely** (close all windows).

**Verify:** Visit `https://akior.home.arpa/diagnostics` and check that "Trusted HTTPS" shows a green checkmark.

### Step 2: Configure API Keys

1. Navigate to `https://akior.home.arpa/setup`
2. Enter your OpenAI API key (starts with `sk-`)
3. Click "Test Key" to validate
4. Click "Save Key" to store it
5. Optionally add your Meshy API key for 3D features

### Step 3: Verify Setup

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

### API Keys

**OpenAI (Required):**
- Powers the Voice Assistant (realtime voice conversations)
- Powers the Chat interface
- Powers image analysis features

Get your key at: https://platform.openai.com/api-keys

**Meshy (Optional):**
- Enables 3D model generation from images
- Used by the "3D Model" and "Capture" features

Get your key at: https://www.meshy.ai/api

## Troubleshooting

### "Setup Required" still showing after adding keys

1. Hard-refresh the page (Ctrl+Shift+R)
2. Check `/api/health/status` directly to verify key presence
3. Ensure the key was saved successfully (look for green confirmation)

### Certificate still not trusted after installation

1. **Close ALL browser windows** and reopen
2. Clear browser cache
3. Try in incognito/private window first
4. Verify certificate is installed: `.\ops\trust-lan-https.ps1 -Verify`

### Can't reach AKIOR at all

1. Check containers are running: `docker compose -f deploy/compose.jarvis.yml ps`
2. Check DNS resolution: `nslookup akior.home.arpa`
3. Try the fallback hostname: `https://akior.local`
4. Run DNS doctor: `.\ops\dns-doctor.ps1 -Apply -UseLoopback`

### Voice Assistant shows error

1. Verify OpenAI key is configured (check `/setup` or `/settings`)
2. Ensure HTTPS is trusted (mic/camera requires secure context)
3. Check browser console for specific error messages

## Post-Setup

Once setup is complete:

1. **Voice Assistant:** `/jarvis` - Full-screen voice interface
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

- [Trusted LAN HTTPS](../networking/trusted-lan-https.md) - Detailed certificate trust guide
- [DNS Setup](../ops/dns-setup.md) - Hostname configuration
