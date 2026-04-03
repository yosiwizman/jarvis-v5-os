# AKIOR Auto-Deploy Setup Guide

This guide explains how to set up automatic deployment for AKIOR on a Linux server using systemd path watchers.

## Overview

The auto-deploy system uses two systemd units:
- **akior-auto-deploy.path**: Watches for changes to the git repository
- **akior-auto-deploy.service**: Executes the deployment when changes are detected

When you run `git pull` on the server, the path unit detects the change to `.git/refs/heads/main` and triggers the service unit, which runs `ops/deploy.sh`.

## Prerequisites

- Linux server with systemd
- Docker and Docker Compose installed
- Git installed
- Repository cloned to `/opt/akior/AKIOR-V5-OS`

## Installation

### Quick Setup

Run the setup script (with sudo access):

```bash
./ops/setup-auto-deploy.sh
```

### Manual Setup

1. **Copy systemd unit files:**

```bash
sudo cp ops/akior-auto-deploy.service /etc/systemd/system/
sudo cp ops/akior-auto-deploy.path /etc/systemd/system/
```

2. **Reload systemd:**

```bash
sudo systemctl daemon-reload
```

3. **Enable and start the path watcher:**

```bash
sudo systemctl enable akior-auto-deploy.path
sudo systemctl start akior-auto-deploy.path
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Linux Server                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   git pull origin main                                          │
│         │                                                       │
│         ▼                                                       │
│   .git/refs/heads/main is modified                              │
│         │                                                       │
│         ▼                                                       │
│   akior-auto-deploy.path (systemd path unit)                   │
│   [Watches for PathModified events]                             │
│         │                                                       │
│         ▼                                                       │
│   akior-auto-deploy.service (systemd service unit)             │
│   [Runs ops/deploy.sh]                                          │
│         │                                                       │
│         ▼                                                       │
│   Docker containers rebuilt and restarted                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Commands Reference

### Check Status

```bash
# Check if path watcher is active
sudo systemctl status akior-auto-deploy.path

# Check most recent deployment status
sudo systemctl status akior-auto-deploy.service
```

### View Logs

```bash
# Follow deployment logs in real-time
sudo journalctl -u akior-auto-deploy -f

# View last 50 lines of logs
sudo journalctl -u akior-auto-deploy -n 50

# View logs from today
sudo journalctl -u akior-auto-deploy --since today
```

### Enable/Disable Auto-Deploy

```bash
# Disable auto-deploy (keeps manual deployment available)
sudo systemctl stop akior-auto-deploy.path
sudo systemctl disable akior-auto-deploy.path

# Re-enable auto-deploy
sudo systemctl enable akior-auto-deploy.path
sudo systemctl start akior-auto-deploy.path
```

### Manual Deployment

Even with auto-deploy enabled, you can trigger a manual deployment:

```bash
# Using the deploy script directly
./ops/deploy.sh

# Or via systemctl (logs go to journal)
sudo systemctl start akior-auto-deploy.service
```

If the execute bit is missing (common after fresh git clone):

```bash
bash ops/deploy.sh
```

## Troubleshooting

### Deploy script fails with "Permission denied"

This happens when the execute bit is not set in git. Fix:

```bash
# Option 1: Run with bash explicitly
bash ops/deploy.sh

# Option 2: Set execute bit locally
chmod +x ops/deploy.sh
./ops/deploy.sh
```

The repository now has the execute bit set in git, so future clones should work directly.

### Path watcher not triggering

1. Check the watcher is running:
```bash
sudo systemctl status akior-auto-deploy.path
```

2. Verify the watched path exists:
```bash
ls -la /opt/akior/AKIOR-V5-OS/.git/refs/heads/main
```

3. Check for errors in the journal:
```bash
sudo journalctl -u akior-auto-deploy.path -n 20
```

### Deployment fails

1. Check deploy script output:
```bash
sudo journalctl -u akior-auto-deploy.service -n 100
```

2. Verify required tools are installed:
```bash
./ops/deploy.sh
# The script will report missing tools (git, docker, docker compose)
```

3. Check Docker is running:
```bash
sudo systemctl status docker
```

### Custom Repository Location

If your repository is not at `/opt/akior/AKIOR-V5-OS`, edit the unit files:

1. Edit `/etc/systemd/system/akior-auto-deploy.path`:
   - Update `PathModified` to your repo's `.git/refs/heads/main`

2. Edit `/etc/systemd/system/akior-auto-deploy.service`:
   - Update `WorkingDirectory` to your repo root
   - Update `ExecStart` to the full path of `deploy.sh`

3. Reload systemd:
```bash
sudo systemctl daemon-reload
sudo systemctl restart akior-auto-deploy.path
```

## Security Notes

- The service runs as user `yosi` (configurable in the service file)
- Ensure the user has permissions to run Docker commands
- The deploy script pulls from `origin/main` - ensure your remote is trusted
