# JARVIS Local Host Deployment Guide

Deploy JARVIS on a local Ubuntu server with Docker Compose and Tailscale Serve for secure, tailnet-only HTTPS access.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Tailscale Serve (HTTPS)                                         │
│  https://<hostname>.<tailnet>.ts.net                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │ :3000
┌──────────────────────▼───────────────────────────────────────────┐
│  Caddy Reverse Proxy (jarvis-caddy)                              │
│  Routes: /socket.io, /api, /files, /static → server              │
│          Everything else → web                                    │
└──────────┬──────────────────────────────────┬────────────────────┘
           │                                  │
┌──────────▼──────────┐        ┌──────────────▼──────────────────┐
│  Next.js Web        │        │  Fastify + Socket.IO Server     │
│  (jarvis-web:3001)  │        │  (jarvis-server:1234)           │
└─────────────────────┘        └──────────────────────────────────┘
                                          │
                               ┌──────────▼──────────────────────┐
                               │  Docker Volume: jarvis-data     │
                               │  Persistent data storage        │
                               └─────────────────────────────────┘
```

## Prerequisites

- Ubuntu 22.04 (or similar Linux with systemd)
- Docker Engine + Docker Compose plugin
- Tailscale (configured and connected to your tailnet)
- Git
- SSH key-only access from your Windows workstation (see below)

## SSH Setup (Windows → Ubuntu)

Before running deployment commands, ensure key-only SSH works. This prevents automation scripts from hanging on password prompts.

### 1. Configure SSH on Windows

Edit `C:\Users\<USERNAME>\.ssh\config`:

```
Host aifactory-lan
  HostName <HOST_IP>
  User yosi
  IdentityFile C:\Users\<USERNAME>\.ssh\id_ed25519
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Replace `<HOST_IP>` with your Ubuntu host's LAN IP and `<USERNAME>` with your Windows username.

### 2. Install your public key on the host

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh yosi@aifactory-lan "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; sort -u -o ~/.ssh/authorized_keys ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

This prompts for the password once.

### 3. Verify key-only access

```powershell
ssh -o BatchMode=yes aifactory-lan "echo OK && hostname"
```

If this fails, see [docs/runbook/ssh-lan-troubleshooting.md](runbook/ssh-lan-troubleshooting.md).

### Automated setup

Alternatively, run the setup script:

```powershell
.\ops\windows\ssh-setup.ps1
```

### Install Docker (if not present)

```bash
# Install Docker using official script
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group (logout/login required)
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### Install Tailscale (if not present)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

## Quick Start

### 1. Clone the repository

```bash
sudo mkdir -p /opt/jarvis
sudo chown $USER:$USER /opt/jarvis
cd /opt/jarvis
git clone https://github.com/yosiwizman/jarvis-v5-os.git JARVIS-V5-OS
cd JARVIS-V5-OS
```

### 2. Configure environment variables

```bash
cd deploy
cp jarvis.env.example jarvis.env
nano jarvis.env  # Add your API keys
```

**Required:** `OPENAI_API_KEY` for AI features.

### 3. Start JARVIS

```bash
docker compose -f deploy/compose.jarvis.yml up -d --build
```

### 4. Enable Tailscale Serve (HTTPS)

```bash
# Serve port 3000 over Tailscale HTTPS (tailnet-only)
tailscale serve --bg 3000
```

If prompted with a consent URL, open it in your browser to enable HTTPS.

### 5. Access JARVIS

```bash
# Get your Tailscale URL
tailscale serve status
```

Open `https://<hostname>.<tailnet>.ts.net` in your browser.

## Install as System Service

To auto-start JARVIS on boot:

```bash
# Copy systemd unit
sudo cp deploy/systemd/jarvis.service /etc/systemd/system/

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable --now jarvis.service

# Check status
sudo systemctl status jarvis.service
```

## Management Commands

### View logs

```bash
# All services
docker compose -f deploy/compose.jarvis.yml logs -f

# Specific service
docker compose -f deploy/compose.jarvis.yml logs -f web
docker compose -f deploy/compose.jarvis.yml logs -f server
docker compose -f deploy/compose.jarvis.yml logs -f caddy
```

### Restart services

```bash
docker compose -f deploy/compose.jarvis.yml restart
```

### Update to latest version

```bash
cd /opt/jarvis/JARVIS-V5-OS
git pull
docker compose -f deploy/compose.jarvis.yml up -d --build
```

Or with systemd:

```bash
cd /opt/jarvis/JARVIS-V5-OS
git pull
sudo systemctl reload jarvis.service
```

### Stop JARVIS

```bash
docker compose -f deploy/compose.jarvis.yml down
```

Or with systemd:

```bash
sudo systemctl stop jarvis.service
```

## Data Storage

Persistent data is stored in a Docker volume:

```bash
# View volume info
docker volume inspect jarvis_jarvis-data

# Backup data
docker run --rm -v jarvis_jarvis-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/jarvis-data-backup.tar.gz -C /data .

# Restore data
docker run --rm -v jarvis_jarvis-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/jarvis-data-backup.tar.gz -C /data
```

## Troubleshooting

### Containers not starting

```bash
# Check container status
docker compose -f deploy/compose.jarvis.yml ps

# View logs for errors
docker compose -f deploy/compose.jarvis.yml logs --tail=50
```

### Port already in use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Stop conflicting service or change port in compose.jarvis.yml
```

### WebSocket connection failing

1. Verify Caddy is routing `/socket.io` correctly:
   ```bash
   curl -I http://localhost:3000/socket.io/
   ```

2. Check Tailscale Serve is active:
   ```bash
   tailscale serve status
   ```

3. Ensure you're accessing via Tailscale URL, not local IP.

### Health check failures

```bash
# Test server health endpoint
curl http://localhost:1234/health

# Test web frontend
curl -I http://localhost:3001/
```

### Tailscale Serve not working

1. Ensure Tailscale is connected:
   ```bash
   tailscale status
   ```

2. Check if HTTPS is enabled on your tailnet:
   - Visit https://login.tailscale.com/admin/dns
   - Enable HTTPS if not already

3. Re-run serve setup:
   ```bash
   tailscale serve reset
   tailscale serve --bg 3000
   ```

## Security Notes

- **Tailnet-only access**: JARVIS is NOT exposed to the public internet. Only devices on your Tailscale network can access it.
- **No secrets in repo**: Environment variables with API keys are stored in `jarvis.env` (gitignored).
- **Non-root containers**: Both web and server run as non-root users inside containers.
- **Local data**: All data stays on your host in Docker volumes. Nothing is sent externally except to configured APIs (OpenAI, etc.).

## Ports Reference

| Port | Service | Exposure |
|------|---------|----------|
| 3000 | Caddy (reverse proxy) | localhost only |
| 3001 | Next.js web (internal) | Docker network only |
| 1234 | Fastify server (internal) | Docker network only |

Tailscale Serve provides HTTPS access to port 3000 over your tailnet.
