# Jarvis V5 OS – Test Plan (v5.4.0)

**For:** Mr. W  
**Version:** v5.4.0
**Date:** 2025-12-06

---

## Introduction

This is your step-by-step test plan for **Jarvis V5 OS version 5.4.0**. We're testing to make sure all the main pages load correctly, the Holomat apps work smoothly, settings save properly, the theme system functions as expected, web search integration works, and the new Local LLM integration functions properly. You don't need to know any code – just follow the checkboxes below and test each feature in your browser.

This should take about 15–20 minutes if everything works smoothly. If you encounter any issues, take a screenshot and copy any red error messages from the browser console or terminal window.

---

## How to Start the System (Dev Mode on Windows)

Follow these steps to start Jarvis V5 OS on your local machine:

1. **Open PowerShell**
   - Press `Win + X` and select "Windows PowerShell" or "Terminal"

2. **Navigate to the Jarvis directory**
   ```powershell
   cd C:\Users\yosiw\Desktop\Jarvis-main
   ```

3. **Start the development servers**
   ```powershell
   npm start
   ```

4. **Wait for startup messages**
   You should see messages indicating:
   - `Server listening on https://0.0.0.0:1234` (Fastify API + Socket.IO)
   - `Next.js Ready on http://localhost:3001` (Web UI)
   - `TLS proxy on https://localhost:3000` (Main entry point)
   
   The system is ready when you see all three messages.

5. **How to stop the system**
   - In the PowerShell/Terminal window, press `Ctrl + C`
   - Type `Y` when asked "Terminate batch job"

**Important:** Leave the terminal window open while testing. Don't close it until you're done.

---

## Browser Checklist – Core Routes

Open your browser (Chrome or Edge recommended) and test each page. Check that it loads without crashing and displays the expected content.

### Basic Page Loading

- [ ] **Open https://localhost:3000/menu**  
  ✓ Page loads with a clean menu interface  
  ✓ Navigation buttons respond when clicked

- [ ] **Open https://localhost:3000/jarvis**  
  ✓ Full-screen Jarvis interface appears  
  ✓ Glowing orb visualization is visible  
  ✓ Chat input and controls are present

- [ ] **Open https://localhost:3000/holomat**  
  ✓ Dark background with purple "apps" button in center  
  ✓ Button glows and responds to hover

- [ ] **Open https://localhost:3000/settings**  
  ✓ Settings page loads with categories on the left  
  ✓ "Appearance", "Jarvis", "Text Chat", etc. are visible

- [ ] **Open https://localhost:3000/chat**  
  ✓ Chat interface loads  
  ✓ Message input field is visible

