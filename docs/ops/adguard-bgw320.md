# AdGuard Home Setup for AT&T BGW320

This runbook covers deploying AdGuard Home as the LAN DNS/DHCP server on networks using the AT&T BGW320-500 gateway.

## Why AdGuard Home for BGW320?

The AT&T BGW320 gateway has limited DNS customization:
- **Cannot set custom DNS entries** via its DHCP server
- **Cannot add host overrides** like `akior.local -> 192.168.1.76`
- **DHCP is limited** to basic IP assignment

**Solution**: Run AdGuard Home on the canonical server to provide both DNS (with custom rewrites) and DHCP for the entire LAN.

## Network Topology

```
                    ┌─────────────────────────┐
                    │   AT&T BGW320 Gateway   │
                    │   192.168.1.254         │
                    │   (WAN + Routing only)  │
                    │   DHCP: DISABLED        │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────────┐    ┌─────────────┐
│  Wi-Fi Client │     │  Canonical Server   │    │ Other LAN   │
│  192.168.1.77 │     │  192.168.1.76       │    │ Devices     │
│  Ai-Factory-1 │     │  "aifactory" (wired)│    │             │
└───────────────┘     │                     │    └─────────────┘
                      │  ┌───────────────┐  │
                      │  │ AdGuard Home  │  │
                      │  │ DNS + DHCP    │  │
                      │  │ Port 53, 67   │  │
                      │  └───────────────┘  │
                      │                     │
                      │  ┌───────────────┐  │
                      │  │ AKIOR Stack   │  │
                      │  │ Caddy, Next.js│  │
                      │  │ Port 443      │  │
                      │  └───────────────┘  │
                      └─────────────────────┘
```

## Important: Gateway IP Not in Client List

**The BGW320's management IP (192.168.1.254) will NOT appear in the DHCP client list.**

This is normal. The gateway is the router itself, not a DHCP client. When viewing "Connected Devices" in the BGW320 admin panel, you'll only see:
- LAN devices that received DHCP leases
- Devices with static IPs (if they register via ARP)

**Do not be confused** if you don't see 192.168.1.254 listed. It's the gateway, not a client.

## Prerequisites

