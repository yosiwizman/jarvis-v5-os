# LAN TLS Trust (Secure Context Runbook)

This runbook explains how to **trust the local CA** used for LAN TLS so browsers stop showing warnings and camera/mic features work reliably.

## Why this matters

Modern browsers require a **secure context** for camera/mic access:
- ✅ `https://akior.local` (trusted cert) → full features
- ⚠️ `http://<ip>` → insecure, camera/mic blocked
- ⚠️ `https://<ip>` → usually untrusted cert, warnings

**Standard: always use** `https://akior.local`.

## Source of truth (Caddy internal CA)

Our LAN TLS uses **Caddy’s internal CA**.  
The root certificate lives inside the running `akior-caddy` container:

```
/data/caddy/pki/authorities/local/root.crt
```

Use the export scripts below to retrieve it.

## Export the LAN root CA

From the repo root:

### Windows (PowerShell)
```powershell
.\scripts\tls\export-lan-ca.ps1
```

### Linux/macOS
```bash
./scripts/tls/export-lan-ca.sh
```

Both scripts output the cert to:
```
./out/certs/akior-lan-root-ca.crt
```

---

## Trust the CA (by OS)

### Windows 11
```powershell
# Run in elevated PowerShell
$cert = Resolve-Path .\out\certs\akior-lan-root-ca.crt
Import-Certificate -FilePath $cert -CertStoreLocation Cert:\LocalMachine\Root
```

### macOS
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./out/certs/akior-lan-root-ca.crt
```

### iOS (iPhone/iPad)
1. AirDrop / email / iCloud the file `akior-lan-root-ca.crt` to the device  
2. Open the file → **Install Profile**
3. Go to **Settings → General → About → Certificate Trust Settings**
4. Enable **full trust** for the installed root CA

### Android
1. Copy `akior-lan-root-ca.crt` to the device  
2. Settings → **Security** → **Encryption & credentials** → **Install from storage**
3. Choose **CA certificate**

---

## Optional: Trust from the server (Caddy)

If you are on the server and want to auto‑trust the CA for that machine:

```bash
# inside the caddy container
docker exec -it akior-caddy caddy trust
```

⚠️ Do **not** expose the Caddy admin API publicly.

---

## Verify

```bash
curl -k https://akior.local/api/health/build
```

Once trusted, browsers should show **Secure** and mic/camera will work.
