# Jarvis Backend Testing - Complete Guide

## Quick Start (2 Steps)

### Step 1: Start the Server (Terminal 1)

Open a PowerShell window and run:

```powershell
cd C:\Users\yosiw\Desktop\Jarvis-main
.\START-SERVER.ps1
```

**Wait for these messages** (takes 30-60 seconds):
- ✅ "Conversation store initialized"
- ✅ "Action store initialized"
- ✅ "Notification scheduler initialized"
- ✅ "Ready" (from Next.js)

**KEEP THIS WINDOW OPEN!**

### Step 2: Run All Tests (Terminal 2)

Open a NEW PowerShell window and run:

```powershell
cd C:\Users\yosiw\Desktop\Jarvis-main
.\run-all-tests.ps1
```

The script will:
1. ✅ Verify server is running
2. ✅ Test all API endpoints
3. ✅ Run CRUD operations
4. ✅ Check file system
5. ✅ Analyze logs
6. ✅ Generate health report

---

## What Gets Tested

### Core Functionality
- [x] Server health check
- [x] Configuration endpoint
- [x] Settings endpoint
- [x] Conversation storage (Create, Read, Delete)
- [x] Action tracking
- [x] Notification history
- [x] Data persistence (file system)
- [x] Log analysis

### API Endpoints Tested
- `/config` - Server configuration
- `/settings` - Application settings
- `/api/conversations` - List conversations
- `/api/conversations/save` - Save conversation
- `/api/conversations/:id` - Get/Delete conversation
- `/api/conversations/stats` - Conversation statistics
- `/api/actions` - List actions
- `/api/actions/record` - Record action
- `/api/actions/stats` - Action statistics
- `/api/notifications/history` - Notification history
- `/api/lockdown/status` - Lockdown status
- `/api/3dprint/config` - 3D print configuration
- `/system/metrics` - System metrics

---

## Expected Output

### Success (All Tests Pass)

```
============================================
  FINAL REPORT
============================================

Test Results:
  Passed: 20
  Failed: 0
  Total:  20
  Success Rate: 100%

API Endpoint Status:
  Successful: 10
  Failed: 0

System Status:
  SYSTEM READY FOR UI TESTING
```

### Partial Success (Some Failures)

```
Test Results:
  Passed: 15
  Failed: 5
  Success Rate: 75%

API Endpoint Status:
  Successful: 7
  Failed: 3

Critical Log Errors (sample):
  [Error details...]

System Status:
  ISSUES NEED REVIEW
  Failed APIs/Tests require attention before UI testing
```

---

## Known Issues & Expected Failures

### Missing Endpoints (Expected 404s)
Some endpoints may not be implemented yet:
- `/api/lockdown/status` - Feature may be incomplete
- `/api/3dprint/config` - 3D print integration optional
- `/system/metrics` - System monitoring feature

These 404s are acceptable if features aren't needed.

### Configuration-Dependent Tests
Some tests require configuration:
- Gmail integration (needs OAuth tokens)
- Smart home devices (needs credentials)
- 3D printer (needs Bambu Labs auth)

---

## Bugs Fixed (Already Applied)

✅ **Critical Bugs Resolved:**
1. **Logger.ts** - Fixed `reply.once is not a function` error
2. **Component Imports** - Fixed Settings page import errors
3. **Integration Config** - Fixed undefined config crash

All these fixes are already applied to your codebase.

---

## Manual UI Testing (After Tests Pass)

Once backend tests pass, test the UI:

1. **Open Frontend**: https://localhost:3000
2. **Test Settings Page**: https://localhost:3000/settings
   - Verify all tabs load
   - Check Memory & Logs section
   - Test integration cards
3. **Test Chat Interface**: https://localhost:3000/chat
4. **Test Other Pages**: Navigate through the app

---

## Troubleshooting

### Server Won't Start
```powershell
# Check if port 1234 is in use
netstat -ano | findstr :1234

# If blocked, kill the process
Stop-Process -Id [PID] -Force

# Try again
.\START-SERVER.ps1
```

### Tests Fail Immediately
- Ensure server is running first
- Wait for full initialization (30-60 seconds)
- Check server terminal for errors

### SSL Certificate Errors
Tests are configured to bypass SSL checks for localhost.
This is normal for development.

---

## Advanced: Manual Test Scripts

If you want to run the original test scripts:

```powershell
# Memory & Logs test
powershell -ExecutionPolicy Bypass -File test-memory-logs.ps1

# Agent D test
powershell -ExecutionPolicy Bypass -File test-agent-d-simple.ps1

# Email notifications test
powershell -ExecutionPolicy Bypass -File test-email-notifications.ps1
```

**Note**: These scripts have encoding issues with emojis in PowerShell 5.1.
The `run-all-tests.ps1` script works around these issues.

---

## Success Criteria

Your backend is ready for UI testing when:
- ✅ Server starts without errors
- ✅ All core APIs respond (200 status)
- ✅ Conversation CRUD operations work
- ✅ Action tracking works
- ✅ Data directories exist and contain files
- ✅ No critical errors in logs
- ✅ Test success rate ≥ 80%

---

## Support

If tests fail consistently:
1. Check server logs: `data/logs/error.log`
2. Review API responses in test output
3. Verify npm dependencies: `npm install`
4. Try clean restart: Stop server → Delete `node_modules` → `npm install` → Start server

---

## Test Results Log

Record your test results here:

**Date**: _____________  
**Test Run #**: _____________  
**Success Rate**: _____________ %  
**Failed Tests**: _____________  
**Notes**:
```
