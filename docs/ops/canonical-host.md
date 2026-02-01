# Canonical Host Configuration

This document defines the **canonical server** for AKIOR and how to change it safely.

## What is the Canonical Host?

The **canonical host** is the single authoritative server that should respond to `akior.local` on your LAN. All devices on the network should resolve `akior.local` to this one IP address.

> **Rule**: There must be exactly ONE canonical host serving AKIOR at any time. Multiple hosts with different builds cause "deployment drift" issues.

## Current Configuration

```yaml
# Canonical AKIOR Server - PRODUCTION
hostname: akior.local
lan_ip: 192.168.1.64
machine_name: aifactory
connection: Wired Ethernet (NOT Wi-Fi)
last_updated: 2026-02-01
updated_by: yosiwizman
```

### Network Notes

- **Canonical server**: `192.168.1.64` (wired, hostname "aifactory")
- **Non-canonical**: `192.168.1.77` (Wi-Fi client "Ai-Factory-1") - do NOT use
- **Gateway**: `192.168.1.254` (AT&T BGW320) - will NOT appear in DHCP client list
- **DNS/DHCP provider**: AdGuard Home on `192.168.1.64:3000`

## How DNS Resolution Works

```
┌─────────────────┐
│  Any Device     │
│  on the LAN     │
└────────┬────────┘
         │ DNS query: akior.local
         ▼
┌─────────────────┐
│  AdGuard Home   │────────────────────────────┐
│  192.168.1.64   │                            │
│  (DNS + DHCP)   │                            │
└────────┬────────┘                            │
         │ Returns: 192.168.1.64               │
         ▼                                     │
┌─────────────────┐                            │
│  Canonical Host │◀───────────────────────────┘
│  192.168.1.64   │
│  "aifactory"    │
│                 │
│  Docker Stack:  │
│  - Caddy (443)  │
│  - Next.js      │
│  - Fastify      │
│  - AdGuard Home │
└─────────────────┘
         │
         │ Internet via
         ▼
┌─────────────────┐
│  AT&T BGW320    │
│  192.168.1.254  │
│  (WAN routing)  │
│  DHCP: disabled │
└─────────────────┘
```

## Changing the Canonical Host

### When to Change

- Moving AKIOR to a different machine
- Server hardware failure
- Network reconfiguration

### Pre-Change Checklist

- [ ] New host has Docker and Docker Compose installed
- [ ] New host has git access to the repo
- [ ] New host's LAN IP is known and static (or DHCP-reserved)
- [ ] You have access to modify DNS (router or AdGuard)

### Change Procedure

1. **Deploy to New Host**:
   ```bash
   # On the new host
   git clone https://github.com/yosiwizman/jarvis-v5-os.git
   cd jarvis-v5-os
   ./deploy/local/redeploy.ps1   # Windows
   # or
   ./deploy/local/redeploy.sh    # Linux/Mac
   ```

2. **Verify New Host Works**:
   ```bash
   # Direct access by IP (bypass DNS)
   curl -k https://<NEW_IP>/api/health/build
   ```

3. **Update DNS**:
   
   **Option A: Router DNS** (Recommended)
   - Log into router admin panel
   - Change `akior.local` entry to new IP
   - Save and reboot router if needed
   
   **Option B: AdGuard Home**
   - Go to Filters → DNS rewrites
   - Update `akior.local` → `<NEW_IP>`
   
   **Option C: Central hosts file** (Not recommended)
   - Update hosts file on each client machine

4. **Flush DNS on Clients**:
   ```powershell
   # Windows
   ipconfig /flushdns
   
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

5. **Verify DNS Change**:
   ```bash
   # Should show new IP
   ping akior.local
   
   # Full verification
   ./scripts/net/verify-dns.ps1 -ExpectedIP <NEW_IP>
   ```

6. **Update This Document**:
   - Edit the "Current Configuration" section above
   - Commit and push the change

7. **Decommission Old Host** (if applicable):
   ```bash
   # On the old host
   docker compose -f deploy/compose.jarvis.yml down
   ```

### Rollback Procedure

If the new host fails:

1. Revert DNS to old host's IP
2. Flush DNS caches
3. Verify old host responds: `./scripts/net/verify-dns.ps1`
4. Update this document

## Static IP vs DHCP

### Recommended: DHCP Reservation

Most routers support "DHCP reservation" which assigns a consistent IP to a specific MAC address. This is preferred because:
- IP is effectively static
- No manual IP configuration on the server
- Still managed by DHCP

### Alternative: Static IP

If DHCP reservation isn't available:

**Linux** (`/etc/netplan/01-netcfg.yaml`):
```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [192.168.1.1, 8.8.8.8]
```

**Windows**:
- Network Settings → Ethernet/Wi-Fi → IP settings → Manual
- Enter IP, Subnet (255.255.255.0), Gateway, DNS

## Verification Commands

```bash
# Quick check
ping akior.local

# Full verification (Windows)
.\scripts\net\verify-dns.ps1 -ExpectedIP <CANONICAL_IP>

# Full verification (Linux/Mac)
./scripts/net/verify-dns.sh -i <CANONICAL_IP>

# Check build SHA
curl -k https://akior.local/api/health/build | jq .git_sha
```

## AT&T BGW320 Notes

**Why 192.168.1.254 doesn't appear in device lists:**

The BGW320's management IP (`192.168.1.254`) is the gateway itself, not a DHCP client. When viewing "Connected Devices" in the BGW320 admin panel or AdGuard's DHCP client list, you'll only see:
- Devices that received DHCP leases
- Devices that sent ARP requests

The gateway is the router—it doesn't request a DHCP lease from itself.

## Related Documentation

- `docs/ops/dns-setup.md` - How to configure DNS
- `docs/ops/production-verification.md` - Post-deploy verification checklist
- `docs/ops/lan-tls-trust.md` - Trust the local CA for HTTPS
- `docs/ops/adguard-bgw320.md` - AdGuard Home setup for BGW320
- `docs/runbooks/deploy-drift.md` - Troubleshooting deployment issues
- `deploy/adguard-home/docker-compose.yml` - AdGuard Home deployment
- `scripts/net/check-adguard-ready.sh` - AdGuard readiness check
- `deploy/local/redeploy.ps1` - Automated redeploy script
