# Trusted LAN HTTPS for AKIOR

This guide explains how to configure trusted HTTPS on your local network for AKIOR,
enabling mic/camera access and eliminating browser certificate warnings.

## Why is this needed?

Browsers require a "secure context" to access sensitive APIs like:
- `navigator.mediaDevices.getUserMedia()` (microphone, camera)
- Web Speech API
- Geolocation (for some browsers)

A secure context requires either:
- `https://` with a trusted certificate
- `localhost` (special case)

When accessing AKIOR over LAN (e.g., `https://akior.home.arpa`), the browser sees a
self-signed certificate from Caddy's internal CA, which is not trusted by default.

## Solution: Trust Caddy's CA Certificate

The AKIOR stack uses Caddy as a reverse proxy, which automatically generates TLS
certificates using its own internal Certificate Authority (CA). By installing this
CA certificate in your operating system's trust store, browsers will trust all
certificates signed by Caddy.

## Windows Setup

### Automatic (Recommended)

Run the trust tooling script from the repository root:

```powershell
.\ops\trust-lan-https.ps1 -Apply
```

This will:
1. Extract the Caddy root CA certificate from the running container
2. Install it to the Windows LocalMachine Root certificate store
3. Verify the installation

After running, **restart your browser completely** (close all windows).

### Manual

1. Start the AKIOR stack if not running:
   ```powershell
   docker compose -f deploy/compose.jarvis.yml up -d
   ```

2. Extract the certificate:
   ```powershell
   docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt $env:TEMP\caddy-root.crt
   ```

3. Open the certificate and install it:
   - Double-click the `.crt` file
   - Click "Install Certificate"
   - Choose "Local Machine"
   - Choose "Place all certificates in the following store"
   - Browse and select "Trusted Root Certification Authorities"
   - Complete the wizard

4. Restart your browser.

### Verification

Check the installation status:

```powershell
.\ops\trust-lan-https.ps1 -Verify
```

Or visit `https://akior.home.arpa/diagnostics` and look for:
- "Trusted HTTPS" section showing a green checkmark
- "Secure context: Yes"

### Removal

To remove the certificate (e.g., when uninstalling AKIOR):

```powershell
.\ops\trust-lan-https.ps1 -Remove
```

## macOS Setup

### Automatic

```bash
# Extract certificate
docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt /tmp/caddy-root.crt

# Add to keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/caddy-root.crt
```

### Manual

1. Extract the certificate as shown above
2. Double-click the `.crt` file to open Keychain Access
3. Find "Caddy Local Authority" in the login keychain
4. Double-click it, expand "Trust", set "When using this certificate" to "Always Trust"
5. Restart your browser

## Linux Setup

The process varies by distribution. For Debian/Ubuntu:

```bash
# Extract certificate
docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt /tmp/caddy-root.crt

# Copy to trust store
sudo cp /tmp/caddy-root.crt /usr/local/share/ca-certificates/caddy-root.crt

# Update certificates
sudo update-ca-certificates

# Firefox requires additional configuration in about:config
# security.enterprise_roots.enabled = true
```

## Troubleshooting

### Certificate still not trusted after installation

1. **Restart your browser completely** - All windows must be closed
2. Clear browser cache
3. Try an incognito/private window
4. Check that the certificate is installed correctly:
   - Windows: Open `certmgr.msc` → Trusted Root Certification Authorities → Certificates
   - Look for "Caddy Local Authority"

### "jarvis-caddy container is not running"

Start the stack first:
```powershell
docker compose -f deploy/compose.jarvis.yml up -d
```

### Certificate not found in container

The certificate is generated when Caddy first serves an HTTPS request. Visit
`https://akior.local` once (accept the warning), then retry the script.

### Browser-specific issues

**Firefox**: Firefox uses its own certificate store by default. Either:
- Import the certificate in Firefox Settings → Privacy & Security → Certificates
- Enable enterprise roots: `about:config` → `security.enterprise_roots.enabled` = true

**Chrome**: Uses the system certificate store. Should work after OS-level installation.

**Edge**: Uses the system certificate store. Should work after OS-level installation.

## Security Considerations

- The Caddy CA certificate is unique to your AKIOR installation
- Installing it only trusts certificates for your local network
- The certificate file should not be shared or distributed
- If you rebuild the Caddy container, a new CA is generated and you must reinstall

## Related

- [DNS Doctor](../../ops/dns-doctor.ps1) - For hostname resolution issues
- [Diagnostics Page](/diagnostics) - Shows HTTPS trust status in the UI
