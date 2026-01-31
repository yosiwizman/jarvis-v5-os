# DNS Setup for akior.local

This document describes how to configure DNS so that `akior.local` resolves to your AKIOR server across your network.

## Overview

AKIOR uses the hostname `akior.local` for HTTPS access with valid certificates. For this to work, your network needs to resolve `akior.local` to the correct IP address.

## Quick Verification

```powershell
# Check what akior.local resolves to
ping -n 1 akior.local

# Check if the correct server responds
curl https://akior.local/api/health/build -k
```

Expected: Ping returns the IP of your AKIOR server, and the API returns the expected build SHA.

## Option 1: Router DNS (Recommended)

Most home routers support custom DNS entries. This is the best option as it works for all devices on your network automatically.

### Steps:

1. Find your AKIOR server's LAN IP:
   ```powershell
   # On the AKIOR server
   ipconfig | Select-String "IPv4"
   ```

2. Log into your router admin panel (usually `192.168.1.1` or `192.168.0.1`)

3. Navigate to DNS/DHCP settings (varies by router):
   - **ASUS**: LAN → DHCP Server → Manual Assignment
   - **TP-Link**: DHCP → Address Reservation
   - **UniFi**: Settings → Networks → DHCP Name Server
   - **pfSense**: Services → DNS Resolver → Host Overrides

4. Add entry:
   - Hostname: `akior` (without `.local`)
   - Domain: `local`
   - IP Address: `<your AKIOR server IP>`

5. Save and reboot router if required

6. Flush DNS cache on clients:
   ```powershell
   ipconfig /flushdns
   ```

## Option 2: Hosts File (Per-Device)

Quick fix for a single machine. Not recommended for long-term use.

### Windows:

Run as Administrator:
```powershell
notepad C:\Windows\System32\drivers\etc\hosts
```

Add line:
```
192.168.1.100  akior.local
```

Replace `192.168.1.100` with your AKIOR server IP.

### Linux/Mac:

```bash
sudo nano /etc/hosts
```

Add line:
```
192.168.1.100  akior.local
```

## Option 3: Local DNS Server (Advanced)

For more control, run a local DNS server. Good options:

### AdGuard Home (Recommended)

AdGuard Home provides DNS with ad-blocking and custom rewrites.

1. Install via Docker:
   ```yaml
   # docker-compose.yml
   services:
     adguard:
       image: adguard/adguardhome
       ports:
         - "53:53/tcp"
         - "53:53/udp"
         - "3080:80/tcp"
       volumes:
         - ./adguard/work:/opt/adguardhome/work
         - ./adguard/conf:/opt/adguardhome/conf
       restart: unless-stopped
   ```

2. Access setup wizard at `http://localhost:3080`

3. Add DNS rewrite:
   - Go to Filters → DNS rewrites
   - Add: `akior.local` → `192.168.1.100`

4. Point your router's DHCP to use this DNS server

### dnsmasq (Lightweight)

Minimal DNS forwarder, good for headless servers.

```bash
# Install
sudo apt install dnsmasq

# Configure
echo "address=/akior.local/192.168.1.100" | sudo tee /etc/dnsmasq.d/akior.conf

# Restart
sudo systemctl restart dnsmasq
```

## Option 4: mDNS/Bonjour (Zero-Config)

If your AKIOR server runs Avahi (Linux) or Bonjour (Mac), it may already advertise `akior.local` automatically.

### Check if mDNS is working:

```bash
# Linux
avahi-resolve -n akior.local

# Mac
dns-sd -G v4 akior.local
```

### Enable Avahi on Linux:

```bash
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

Configure `/etc/avahi/avahi-daemon.conf`:
```ini
[server]
host-name=akior
domain-name=local
```

**Note**: mDNS requires all clients to support it (Windows requires Bonjour Print Services or iTunes installed).

## Troubleshooting

### DNS Not Resolving

```powershell
# Flush DNS cache
ipconfig /flushdns

# Check DNS server being used
nslookup akior.local

# Try direct IP access
curl https://192.168.1.100/api/health/build -k
```

### Wrong IP

If `akior.local` resolves to the wrong IP:

1. Check all hosts files on the network
2. Check router DNS entries
3. Check for multiple DNS servers

### Certificate Errors

Caddy generates self-signed certificates for `akior.local`. You need to:

1. Export Caddy's root CA:
   ```bash
   docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt
   ```

2. Import on Windows:
   - Double-click the `.crt` file
   - Install Certificate → Local Machine
   - Place in "Trusted Root Certification Authorities"

## Canonical Architecture

For production deployments:

```
┌─────────────────┐     ┌─────────────────┐
│  Client Device  │     │  AKIOR Server   │
│                 │     │                 │
│  Browser        │────▶│  Caddy (443)    │
│  akior.local    │     │    ↓            │
└─────────────────┘     │  Next.js (3001) │
         │              │  Fastify (1234) │
         │              └─────────────────┘
         │
    DNS Resolution:
    akior.local → 192.168.1.100
    (via Router DNS or hosts file)
```

## Related

- `docs/runbooks/deploy-drift.md` - Deployment drift troubleshooting
- `deploy/Caddyfile` - Caddy reverse proxy configuration
- `deploy/compose.jarvis.yml` - Docker Compose stack
