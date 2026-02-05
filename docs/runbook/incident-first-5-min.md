# JARVIS Incident Response: First 5 Minutes

When something goes wrong, use this checklist to quickly assess and restore service.

## Step 0: Verify Connectivity (30 seconds)

```bash
# From your workstation
ssh -o BatchMode=yes aifactory-lan "echo 'SSH OK'"
```

If this fails, see [SSH LAN Troubleshooting](./ssh-lan-troubleshooting.md).

## Step 1: Check Container Status (30 seconds)

```bash
ssh aifactory-lan "docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml ps"
```

**Expected**: All three services show `Up (healthy)`

| Symptom | Jump to |
|---------|---------|
| Service shows `Exited` | [Container Crashed](#container-crashed) |
| Service shows `(unhealthy)` | [Service Unhealthy](#service-unhealthy) |
| Service shows `Restarting` | [Restart Loop](#restart-loop) |
| All services missing | [Stack Not Running](#stack-not-running) |

## Step 2: Quick Health Check (30 seconds)

```bash
ssh aifactory-lan "curl -s http://127.0.0.1:3000/api/health && echo"
```

**Expected**: `{"ok":true,"timestamp":"...","uptime":...}`

| Symptom | Jump to |
|---------|---------|
| Connection refused | [Caddy Down](#caddy-down) |
| 502 Bad Gateway | [Backend Unreachable](#502-bad-gateway) |
| Timeout | [Network Issue](#network-issue) |

---

## Symptom: Container Crashed

### Diagnosis

```bash
# Check which container crashed
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml ps

# Get exit code and last logs
docker inspect jarvis-server --format='{{.State.ExitCode}}'
docker logs --tail=50 jarvis-server
```

### Resolution

```bash
# Restart the crashed service
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d server

# Or restart all
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d
```

### Common Exit Codes

| Exit Code | Meaning | Likely Cause |
|-----------|---------|--------------|
| 0 | Clean exit | Manual stop or Docker restart |
| 1 | Application error | Check logs for exception |
| 137 | OOM killed | Increase memory limit |
| 143 | SIGTERM | Docker stop or host shutdown |

---

## Symptom: Service Unhealthy

### Diagnosis

```bash
# Check health status
docker inspect jarvis-server --format='{{.State.Health.Status}}'

# Check recent health check results
docker inspect jarvis-server --format='{{range .State.Health.Log}}{{.Output}}{{end}}'

# Check if endpoint responds
docker exec jarvis-server wget -q -O - http://127.0.0.1:1234/health
```

### Resolution

```bash
# Restart the unhealthy service
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml restart server

# If still unhealthy, check logs
docker logs --tail=100 jarvis-server
```

---

## Symptom: Restart Loop

### Diagnosis

```bash
# Check restart count
docker inspect jarvis-server --format='{{.RestartCount}}'

# Check startup logs
docker logs --tail=100 jarvis-server
```

### Common Causes

1. **Missing environment variables**: Check `jarvis.env` exists
2. **Port conflict**: Another process using the port
3. **Permission denied**: File system access issues
4. **Module not found**: Build/dependency issue

### Resolution

```bash
# Check env file exists
ls -la /opt/jarvis/JARVIS-V5-OS/deploy/jarvis.env

# Rebuild from scratch
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml down
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml build --no-cache
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d
```

---

## Symptom: Stack Not Running

### Diagnosis

```bash
# Check if Docker is running
systemctl status docker

# Check if containers exist
docker ps -a | grep jarvis
```

### Resolution

```bash
# Start Docker if needed
sudo systemctl start docker

# Start the stack
cd /opt/jarvis/JARVIS-V5-OS
docker compose -f deploy/compose.jarvis.yml up -d
```

---

## Symptom: Caddy Down

### Diagnosis

```bash
# Check Caddy status
docker logs --tail=50 jarvis-caddy

# Check if port 3000 is bound
ss -tlnp | grep 3000
```

### Resolution

```bash
# Restart Caddy
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml restart caddy

# If port conflict, find and kill process
sudo lsof -i :3000
```

---

## Symptom: 502 Bad Gateway

Caddy is running but can't reach backend services.

### Diagnosis

```bash
# Check if server is running
docker exec jarvis-server wget -q -O - http://127.0.0.1:1234/health

# Check if web is running
docker exec jarvis-web wget -q -O - http://127.0.0.1:3001/

# Check Docker network
docker network inspect deploy_jarvis-net
```

### Resolution

```bash
# Restart affected backend
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml restart server web

# If network issue, recreate network
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml down
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d
```

---

## Symptom: Network Issue

### Diagnosis

```bash
# Check host network
ip addr

# Check Docker networks
docker network ls

# Check container IPs
docker inspect jarvis-server --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

### Resolution

```bash
# Recreate Docker network
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml down
docker network prune -f
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d
```

---

## Symptom: Web Build Failure

Next.js container fails to start due to build errors.

### Diagnosis

```bash
docker logs jarvis-web
```

### Common Errors

| Error | Solution |
|-------|----------|
| `Module not found` | Check shared package built correctly |
| `EACCES: permission denied` | Dockerfile needs `--chown` on COPY |
| `Cannot find module './integrations.js'` | ESM import missing `.js` extension |

### Resolution

```bash
# Rebuild from scratch
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml build --no-cache web
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml up -d web
```

---

## Symptom: TLS/UI Down (LAN)

UI is unreachable on LAN via https://akior.local/ or https://akior.home.arpa/

### Diagnosis

```bash
# Check if Caddy is running
docker ps | grep jarvis-caddy

# Check Caddy logs for TLS errors
docker logs --tail=50 jarvis-caddy | grep -i tls

# Check if port 443 is listening
ss -tlnp | grep 443

# Test HTTPS endpoint
curl -vkI https://akior.local/ 2>&1 | grep -E "(Connected|SSL|certificate)"
```

### Common Causes

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Caddy not running** | Port 443 not listening | Restart: `docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml restart caddy` |
| **Internal CA expired** | "certificate has expired" error | Recreate Caddy data volume (see below) |
| **Config syntax error** | Caddy restart loop | Check: `docker logs jarvis-caddy` for parse errors |
| **Port conflict** | "bind: address already in use" | Find process: `sudo lsof -i :443` |
| **mDNS not working** | "could not resolve akior.local" | Restart Avahi: `sudo systemctl restart avahi-daemon` |

### Resolution: Recreate Internal CA

If Caddy's internal CA is corrupted or expired:

```bash
cd /opt/jarvis/JARVIS-V5-OS

# Stop Caddy
docker compose -f deploy/compose.jarvis.yml stop caddy

# Remove Caddy data volume (includes internal CA)
docker volume rm deploy_caddy_data

# Restart Caddy (will regenerate internal CA)
docker compose -f deploy/compose.jarvis.yml up -d caddy

# Verify TLS
curl -vkI https://akior.local/
```

**Note:** After recreating the CA, Windows clients will need to re-trust the certificate:
```powershell
.\ops\trust-lan-https.ps1 -Apply
```

### Emergency Rollback to LAN-Only

If TLS issues persist after troubleshooting:

```bash
cd /opt/jarvis/JARVIS-V5-OS
sudo bash ops/rollback/switch-to-local-only-mode.sh
```

This will:
- Stop any remote-access containers
- Ensure Caddy uses internal TLS
- Restart the stack cleanly
- Run verification

See [Remote Access Docs](../ops/remote-access.md#rollback-to-lan-only-mode) for details.

---

## Escalation

If service is not restored within 15 minutes:

1. Document what you've tried
2. Capture full logs: `docker logs jarvis-server > server.log 2>&1`
3. Check recent commits: `git log --oneline -10`
4. Consider rollback (see [Deploy Ops](./deploy-ops.md#rollback-procedure) or [LAN Rollback](../ops/remote-access.md#rollback-to-lan-only-mode))

---

## Post-Incident

After restoring service:

1. Run smoke test: `./ops/verify/deploy-smoke.sh`
2. Monitor logs for 5 minutes
3. Document root cause
4. Update runbook if new failure mode discovered

## ERR_CONNECTION_REFUSED (akior.local)

**Symptom:** LAN clients cannot reach https://akior.local/menu (browser shows ERR_CONNECTION_REFUSED)

**Root cause possibilities:**
1. Avahi not advertising akior.local via mDNS
2. Ports 80/443 not listening on LAN interfaces
3. Caddy container not running
4. Firewall blocking LAN access

**Immediate checks (run on host):**
- Run automated verification: bash ops/verify/lan-reachability-check.sh
- Check Caddy status: docker compose -f deploy/compose.jarvis.yml ps caddy
- Check port listeners: sudo ss -lntp | egrep ':(80|443)'
- Check Avahi: systemctl status avahi-daemon | grep "running"
- Check Caddy logs: docker compose -f deploy/compose.jarvis.yml logs --tail=50 caddy

**Quick fixes:**
- If Caddy is down: docker compose -f deploy/compose.jarvis.yml up -d --force-recreate caddy
- If Avahi issue: bash ops/linux/lan-mdns/install.sh
- Verify: bash ops/verify/lan-reachability-check.sh

**Rollback (last resort):**
bash ops/rollback/switch-to-local-only-mode.sh

See docs/ops/remote-access.md for recovery procedures.