- [ ] SSH or direct access to the canonical server (192.168.1.76)
- [ ] Docker and Docker Compose installed on the server
- [ ] Access to BGW320 admin panel (http://192.168.1.254)
- [ ] Know the BGW320 admin password (on device label or set by user)

## Deployment Procedure

### ⚠️ Critical: Follow This Order

The order matters to avoid network downtime:

```
1. Start AdGuard Home
2. Configure DNS rewrite (akior.local)
3. Enable AdGuard DHCP server
4. Test DHCP works (renew a client)
5. THEN disable BGW320 DHCP  ← Last step!
```

**Never disable BGW320 DHCP before verifying AdGuard DHCP works.**

---

### Step 1: Deploy AdGuard Home Container

On the canonical server (192.168.1.76):

```bash
cd /path/to/jarvis-v5-os
cd deploy/adguard-home

# Start AdGuard Home
docker compose up -d

# Verify container is running
docker ps | grep adguard
```

Check the container is healthy:
```bash
docker inspect adguard-home --format='{{.State.Health.Status}}'
# Should output: healthy
```

---

### Step 2: Initial AdGuard Setup

1. Open browser to: **http://192.168.1.76:3000**

2. Complete the setup wizard:
   - **Admin Interface**: Listen on all interfaces, port 3000
   - **DNS Server**: Listen on all interfaces, port 53
   - **Set admin username and password** (save these!)

3. After wizard completes, log in to the dashboard.

---

### Step 3: Configure DNS Rewrite

1. Go to **Filters → DNS rewrites**

2. Click **Add DNS rewrite**

3. Add the AKIOR entry:
   - **Domain**: `akior.local`
   - **Answer**: `192.168.1.76`

4. Click **Save**

5. Verify DNS works from another machine:
   ```bash
   # Should return 192.168.1.76
   nslookup akior.local 192.168.1.76
   ```

---

### Step 4: Configure AdGuard DHCP Server

1. Go to **Settings → DHCP settings**

2. Select the correct network interface:
   - Choose the **wired Ethernet interface** (e.g., `eth0`, `enp3s0`)
   - Do NOT select `lo` (loopback) or Docker bridges

3. Configure DHCP settings:
   - **Gateway IP**: `192.168.1.254` (the BGW320)
   - **Subnet mask**: `255.255.255.0`
   - **Range start**: `192.168.1.100`
   - **Range end**: `192.168.1.200`
   - **Lease duration**: `24h` (or your preference)

4. Click **Enable DHCP server**

5. Click **Save**

---

### Step 5: Verify AdGuard DHCP Works

**Before disabling BGW320 DHCP**, verify AdGuard can issue leases:

Run the readiness check script:
```bash
# From the repo root
./scripts/net/check-adguard-ready.sh
```

Or manually test from a client device:

```bash
# On a test client (not the server!)
# Release current DHCP lease
sudo dhclient -r

# Request new lease (should come from AdGuard)
sudo dhclient -v

# Verify the DHCP server is 192.168.1.76
cat /var/lib/dhcp/dhclient.leases | grep "dhcp-server"
```

On Windows:
```powershell
ipconfig /release
ipconfig /renew

# Check DHCP server
ipconfig /all | Select-String "DHCP Server"
# Should show 192.168.1.76
```

---

### Step 6: Disable BGW320 DHCP

**Only after Step 5 succeeds:**

1. Open BGW320 admin: **http://192.168.1.254**

2. Log in with admin credentials

3. Navigate to: **Home Network → Subnets & DHCP**

4. Under "Private LAN Subnet":
   - Find **DHCPv4 Server: Enable**
   - Change to **DHCPv4 Server: Disable**

5. Click **Save**

6. **Do NOT reboot the gateway** unless necessary

---

### Step 7: Final Verification

Run full verification from any LAN client:

```bash
# DNS verification
./scripts/net/verify-dns.sh

# Should show:
# - akior.local resolves to 192.168.1.76
# - /api/health/build returns valid SHA
# - Settings page accessible
```

On Windows:
```powershell
.\scripts\net\verify-dns.ps1

# AdGuard-specific checks
.\scripts\net\check-adguard-ready.ps1
```

## Rollback Procedure

If AdGuard fails or network breaks:

### Quick Rollback (< 2 minutes)

1. **Re-enable BGW320 DHCP immediately**:
   - http://192.168.1.254 → Home Network → Subnets & DHCP
   - Enable DHCPv4 Server
   - Save

2. **Force clients to get new leases**:
   ```bash
   # Each client
   sudo dhclient -r && sudo dhclient
   ```
   Or reboot the client devices.

3. **Stop AdGuard** (optional, but recommended to avoid conflicts):
   ```bash
   cd deploy/adguard-home
   docker compose down
   ```

### Fallback DNS

If AdGuard DNS fails but DHCP is working:
- Clients can manually set DNS to `8.8.8.8` or `1.1.1.1`
- `akior.local` won't work until AdGuard DNS is restored

## Troubleshooting

### Port 53 Already in Use (Linux)

```bash
# Check what's using port 53
sudo lsof -i :53

# If systemd-resolved:
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved

# Update /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

### AdGuard DHCP Not Issuing Leases

1. Check interface selection in AdGuard DHCP settings
2. Ensure BGW320 DHCP is actually disabled
3. Check firewall allows UDP 67:
   ```bash
   sudo ufw allow 67/udp
   ```

### Clients Getting Old DHCP Leases

Leases have TTL. Either:
- Wait for lease expiry, or
- Force renew on each client

### Cannot Access akior.local After Change

1. Flush DNS cache:
   ```powershell
   ipconfig /flushdns
   ```

2. Verify DNS server is AdGuard:
   ```bash
   nslookup akior.local
   # Server should be 192.168.1.76
   ```

3. Check AdGuard DNS rewrite exists

## Maintenance

### Backup AdGuard Config

```bash
# Config is in volumes/conf
cd deploy/adguard-home
tar -czvf adguard-backup-$(date +%Y%m%d).tar.gz volumes/
```

### Update AdGuard Home

```bash
cd deploy/adguard-home
docker compose pull
docker compose up -d
```

### View Query Logs

- Web UI: **Query Log** tab
- Or: `volumes/work/data/querylog.json`

## Related Documentation

- `docs/ops/canonical-host.md` - Canonical server definition
- `docs/ops/dns-setup.md` - General DNS setup options
- `scripts/net/verify-dns.ps1` - DNS verification (Windows)
- `scripts/net/verify-dns.sh` - DNS verification (Linux/Mac)
- `scripts/net/check-adguard-ready.sh` - AdGuard readiness check