- [ ] **Open https://localhost:3000/camera**  
  ✓ Camera page loads (may show "no camera" if none connected – that's OK)

- [ ] **Open https://localhost:3000/files**  
  ✓ File library page loads  
  ✓ Upload button and file grid are visible

- [ ] **Open https://localhost:3000/security**  
  ✓ Security monitoring page loads  
  ✓ Shows camera grid or empty state

- [ ] **Open https://localhost:3000/3dmodel**  
  ✓ 3D model generation page loads  
  ✓ Tabs for "Camera capture", "Upload image", "Text prompt" are visible

- [ ] **Open https://localhost:3000/3dViewer**  
  ✓ 3D viewer page loads  
  ✓ Shows viewer area (may be empty if no model loaded – that's OK)

- [ ] **Open https://localhost:3000/3dprinters**  
  ✓ 3D printers management page loads  
  ✓ Shows printer list or empty state

- [ ] **Open https://localhost:3000/functions**  
  ✓ Functions/tools page loads

- [ ] **Open https://localhost:3000/scan**  
  ✓ Scan page loads

- [ ] **Open https://localhost:3000/devices**  
  ✓ Connected devices page loads  
  ✓ Shows device list or empty state  
  ✓ Debug panel is visible

---

## Holomat Test (Interactive Features)

Now let's test the Holomat's interactive app deck:

1. **Navigate to Holomat**
   - [ ] Go to https://localhost:3000/holomat

2. **Open the Apps Deck**
   - [ ] Click the purple "apps" button in the center of the screen
   - [ ] A glowing ring appears in the middle
   - [ ] Seven (7) app cards appear arranged in a circle around the ring
   - [ ] Cards have names like CLOCK, CALENDAR, CALCULATOR, CREATOR, etc.

3. **Test Individual App**
   - [ ] Click on the **CLOCK** card
   - [ ] A draggable window with a clock display opens
   - [ ] The window has a colored border and a close button (✕)
   - [ ] **Drag the window** around the screen by clicking and holding its header
   - [ ] The window follows your mouse smoothly
   - [ ] Click the close button (✕) – the window disappears

4. **Test Multiple Apps**
   - [ ] Open the apps deck again (click purple button)
   - [ ] Open the **CALENDAR** app
   - [ ] Without closing Calendar, open the apps deck again
   - [ ] Open the **CREATOR** app
   - [ ] You should now see both CALENDAR and CREATOR windows on screen at the same time
   - [ ] Drag each window independently – they should not interfere with each other
   - [ ] Close both windows

**Expected Result:** All apps open smoothly, can be dragged independently, and close without errors.

---

## Settings & Theme Test (Data Persistence)

This tests whether your settings and theme choices are saved correctly:

### Theme Switching

1. **Navigate to Settings**
   - [ ] Go to https://localhost:3000/settings

2. **Switch to Light Mode**
   - [ ] In the left sidebar, click "Appearance" (or look for theme controls)
   - [ ] Click the **Light** theme button
   - [ ] The interface should immediately become light/bright
   - [ ] **Refresh the page** (press F5)
   - [ ] The interface should **stay in Light mode** after refresh

3. **Switch to Dark Mode**
   - [ ] Click the **Dark** theme button
   - [ ] The interface should immediately become dark
   - [ ] **Refresh the page** (press F5)
   - [ ] The interface should **stay in Dark mode** after refresh

**Expected Result:** Theme preference persists across page refreshes.

### Settings Persistence

1. **Change a Jarvis Setting**
   - [ ] In Settings sidebar, click "Jarvis"
   - [ ] Change the "Assistant Name" field (e.g., from "Jarvis" to "Max")
   - [ ] Click the **Save Settings** button
   - [ ] You should see a success message (green notification or similar)

2. **Verify Persistence**
   - [ ] **Refresh the page** (press F5)
   - [ ] Go back to the "Jarvis" section
   - [ ] The Assistant Name should still show your changed value ("Max")

**Expected Result:** Settings are saved to the server and persist after refresh.

---

## Jarvis & Chat Behavior (API Integration)

This tests whether the AI chat functions properly (or fails gracefully if not configured):

### If API Keys Are NOT Configured

- [ ] Go to https://localhost:3000/chat (or /jarvis)
- [ ] Try sending a message like "Hello"
- [ ] **Expected:** You should see a clear error message like "API key not configured" or "OpenAI service unavailable"
- [ ] The page should **NOT crash** – it should show the error gracefully

### If API Keys ARE Configured

- [ ] Go to https://localhost:3000/chat (or /jarvis)
- [ ] Send a simple question: **"What time is it in Miami?"**
- [ ] **Expected:** Within a few seconds, you should get a normal text response
- [ ] The response should appear in the chat history
- [ ] The interface should remain responsive

**Expected Result:** Either graceful error handling OR successful AI response, depending on configuration.

---

## Local LLM Integration Test (v5.4.0 New Feature)

This tests the new Local LLM integration that allows Jarvis to use local models (Ollama or custom HTTP) instead of or alongside cloud GPT:

### Prerequisites (Optional)

If you want to test with a real local LLM:
1. Install Ollama from https://ollama.com
2. Run `ollama pull llama3.1` (or another model)
3. Verify Ollama is running: `curl http://127.0.0.1:11434/api/tags`

**Skip this test if you don't have Ollama installed** – that's OK, we can test the UI configuration.

### UI Configuration Test

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **Local LLM** card

2. **Check Initial State**
   - [ ] The card shows "Not connected" badge (gray)
   - [ ] The **Enable** checkbox is unchecked

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **Provider** dropdown shows "Ollama (local HTTP)" and "Custom HTTP API" options
   - [ ] **Base URL** field shows default: `http://127.0.0.1:11434`
   - [ ] **Model** field is visible
   - [ ] **Temperature** field shows default: `0.7`
   - [ ] **Max Tokens** field is visible

4. **Fill in Configuration**
   - [ ] Leave Provider as "Ollama (local HTTP)"
   - [ ] Base URL: `http://127.0.0.1:11434`
   - [ ] Model: `llama3.1` (or any model name)
   - [ ] Temperature: `0.7`
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Chat Integration Toggle**
   - [ ] Scroll to the **Text Chat** section
   - [ ] Find the new **"Use Local LLM when available"** checkbox
   - [ ] Check the checkbox
   - [ ] Two radio buttons appear:
     - "Local LLM as primary, cloud as fallback"
     - "Cloud as primary, local as fallback"
   - [ ] Select **"Local LLM as primary, cloud as fallback"**

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → Local LLM
   - [ ] Verify **Enable** is still checked
   - [ ] Verify all fields (Base URL, Model, etc.) are still filled
   - [ ] Verify status badge still shows "Connected"
   - [ ] Go to Text Chat settings
   - [ ] Verify "Use Local LLM when available" is still checked
   - [ ] Verify "Local LLM as primary" is still selected

**Expected Result:** Configuration persists across page refreshes.

### Functional Test (Only if Ollama is Running)

**Skip this if you don't have Ollama installed.**

1. **Test Chat with Local LLM**
   - [ ] Go to https://localhost:3000/chat
   - [ ] Send a simple message: **"Say hello in one sentence"**
   - [ ] **Expected:** Response appears within 5-30 seconds (depending on model speed)
   - [ ] Response is generated by your local model (check browser DevTools Network tab for requests to `http://127.0.0.1:11434`)

2. **Test Fallback (Optional)**
   - [ ] Stop Ollama (close the app or `Ctrl+C` if running in terminal)
   - [ ] Go back to https://localhost:3000/chat
   - [ ] Send another message: **"Test fallback"**
   - [ ] **Expected:** Request attempts local first, then falls back to cloud GPT (if configured)
   - [ ] Response should still appear (from cloud)

**Expected Result:** Local LLM responds correctly when running; graceful fallback to cloud when local fails.

---

## 3D, Camera & Security Sanity Checks

Quick checks to ensure specialized pages don't crash:

- [ ] **Visit /3dmodel**  
  Page loads without breaking, shows the three input tabs (Camera/Upload/Text)

- [ ] **Visit /3dViewer**  
  Page loads and displays the 3D viewer interface (grid, controls on the right)

- [ ] **Visit /3dprinters**  
  Printers panel loads (may show empty list if no printers connected)

- [ ] **Visit /camera**  
  Page loads and does not crash (may show "waiting for camera" or empty state)

- [ ] **Visit /security**  
  Page loads and shows camera grid or empty placeholder

**Expected Result:** All pages load without JavaScript errors or blank screens.

---

## Backend Health Check (Browser DevTools)

This confirms the backend API is responding correctly:

1. **Open Browser DevTools**
   - Press `F12` or right-click and select "Inspect"
   - Click the **Network** tab

2. **Reload a few pages**
   - Go to https://localhost:3000/settings
   - Look in the Network tab for requests to `/settings`
   - **Expected:** Status code should be **200** (green or black text)
   
3. **Check File Library**
   - Go to https://localhost:3000/files
   - Look for requests to `/file-library`
   - **Expected:** Status code should be **200**

4. **Check for Errors**
   - Look for any **red entries** in the Network tab (status codes 400, 500, etc.)
   - If you see red errors, note the request URL and status code

**Expected Result:** Most API requests return status 200. Some 404s are OK for missing resources, but 500 errors indicate problems.

---

## How to Report Issues

If something doesn't work as expected:

1. **Take a Screenshot**
   - Press `Win + Shift + S` to capture the screen
   - Include the full browser window

2. **Copy Error Messages**
   - **Browser Console Errors:**
     - Press `F12` → Console tab
     - Look for red error messages
     - Right-click and "Copy" the error text
   
   - **Terminal/PowerShell Errors:**
     - Look at the terminal window where `npm start` is running
     - Copy any red error text or stack traces

3. **Send to Max**
   - Email or message Max with:
     - Screenshot
     - Error text from browser console
     - Error text from terminal (if any)
     - Which page/feature you were testing
     - What you expected vs. what happened

---

## Summary Checklist

Before you finish, make sure you've tested:

- [ ] All 15+ core pages load without crashing
- [ ] Holomat apps open, drag, and close properly
- [ ] Multiple Holomat apps can be open at the same time
- [ ] Theme (Light/Dark) switches and persists after refresh
- [ ] Settings save and persist after refresh
- [ ] Chat/Jarvis either works with AI OR shows clear error message
- [ ] Backend API returns 200 status codes for key endpoints

If all checkboxes are marked and no major issues were found, **v5.1.0 is ready for deployment!**

---

**End of Test Plan**

Thank you for taking the time to test Jarvis V5 OS. Your feedback helps ensure a stable, production-ready system.
