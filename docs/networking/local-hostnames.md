# Local hostnames for AKIOR

## Why move off `.local`?
- `.local` is reserved for mDNS (RFC 6762) and may resolve to different devices on your LAN.
- Browsers and OSes may prefer mDNS over DNS, causing “stale host” issues.

## Recommended canonical hostname
- Use `akior.home.arpa` (RFC 8375 reserved for home networks).
- Keep `akior.local` / `jarvis.local` as legacy aliases only.

## How to point to the correct host
### Preferred: Router / DNS server
1) Create an A record: `akior.home.arpa` → `<server LAN IP>`
2) (Optional) Aliases: `akior.local`, `jarvis.local` → `<server LAN IP>`

### Fallback: Hosts file (per device)
- Add this line (replace `<server LAN IP>`):
```
<server LAN IP> akior.home.arpa
```
- Windows: `C:\Windows\System32\drivers\etc\hosts`
- macOS/Linux: `/etc/hosts`

## Certificates / HTTPS
- Caddy issues an internal CA certificate for `akior.home.arpa`, `akior.local`, `jarvis.local`.
- Export CA: `docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt`
- Import CA on your device to trust HTTPS for camera/mic access.

## Self-check (non-technical)
- Open `/diagnostics` in the AKIOR UI. It shows:
  - Current hostname
  - Server build SHA (from `/api/health/build`)
  - Client build SHA
  - Warning if you’re on `.local` or if build SHAs differ.

## Operator quick helper (CLI)
- Run `./ops/dns-doctor.ps1` to print your LAN IP and a ready-to-paste hosts entry.

