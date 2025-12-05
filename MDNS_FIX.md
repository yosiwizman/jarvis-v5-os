# mDNS Broadcasting Fix

## 🔧 What Was Fixed

### Issue
The Jarvis server was not broadcasting properly because the service type format was incorrect.

### Root Cause
```typescript
// ❌ WRONG - Missing underscores
type: 'jarvis-server',
protocol: 'tcp',

// ✅ CORRECT - Full format
type: '_jarvis-server._tcp',
```

The `bonjour-service` library needs the **full service type format** including underscores and protocol suffix.

---

## 📝 Changes Made

### 1. Server Side (`apps/server/src/index.ts`)

**Before:**
```typescript
const service = bonjour.publish({
  name: 'Jarvis',
  type: 'jarvis-server',      // ❌ Wrong format
  port: PORT,
  protocol: 'tcp',
  txt: { ... }
});
```

**After:**
```typescript
const service = bonjour.publish({
  name: 'Jarvis',
  type: '_jarvis-server._tcp',  // ✅ Correct format
  port: PORT,
  txt: {
    version: '1.0',
    protocol: protocol,  // https or http
    path: '/cameras',
    features: 'holomat,3d,camera,ai'
  }
});
```

**Added enhanced logging:**
- Shows full service details on startup
- Provides verification command
- Better error reporting with stack traces

### 2. Web UI (`apps/web/app/devices/page.tsx`)

**Added Debug Panel** with:
- ✅ Socket.IO connection status
- ✅ mDNS service discovery info
- ✅ Device statistics
- ✅ Server verification commands
- ✅ Android connection checklist
- ✅ Real-time connection monitoring

---

## 🧪 Testing

### Verify Server is Broadcasting

On your Mac (where Jarvis runs):

```bash
# Check if service is broadcasting
dns-sd -B _jarvis-server._tcp

# Expected output:
# Browsing for _jarvis-server._tcp
# Timestamp     A/R Flags if Domain               Service Type         Instance Name
# 12:34:56.789  Add     2  4 local.               _jarvis-server._tcp. Jarvis
```

### Get Service Details

```bash
# Get full details
dns-sd -L Jarvis _jarvis-server._tcp

# Expected output:
# Jarvis._jarvis-server._tcp.local. can be reached at YourMac.local.:1234
#  protocol=https version=1.0 path=/cameras features=holomat,3d,camera,ai
```

### Check Server Logs

When starting Jarvis server, you should see:

```
INFO: 📡 Broadcasting Jarvis service via mDNS (auto-discovery enabled)
  service: "Jarvis"
  type: "_jarvis-server._tcp"
  port: 1234
  protocol: "https"
  host: "YourMac.local"
INFO: 🔍 Verify broadcast with: dns-sd -B _jarvis-server._tcp
```

### Verify Android Discovery

On Android device:

```bash
adb logcat | grep -i jarvis

# Expected logs:
# I/JarvisConnection: 🔍 Starting mDNS discovery for Jarvis...
# I/JarvisConnection: ✅ mDNS discovery started
# I/JarvisConnection: 🎯 Found Jarvis server!
# I/JarvisConnection: ✅ Jarvis resolved at: https://192.168.1.X:1234
# I/JarvisConnection: ✅ Connected to Jarvis!
```

---

## 🎯 Expected Behavior

### When Everything Works:

1. **Server starts** → Broadcasts `_jarvis-server._tcp` on local network
2. **Android app opens** → Scans for `_jarvis-server._tcp`
3. **Service discovered** → Android finds server within 1-5 seconds
4. **Service resolved** → Android gets IP: `192.168.1.X`, port: `1234`
5. **Connection** → Android connects to `https://192.168.1.X:1234/cameras`
6. **Registration** → Device appears in `/devices` page
7. **Ready** → Can send commands from web UI

### Debug Panel Shows:

- **Socket.IO Connection**: ✅ Connected
- **Total Devices**: Number of connected devices
- **Android HoloMat**: Number of Android devices
- **Service Type**: `_jarvis-server._tcp`
- **Discovery Port**: 5353 (UDP)
- **Service Port**: 1234

---

## 🐛 Troubleshooting

### If Server Still Not Broadcasting:

1. **Restart server:**
   ```bash
   cd apps/server
   npm run dev
   ```

2. **Check logs for:**
   - ✅ `📡 Broadcasting Jarvis service via mDNS`
   - ❌ `⚠️ mDNS broadcasting failed`

3. **If failed, check:**
   - `bonjour-service` installed: `npm list bonjour-service`
   - Firewall allows UDP 5353
   - Network supports multicast

### If Android Still Can't Find Server:

1. **Verify broadcast working:**
   ```bash
   dns-sd -B _jarvis-server._tcp
   # Should show "Jarvis"
   ```

2. **Check Android logs:**
   ```bash
   adb logcat | grep JarvisConnection
   ```

3. **Network issues:**
   - Both on same WiFi network
   - Not on guest WiFi (often blocks mDNS)
   - Router allows multicast traffic
   - No VPN active on Android

4. **Fallback to manual IP:**
   - Get server IP: `hostname -I`
   - Update Android `FALLBACK_SERVER_URL` to actual IP
   - Rebuild and install APK

---

## 📊 Network Requirements

### Ports
- **5353 UDP** - mDNS service discovery
- **1234 TCP** - Jarvis server (HTTPS/HTTP + WebSocket)

### Firewall Rules (if needed)

```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /path/to/node

# Linux
sudo ufw allow 5353/udp
sudo ufw allow 1234/tcp
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ `dns-sd -B _jarvis-server._tcp` shows "Jarvis"
2. ✅ Android logs show "Found Jarvis server!"
3. ✅ Android device appears in `/devices` page
4. ✅ Debug panel shows "✅ Connected"
5. ✅ Can send commands from web UI to Android

---

## 🎉 Next Steps

Once broadcasting is fixed:

1. **Test discovery** - Open Android app, should auto-connect
2. **Visit `/devices`** - Should see your Android device listed
3. **Send commands** - Click buttons to control Android device
4. **Add more devices** - Install on multiple Android devices
5. **Monitor debug panel** - Keep it open to watch connections

---

**Date:** November 19, 2025  
**Status:** ✅ Fixed - mDNS format corrected  
**Version:** Updated to use `_jarvis-server._tcp` format



