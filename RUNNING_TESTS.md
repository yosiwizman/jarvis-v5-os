# Running Backend Tests for Memory & Logs

## 🎯 Quick Start

### Prerequisites
1. **Server must be running**
   ```powershell
   npm run dev:server
   ```
   Wait for: "Conversation store initialized", "Action store initialized", "Notification scheduler initialized"

2. **Run the automated tests**
   ```powershell
   powershell -ExecutionPolicy Bypass -File test-memory-logs.ps1
   ```

That's it! The script will test all Memory & Logs APIs automatically.

---

## 📋 What Gets Tested

The script tests 12 components:

### API Tests (1-10)
1. ✅ Server health check
2. ✅ Save conversation
3. ✅ List conversations
4. ✅ Get conversation by ID
5. ✅ Search conversations
6. ✅ Get conversation statistics
7. ✅ Record actions (3 types)
8. ✅ List actions
9. ✅ Filter actions by type
10. ✅ Get action statistics

### Storage Tests (11-12)
11. ✅ File system verification
12. ✅ Delete conversation

---

## 🎨 Expected Output

```
🧪 Memory & Logs Backend API Testing
========================================

📡 Test 1: Server Health Check
✅ PASS: Server is responding

📝 Test 2: Conversation Storage API
✅ PASS: Save conversation

📋 Test 3: List Conversations
✅ PASS: List conversations
✅ PASS: Find saved conversation in list

...

========================================
📊 Test Summary
========================================
✅ Passed: 20
❌ Failed: 0
📈 Total:  20

🎯 Success Rate: 100%

🎉 All tests passed! Memory & Logs system is working correctly.
```

---

## ⚠️ If Server Is Not Running

You'll see:
```
❌ FAIL: Server is responding
⚠️  Server is not running or not accessible at https://localhost:3000
Please start the server with: npm run dev:server
```

**Solution:** Start the server first, then run tests again.

---

## 🔧 Advanced Usage

### Custom Server URL
```powershell
.\test-memory-logs.ps1 -ServerUrl "https://localhost:3001"
```

### With Certificate Checking
```powershell
.\test-memory-logs.ps1 -SkipCertCheck:$false
```

---

## 📊 What Happens During Tests

1. **Checks server is accessible**
2. **Creates a test conversation** with 4 messages
3. **Verifies conversation is saved** to database
4. **Lists all conversations** and finds the test one
5. **Retrieves the specific conversation** by ID
6. **Searches for conversations** matching "test"
7. **Gets statistics** about conversations
8. **Records 3 test actions** (message_sent, image_generated, 3d_model_generated)
9. **Lists all actions** 
10. **Filters actions by type** (image_generated)
11. **Gets action statistics**
12. **Verifies files exist** on disk
13. **Deletes the test conversation** (cleanup)
14. **Verifies deletion worked**

---

## 🐛 Troubleshooting

### Test fails: "Server is not responding"
- Start server: `npm run dev:server`
- Wait for initialization messages
- Try again

### Test fails: "Save conversation"
- Check server logs: `Get-Content data\logs\app.log -Tail 20`
- Verify conversation store initialized
- Check for errors in logs

### Test fails: "Directory does not exist"
- Normal on first run - directories created when server starts
- Restart server and try again

### Test fails: "Cannot connect to server"
- Check firewall settings
- Verify HTTPS certificate
- Try with `-ServerUrl "http://localhost:3000"` (HTTP instead of HTTPS)

---

## 📁 Where Data Is Stored

After tests run successfully, you'll find:

```
data/
├── conversations/
│   ├── index.json              # Conversation index
│   └── <uuid>.json            # Individual conversations
├── actions/
│   ├── index.json              # Action index
│   └── 2024-12-06.json        # Today's actions
└── logs/
    ├── app.log                 # Application logs
    ├── error.log               # Error logs
    ├── security.log            # Security logs
    └── actions.log             # Action logs
```

---

## ✅ Success Criteria

**All tests should pass (100% success rate)**

If you see this, the Memory & Logs system is working correctly:
```
🎉 All tests passed! Memory & Logs system is working correctly.
```

---

## 🔄 What's NOT Tested (Requires Manual Testing)

The automated script tests backend APIs only. You still need to manually test:

1. **Frontend UI** - Settings → Memory & Logs tabs
2. **Memory Recall** - Ask J.A.R.V.I.S. "What did we discuss?"
3. **Real-time integration** - Chat → Clear conversation → Check Settings
4. **Search functionality** - Use search bars in UI
5. **Delete from UI** - Delete conversations from Settings page

**Use `TESTING_CHECKLIST.md` for manual testing.**

---

## 💡 Next Steps After Tests Pass

1. ✅ Backend APIs working → **Test the UI**
   - Go to Settings → Memory & Logs
   - Verify all tabs load
   - Test search and filtering

2. ✅ UI working → **Test integration**
   - Have a chat conversation
   - Click "Clear conversation"
   - Verify it appears in Memory & Logs

3. ✅ Integration working → **Test memory recall**
   - Ask J.A.R.V.I.S.: "What did we discuss?"
   - Verify it recalls the conversation

---

## 📞 Getting Help

If tests fail consistently:
1. Check `data/logs/app.log` for errors
2. Verify all dependencies installed: `npm install`
3. Check TypeScript compiled: `npm run build`
4. Restart server
5. Review `TESTING_CHECKLIST.md` for detailed troubleshooting

---

**Ready to test? Run the script now!** 🚀
