# Memory & Logs System - Testing Checklist

## 📋 Pre-Testing Setup

Before you begin testing, ensure:
- [ ] Server is running (`npm run dev:server` or equivalent)
- [ ] Web interface is accessible (usually https://localhost:3000)
- [ ] You have access to the file system to check logs

---

## ✅ Test 1: Memory Recall Function

### Objective
Verify that J.A.R.V.I.S. can recall past conversations using the `recall_memory` function.

### Steps
1. **Open Chat Interface**
   - Navigate to the chat page (usually `/chat`)
   - Verify the interface loads without errors

2. **Have a Simple Conversation**
   ```
   You: "Hello J.A.R.V.I.S., how are you today?"
   [Wait for response]
   
   You: "Can you create an image of a sunset over mountains?"
   [Wait for image generation - this will be recorded as an action]
   
   You: "Tell me about artificial intelligence"
   [Wait for response]
   ```

3. **Test Memory Recall**
   ```
   You: "What did we just discuss?"
   ```
   
   **Expected Result:**
   - J.A.R.V.I.S. should use the `recall_memory` function
   - Should summarize the conversation about AI and mention the image creation
   - Response should include conversation snippets and action history

4. **Test Time-Range Recall**
   ```
   You: "What images did I generate today?"
   ```
   
   **Expected Result:**
   - Should specifically list the sunset image
   - Should show timestamp and metadata

### ✅ Pass Criteria
- [ ] J.A.R.V.I.S. successfully recalls the conversation
- [ ] Response includes specific details from the chat
- [ ] Time-range filtering works correctly
- [ ] No errors in console

### ❌ Failure Scenarios
If the test fails:
- Check browser console for errors (F12)
- Verify API endpoint `/api/conversations` is accessible
- Check server logs for errors
- Verify `recall_memory` function is in the function list

---

## ✅ Test 2: Settings → Memory & Logs UI

### Objective
Verify that the Memory & Logs section in Settings works correctly.

### Part A: Conversations Tab

1. **Navigate to Settings**
   - Go to Settings page
   - Scroll to "Memory & Logs" section
   - Click on "💬 Conversations" tab

2. **Verify Conversation Display**
   - [ ] Previous conversation should appear in the list
   - [ ] Shows source indicator (💬 Chat)
   - [ ] Shows timestamp
   - [ ] Shows preview of first message

3. **Test Conversation Details**
   - [ ] Click on a conversation
   - [ ] Full message history appears on the right
   - [ ] Messages show role (You/Jarvis)
   - [ ] All messages are present and readable

4. **Test Search**
   ```
   - Type "sunset" in search bar
   - Conversation with image request should appear
   - Type "artificial" in search bar
   - Conversation about AI should appear
   ```
   
   **Expected Result:**
   - [ ] Search returns matching conversations
   - [ ] Search updates in real-time
   - [ ] No results message appears for non-matches

5. **Test Source Filter**
   - [ ] Click "Filter by Source" dropdown
   - [ ] Select "Chat"
   - [ ] Only chat conversations appear
   - [ ] Select "All" to reset

6. **Test Delete**
   - [ ] Select any conversation
   - [ ] Click "Delete" button
   - [ ] Confirm deletion in modal
   - [ ] Conversation disappears from list
   - [ ] Refresh page - conversation should still be gone

### Part B: Actions Tab

1. **Navigate to Actions Tab**
   - Click on "⚡ Actions" tab

2. **Verify Action Display**
   - [ ] Image generation action appears
   - [ ] Shows timestamp (today's date)
   - [ ] Shows action type badge
   - [ ] Shows source badge (User)

3. **Test Action Details**
   - [ ] Click on an action
   - [ ] Metadata panel appears on right
   - [ ] Shows JSON with prompt, model, etc.
   - [ ] Timestamp is correct

4. **Test Action Filters**
   - [ ] Filter by "Image Generated"
   - [ ] Only image actions appear
   - [ ] Filter by "All Types" to reset
   - [ ] Filter by "User" source
   - [ ] Only user actions appear

5. **Test Timeline View**
   - [ ] Actions grouped by date (e.g., "Today")
   - [ ] Timeline connector line visible
   - [ ] Icons match action types
   - [ ] Scroll works smoothly

### Part C: System Logs Tab

1. **Navigate to System Logs Tab**
   - Click on "📋 System Logs" tab

2. **Verify Demo Mode**
   - [ ] Info banner says "Demo Mode"
   - [ ] Sample logs are displayed
   - [ ] Log levels color-coded (Info=blue, Warn=yellow, Error=red)

3. **Test Filters**
   - [ ] Filter by log level
   - [ ] Filter by category
   - [ ] Search box works
   - [ ] Detail view expands on click

**Note:** Real log viewing requires additional API implementation (future enhancement)

### ✅ Pass Criteria
- [ ] All three tabs load without errors
- [ ] Conversations display and are searchable
- [ ] Actions display with correct metadata
- [ ] Delete functionality works
- [ ] Filters work correctly
- [ ] UI is responsive and smooth

### ❌ Failure Scenarios
If UI tests fail:
- Check browser console (F12) for React errors
- Verify API endpoints are responding
- Check network tab for failed requests
- Verify components are imported correctly in settings page

---

## ✅ Test 3: Logging System

### Objective
Verify that server logs are being written correctly.

### Steps

1. **Start the Server** (if not already running)
   ```bash
   npm run dev:server
   ```
   
   **Watch for:**
   - [ ] "Conversation store initialized" log
   - [ ] "Action store initialized" log
   - [ ] "Notification scheduler initialized" log
   - [ ] No error messages on startup

2. **Check Log Directory**
   ```powershell
   # Navigate to logs directory
   cd C:\Users\yosiw\Desktop\Jarvis-main\data\logs
   
   # List log files
   dir
   ```
   
   **Expected Files:**
   - [ ] `app.log` - Main application log
   - [ ] `error.log` - Error-only log
   - [ ] `security.log` - Security events
   - [ ] `actions.log` - User action log

3. **Verify Log Content**
   ```powershell
   # View last 20 lines of app.log
   Get-Content app.log -Tail 20
   ```
   
   **Should contain:**
   - [ ] Timestamp (ISO 8601 format)
   - [ ] Log level (info, warn, error)
   - [ ] Structured JSON format
   - [ ] Relevant context (request IDs, etc.)

4. **Test Log Writing**
   - Make an API request (e.g., refresh settings page)
   - Check app.log again
   - New log entries should appear

5. **Verify Log Rotation** (after 24 hours of running)
   ```powershell
   # Check for rotated logs
   dir *.log.gz
   ```
   
   **Expected:** Older logs should be compressed as `.log.gz`

### ✅ Pass Criteria
- [ ] All 4 log files exist
- [ ] Logs contain structured JSON data
- [ ] Timestamps are correct
- [ ] Log levels are appropriate
- [ ] No errors in error.log (or only expected errors)

### ❌ Failure Scenarios
If logging fails:
- Check file permissions on data/logs directory
- Verify logger is imported in server files
- Check for TypeScript compilation errors
- Verify pino dependencies are installed

---

## 🧪 Test 4: Conversation Storage (Backend)

### Objective
Verify conversations are being saved to disk.

### Steps

1. **Have a Chat Conversation**
   - Open chat interface
   - Send multiple messages
   - Click "Clear conversation" button

2. **Check Conversation Files**
   ```powershell
   # Navigate to conversations directory
   cd C:\Users\yosiw\Desktop\Jarvis-main\data\conversations
   
   # List files
   dir
   ```
   
   **Expected:**
   - [ ] `index.json` file exists
   - [ ] One or more `{uuid}.json` files exist
   - [ ] Files have recent timestamps

3. **Inspect Conversation File**
   ```powershell
   # View index.json
   Get-Content index.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
   
   # View a conversation file
   Get-Content (Get-ChildItem *.json | Select-Object -First 1 -Skip 1).Name | ConvertFrom-Json | ConvertTo-Json -Depth 10
   ```
   
   **Should contain:**
   - [ ] `id` - UUID
   - [ ] `source` - "chat"
   - [ ] `messages` - Array of messages
   - [ ] `metadata` - Title, model, etc.
   - [ ] `timestamp` - ISO 8601 format
   - [ ] `tags` - Array of tags

### ✅ Pass Criteria
- [ ] Conversations are saved to disk
- [ ] JSON structure is correct
- [ ] All messages are present
- [ ] Metadata is accurate

---

## 🧪 Test 5: Action Tracking (Backend)

### Objective
Verify actions are being recorded correctly.

### Steps

1. **Generate Actions**
   - Create an image via chat
   - Send a few messages
   - Try other functions if available

2. **Check Action Files**
   ```powershell
   # Navigate to actions directory
   cd C:\Users\yosiw\Desktop\Jarvis-main\data\actions
   
   # List files
   dir
   ```
   
   **Expected:**
   - [ ] `index.json` exists
   - [ ] Today's date file exists (e.g., `2024-12-06.json`)

3. **Inspect Action File**
   ```powershell
   # View today's actions
   $today = Get-Date -Format "yyyy-MM-dd"
   Get-Content "$today.json" | ConvertFrom-Json | ConvertTo-Json -Depth 10
   ```
   
   **Should contain:**
   - [ ] `id` - UUID
   - [ ] `type` - Action type (e.g., "image_generated")
   - [ ] `source` - "user" or "system"
   - [ ] `timestamp` - ISO 8601
   - [ ] `metadata` - Action-specific data

### ✅ Pass Criteria
- [ ] Actions are saved to disk
- [ ] Correct action types are recorded
- [ ] Metadata is complete
- [ ] Timestamps are accurate

---

## 📊 Final Verification Checklist

After completing all tests:

### Frontend
- [ ] Memory recall works in chat
- [ ] Settings page loads without errors
- [ ] All three tabs in Memory & Logs work
- [ ] Search and filter work correctly
- [ ] Delete conversation works
- [ ] UI is responsive and looks good

### Backend
- [ ] Server starts without errors
- [ ] All log files are created
- [ ] Logs contain proper data
- [ ] Conversations saved to disk
- [ ] Actions saved to disk
- [ ] API endpoints respond correctly

### Integration
- [ ] Conversation saving triggers automatically
- [ ] Action recording works for functions
- [ ] Memory recall searches both conversations and actions
- [ ] Time-range filtering works
- [ ] Content-type filtering works

---

## 🐛 Troubleshooting Guide

### Issue: Memory recall doesn't work
**Solutions:**
1. Check browser console for errors
2. Verify `/api/conversations` endpoint is accessible
3. Check if conversations are being saved (look in data/conversations/)
4. Verify recall_memory function is in function list
5. Check server logs for API errors

### Issue: UI not loading
**Solutions:**
1. Check browser console for React errors
2. Verify components are imported in settings page
3. Check network tab for failed API calls
4. Restart development server
5. Clear browser cache

### Issue: Logs not appearing
**Solutions:**
1. Verify data/logs directory exists and is writable
2. Check logger is imported in server files
3. Verify pino dependencies are installed
4. Check for TypeScript compilation errors
5. Restart server

### Issue: Conversations not saving
**Solutions:**
1. Check data/conversations directory exists
2. Verify conversation store initialized on server start
3. Check API endpoint `/api/conversations/save` works
4. Look for errors in server logs
5. Verify chat page calls saveConversation function

### Issue: Actions not recording
**Solutions:**
1. Check data/actions directory exists
2. Verify action store initialized
3. Check `/api/actions/record` endpoint
4. Verify recordAction function is called in chat
5. Check server logs for errors

---

## 📝 Test Results Template

```
# Memory & Logs Testing Results
Date: [Today's date]
Tester: [Your name]

## Test 1: Memory Recall
Status: [ ] PASS [ ] FAIL
Notes: 

## Test 2: UI - Conversations Tab
Status: [ ] PASS [ ] FAIL
Notes:

## Test 2: UI - Actions Tab  
Status: [ ] PASS [ ] FAIL
Notes:

## Test 2: UI - System Logs Tab
Status: [ ] PASS [ ] FAIL
Notes:

## Test 3: Logging System
Status: [ ] PASS [ ] FAIL
Notes:

## Test 4: Conversation Storage
Status: [ ] PASS [ ] FAIL
Notes:

## Test 5: Action Tracking
Status: [ ] PASS [ ] FAIL
Notes:

## Overall Result
All Tests: [ ] PASS [ ] SOME FAILURES
Ready for Production: [ ] YES [ ] NO

## Issues Found
1. 
2. 
3. 

## Recommendations
1. 
2. 
3. 
```

---

## 🎯 Quick Start Testing

**Minimum viable test (5 minutes):**
1. Start server
2. Open chat, send a message
3. Ask "What did we just discuss?"
4. Go to Settings → Memory & Logs
5. Verify conversation appears

**If this works, the core system is functional!**

---

**Good luck with testing! 🚀**
