# AKIOR LAN HTTPS Setup for Windows

This guide helps Windows users enable trusted HTTPS access to AKIOR on the LAN, which is required for camera and microphone features to work in browsers.

## Prerequisites

1. AKIOR server is running with HTTPS enabled (Phase E completed)
2. You have the `rootCA.pem` file from the server's `deploy/certs/` directory
3. Windows hosts file is configured with `jarvis.local` pointing to the server IP

## Quick Setup (Automated)

### Step 1: Copy the Root CA Certificate

Copy `rootCA.pem` from the AKIOR server to your Windows machine:

```
# On the server, the file is at:
/path/to/jarvis-v5-os/deploy/certs/rootCA.pem

# Copy it to your Windows machine (e.g., Downloads folder)
```

### Step 2: Run the Import Script as Administrator

1. **Open PowerShell as Administrator:**
   - Press `Win + X`
   - Click "Windows Terminal (Admin)" or "PowerShell (Admin)"
   - Click "Yes" on the UAC prompt

2. **Navigate to the repository (if cloned locally):**
   ```powershell
   cd C:\path\to\jarvis-v5-os
   ```

3. **Run the import script:**
   ```powershell
   # If rootCA.pem is in deploy/certs/:
   .\ops\windows\import-lan-rootca.ps1

   # Or specify the path directly:
   .\ops\windows\import-lan-rootca.ps1 -CertPath "C:\Users\YOU\Downloads\rootCA.pem"
   ```

4. **Restart your browser** and navigate to:
   - `https://jarvis.local/`
   - `https://jarvis.local/camera`

## Manual Setup

If you prefer to import the certificate manually:

### Step 1: Open Certificate Manager

1. Press `Win + R`
2. Type `certmgr.msc` and press Enter
3. This opens the **User** certificate store

For **Machine-wide** trust (recommended):
1. Press `Win + R`
2. Type `mmc` and press Enter
3. File → Add/Remove Snap-in → Certificates → Add
4. Select "Computer account" → Next → Local computer → Finish → OK

### Step 2: Import the Certificate

1. Navigate to: **Trusted Root Certification Authorities** → **Certificates**
2. Right-click → **All Tasks** → **Import...**
3. Click **Next**
4. Browse to `rootCA.pem` and select it
5. Select "Place all certificates in the following store"
6. Ensure "Trusted Root Certification Authorities" is selected
7. Click **Next** → **Finish**
8. Click **Yes** when prompted about trusting the CA

### Step 3: Verify and Test

1. Flush DNS cache (open Admin Command Prompt):
   ```cmd
   ipconfig /flushdns
   ```

2. **Close all browser windows completely**

3. Open browser and navigate to `https://jarvis.local/`

4. The padlock icon should appear (no warnings)

## Troubleshooting

### Browser Still Shows "Not Secure"

1. **Clear browser cache:**
   - Chrome: `Ctrl+Shift+Delete` → Clear cached images and files
   - Edge: `Ctrl+Shift+Delete` → Clear cached data

2. **Restart browser completely:**
   - Close ALL browser windows (check system tray)
   - Reopen browser

3. **Verify certificate was imported:**
   ```powershell
   # List trusted root CAs (look for mkcert or your CA name)
   certutil -store Root | findstr /i "mkcert"
   ```

### "jarvis.local" Doesn't Resolve

Verify hosts file entry:
```powershell
# View hosts file
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "jarvis"

# Should show something like:
# 192.168.1.204    jarvis.local aifactory-lan
```

If missing, add it (as Administrator):
```powershell
Add-Content C:\Windows\System32\drivers\etc\hosts "`n192.168.1.204    jarvis.local aifactory-lan"
ipconfig /flushdns
```

### Camera/Mic Still Not Working

1. Verify you're accessing via **HTTPS** (not HTTP)
2. Check browser permissions (click padlock → Site settings)
3. Open `https://jarvis.local/camera` and check the diagnostics panel

## Security Notes

- The imported CA is only trusted on YOUR machine
- The CA is locally generated and not publicly trusted
- This is safe for LAN-only access
- Do NOT share your private key (`key.pem`)

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| `rootCA.pem` | `deploy/certs/` | Root CA certificate (share with clients) |
| `cert.pem` | `deploy/certs/` | Server certificate |
| `key.pem` | `deploy/certs/` | Private key (DO NOT SHARE) |
| `import-lan-rootca.ps1` | `ops/windows/` | Windows import automation |
