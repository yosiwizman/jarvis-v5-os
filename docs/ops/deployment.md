# Jarvis V5/V6 Deployment Runbook

## Architecture Overview

```
┌─────────────────┐     WebSocket (persistent)      ┌─────────────────┐
│   Vercel        │◄──────────────────────────────►│   Fly.io        │
│   (Next.js Web) │                                │   (Fastify API) │
│   apps/web      │        REST API calls          │   apps/server   │
│                 │◄──────────────────────────────►│                 │
│                 │                                │   + Socket.IO   │
└─────────────────┘                                └─────────────────┘
     HTTPS                                              HTTPS
     Port 443                                           Port 443
```

### Why This Split?

- **Vercel for Web (apps/web)**: Next.js-optimized hosting with edge caching, preview deployments, and automatic HTTPS.
- **Fly.io for Server (apps/server)**: Vercel Functions are not intended for long-lived WebSocket connections. Fly.io supports WebSockets natively and runs persistent Node.js processes required by Socket.IO.

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 20.x | https://nodejs.org |
| flyctl | latest | https://fly.io/docs/hands-on/install-flyctl/ |
| Vercel CLI (optional) | latest | `npm i -g vercel` |

## Environment Variables Contract

### Web (apps/web) — Set in Vercel Dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Fly.io server URL (e.g., `https://jarvis-server.fly.dev`) |
| `NEXT_PUBLIC_SOCKET_URL` | Yes | Same as API URL for WebSocket connections |
| `NEXT_PUBLIC_JARVIS_UBUNTU_MODE` | No | Set to `kiosk` for Ubuntu shell mode |

### Server (apps/server) — Set via `flyctl secrets set`

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `ELEVENLABS_API_KEY` | No | ElevenLabs TTS API key |
| `OPENWEATHER_API_KEY` | No | OpenWeatherMap API key |
| `SERPAPI_API_KEY` | No | SerpAPI key for web search |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `SPOTIFY_CLIENT_ID` | No | Spotify client ID |
| `SPOTIFY_CLIENT_SECRET` | No | Spotify client secret |

## Initial Deployment

### 1. Deploy Server to Fly.io

```bash
# Install flyctl if not already installed
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
flyctl auth login

# Create the app (first time only)
cd apps/server
flyctl apps create jarvis-server  # or your preferred name

# Set secrets
flyctl secrets set OPENAI_API_KEY=sk-...

# Deploy
flyctl deploy --config fly.toml --dockerfile Dockerfile

# Verify health
curl https://jarvis-server.fly.dev/health
```

### 2. Deploy Web to Vercel

```bash
# Option A: Via Vercel Dashboard (recommended)
# 1. Go to https://vercel.com/new
# 2. Import your GitHub repository
# 3. Vercel auto-detects Next.js monorepo settings from vercel.json
# 4. Set environment variables in Settings > Environment Variables
# 5. Deploy

# Option B: Via CLI
vercel --prod
```

### 3. Configure Cross-Origin

In Vercel Dashboard, set `NEXT_PUBLIC_API_URL` to your Fly.io URL:
```
NEXT_PUBLIC_API_URL=https://jarvis-server.fly.dev
NEXT_PUBLIC_SOCKET_URL=https://jarvis-server.fly.dev
```

## Health Check Endpoints

| Component | URL | Expected Response |
|-----------|-----|-------------------|
| Server | `https://<fly-app>.fly.dev/health` | `{"ok":true,"timestamp":"...","uptime":...}` |
| Web | `https://<vercel-app>.vercel.app/` | HTTP 200 (Next.js app loads) |

## Deployment Workflows

### Server Updates (apps/server)

```bash
# From repo root
cd apps/server
flyctl deploy --config fly.toml --dockerfile Dockerfile
```

### Web Updates (apps/web)

Push to `main` branch → Vercel auto-deploys (if GitHub integration enabled).

Or manually:
```bash
vercel --prod
```

## Rollback Procedures

### Server (Fly.io)

```bash
# List releases
flyctl releases list -a jarvis-server

# Rollback to previous version
flyctl releases rollback -a jarvis-server

# Or rollback to specific version
flyctl releases rollback v42 -a jarvis-server
```

### Web (Vercel)

1. Go to Vercel Dashboard > Deployments
2. Find the previous successful deployment
3. Click "..." menu > "Promote to Production"

Or via CLI:
```bash
vercel rollback
```

## Monitoring

### Server Health

```bash
# Check app status
flyctl status -a jarvis-server

# View logs
flyctl logs -a jarvis-server

# SSH into machine (for debugging)
flyctl ssh console -a jarvis-server
```

### Web Health

- Vercel Dashboard > Analytics
- Vercel Dashboard > Logs

## Troubleshooting

### Server not starting

1. Check logs: `flyctl logs -a jarvis-server`
2. Verify secrets are set: `flyctl secrets list -a jarvis-server`
3. Check health endpoint: `curl https://jarvis-server.fly.dev/health`

### WebSocket connection failing

1. Verify `NEXT_PUBLIC_SOCKET_URL` points to Fly.io URL
2. Check CORS is configured (server allows Vercel domain)
3. Verify Fly.io machine is running: `flyctl status -a jarvis-server`

### Build failures

1. Check Vercel build logs in Dashboard
2. For server: Check `flyctl deploy` output
3. Ensure `packages/shared` builds successfully (dependency)

## Cost Considerations

- **Fly.io**: Free tier includes 3 shared-cpu-1x VMs with 256MB RAM. Current config uses 512MB, may incur costs.
- **Vercel**: Free tier includes 100GB bandwidth/month. Hobby tier is $20/month for more.

## Security Notes

1. Never commit `.env` files with real secrets
2. Use `flyctl secrets` for server secrets (encrypted at rest)
3. Use Vercel Environment Variables (not committed to repo)
4. Rotate API keys periodically
5. Enable branch protection on `main` to prevent unauthorized deployments
