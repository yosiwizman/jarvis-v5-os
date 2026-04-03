# AKIOR V6 OS – Test Plan (v6.1.0)

**For:** Mr. W  
**Version:** v6.1.0  
**Date:** 2025-12-07

---

## Introduction

This is your step-by-step test plan for **AKIOR V6.1.0** – the Notification Drawer & History UI release. We're testing to make sure all the main pages load correctly, the Holomat apps work smoothly, settings save properly, the theme system functions as expected, all v5.x integrations still work (Web Search, Local LLM, TTS, Spotify, Gmail, Calendar), the v6.0.0 notification system (scheduled notifications + toast UI) works correctly, and the NEW notification drawer UI (bell icon, badge, history panel, read/unread tracking) works correctly. You don't need to know any code – just follow the checkboxes below and test each feature in your browser.

This should take about 15–20 minutes if everything works smoothly. If you encounter any issues, take a screenshot and copy any red error messages from the browser console or terminal window.

---

## How to Start the System (Dev Mode on Windows)

Follow these steps to start AKIOR V6 OS on your local machine:

1. **Open PowerShell**
   - Press `Win + X` and select "Windows PowerShell" or "Terminal"

2. **Navigate to the AKIOR directory**
   ```powershell
   cd C:\Users\yosiw\Desktop\AKIOR-main
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

- [ ] **Open https://localhost:3000/akior**  
  ✓ Full-screen AKIOR interface appears  
  ✓ Glowing orb visualization is visible  
  ✓ Chat input and controls are present

- [ ] **Open https://localhost:3000/holomat**  
  ✓ Dark background with purple "apps" button in center  
  ✓ Button glows and responds to hover

- [ ] **Open https://localhost:3000/settings**  
  ✓ Settings page loads with categories on the left  
  ✓ "Appearance", "AKIOR", "Text Chat", etc. are visible

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

1. **Change a AKIOR Setting**
   - [ ] In Settings sidebar, click "AKIOR"
   - [ ] Change the "Assistant Name" field (e.g., from "AKIOR" to "Max")
   - [ ] Click the **Save Settings** button
   - [ ] You should see a success message (green notification or similar)

2. **Verify Persistence**
   - [ ] **Refresh the page** (press F5)
   - [ ] Go back to the "AKIOR" section
   - [ ] The Assistant Name should still show your changed value ("Max")

**Expected Result:** Settings are saved to the server and persist after refresh.

---

## AKIOR & Chat Behavior (API Integration)

This tests whether the AI chat functions properly (or fails gracefully if not configured):

### If API Keys Are NOT Configured

- [ ] Go to https://localhost:3000/chat (or /akior)
- [ ] Try sending a message like "Hello"
- [ ] **Expected:** You should see a clear error message like "API key not configured" or "OpenAI service unavailable"
- [ ] The page should **NOT crash** – it should show the error gracefully

### If API Keys ARE Configured

- [ ] Go to https://localhost:3000/chat (or /akior)
- [ ] Send a simple question: **"What time is it in Miami?"**
- [ ] **Expected:** Within a few seconds, you should get a normal text response
- [ ] The response should appear in the chat history
- [ ] The interface should remain responsive

**Expected Result:** Either graceful error handling OR successful AI response, depending on configuration.

---

## Local LLM Integration Test (v5.4.0 New Feature)

This tests the new Local LLM integration that allows AKIOR to use local models (Ollama or custom HTTP) instead of or alongside cloud GPT:

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

## ElevenLabs Text-to-Speech Integration Tests (v5.5.0 New Feature)

This tests the new ElevenLabs TTS integration that allows assistant messages to be spoken aloud with high-quality voices:

### Prerequisites (Optional)

If you want to test with real TTS audio:
1. Sign up for an ElevenLabs account at https://elevenlabs.io
2. Generate an API key from your dashboard
3. Copy a Voice ID from the ElevenLabs dashboard (e.g., Rachel voice)

**Skip the functional test if you don't have ElevenLabs credentials** – you can still test the UI configuration.

### Settings UI Test

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **ElevenLabs** card

2. **Check Initial State**
   - [ ] The card shows **"Not connected"** badge (gray)
   - [ ] The **Enable** checkbox is unchecked
   - [ ] **No "Coming soon" badge** should appear (that was v5.4.0)

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **API Key** field is visible (password-masked)
   - [ ] **Voice ID** field is visible
   - [ ] **Model ID** field is visible (with default placeholder text)
   - [ ] **Advanced Settings** collapsible section is visible

4. **Fill in Configuration** (if you have credentials)
   - [ ] API Key: Paste your ElevenLabs API key
   - [ ] Voice ID: Paste your Voice ID (e.g., `21m00Tcm4TlvDq8ikWAM`)
   - [ ] Model ID: Leave blank (or enter `eleven_multilingual_v2`)
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Advanced Settings**
   - [ ] Click **"Advanced Settings"** to expand
   - [ ] **Stability** field appears (number input 0-1)
   - [ ] **Similarity Boost** field appears (number input 0-1)
   - [ ] **Style** field appears (number input 0-1)
   - [ ] Enter values like `0.5`, `0.75`, `0.0` respectively

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → ElevenLabs
   - [ ] Verify **Enable** is still checked
   - [ ] Verify API Key field shows asterisks (password-masked)
   - [ ] Verify Voice ID is still filled
   - [ ] Verify status badge still shows "Connected" (if configured)
   - [ ] Expand Advanced Settings
   - [ ] Verify Stability, Similarity Boost, Style values persisted

**Expected Result:** Configuration persists across page refreshes.

### Backend Endpoint Test (Unconfigured)

1. **Test Unconfigured Endpoint** (before entering credentials)
   - [ ] Open Browser DevTools (F12) → Network tab
   - [ ] Manually test endpoint using Console tab:
     ```javascript
     fetch('https://localhost:3000/integrations/elevenlabs/tts', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ text: 'Test' })
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **503** with JSON `{ error: "elevenlabs_not_configured" }`
   - [ ] Page should **NOT crash**

### Chat UI Test (Visual)

1. **Test Button Visibility (Not Configured)**
   - [ ] Go to https://localhost:3000/chat
   - [ ] Send a message (any message)
   - [ ] Wait for assistant response
   - [ ] **Expected:** NO "🔊 Speak answer" button appears (because ElevenLabs is not configured)

2. **Test Button Visibility (Configured)** (skip if no credentials)
   - [ ] Configure ElevenLabs in Settings (steps above)
   - [ ] Verify status shows "Connected" (green)
   - [ ] Go to https://localhost:3000/chat
   - [ ] Send a message: **"Say hello in one sentence"**
   - [ ] Wait for assistant response
   - [ ] **Expected:** "🔊 Speak answer" button appears below the assistant message
   - [ ] Button has small text, rounded style, with speaker emoji

### Functional Test (Only if ElevenLabs is Configured)

**Skip this if you don't have ElevenLabs credentials.**

1. **Test TTS Playback**
   - [ ] In Chat, send a message: **"Explain quantum computing in one sentence"**
   - [ ] Wait for assistant response
   - [ ] Click **"🔊 Speak answer"** button
   - [ ] **Expected:** Audio plays immediately (assistant message spoken aloud)
   - [ ] Button changes to **"⏹ Stop"** while audio is playing
   - [ ] Other "Speak answer" buttons on other messages are **disabled/grayed out**
   - [ ] Audio finishes playing → button returns to "🔊 Speak answer"

2. **Test Stop Button**
   - [ ] Send another message and get response
   - [ ] Click **"🔊 Speak answer"**
   - [ ] While audio is playing, click **"⏹ Stop"**
   - [ ] **Expected:** Audio stops immediately
   - [ ] Button returns to "🔊 Speak answer"

3. **Test Multiple Messages**
   - [ ] Send 2-3 messages to get multiple assistant responses
   - [ ] Each response should have its own **"🔊 Speak answer"** button
   - [ ] Click button on the **second** message
   - [ ] **Expected:** Only that message is spoken
   - [ ] After audio finishes, click button on a **different** message
   - [ ] **Expected:** New audio plays correctly

4. **Test Error Handling (Bad API Key)** (optional destructive test)
   - [ ] Go to Settings → ElevenLabs
   - [ ] Change API Key to `sk-invalid123`
   - [ ] Go back to Chat
   - [ ] Try clicking "🔊 Speak answer"
   - [ ] **Expected:** Error message appears in chat UI (e.g., "TTS failed: 502")
   - [ ] Chat continues to work (no crash)
   - [ ] Restore correct API key after test

**Expected Result:** TTS plays audio correctly when configured; graceful error messages when misconfigured.

### Regression Test (Other Integrations)

1. **Verify Local LLM Still Works**
   - [ ] Go to Settings → Integrations → Local LLM
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

2. **Verify Web Search Still Works**
   - [ ] Go to Settings → Integrations → Web Search
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

3. **Verify Chat Still Works Without TTS**
   - [ ] Disable ElevenLabs in Settings (uncheck Enable)
   - [ ] Go to Chat
   - [ ] Send a message
   - [ ] **Expected:** Chat works normally, just no "Speak answer" button

**Expected Result:** ElevenLabs is purely additive; disabling it does not break existing features.

---

## Azure TTS Integration Tests (v5.6.0 New Feature)

This tests the new Azure TTS integration with multi-provider TTS architecture:

### Prerequisites (Optional)

If you want to test with real Azure TTS audio:
1. Sign up for Azure at https://portal.azure.com
2. Create a Speech resource and note the Region and API Key
3. Choose a voice from Azure's voice gallery (e.g., en-US-JennyNeural)

**Skip the functional test if you don't have Azure credentials** – you can still test the UI configuration.

### Settings UI Test – Azure TTS Card

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **Azure TTS** card

2. **Check Initial State**
   - [ ] The card shows **"Not connected"** badge (gray)
   - [ ] The **Enable** checkbox is unchecured
   - [ ] **No "Coming soon" badge** should appear (that was v5.5.0)

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **Region** field is visible
   - [ ] **API Key** field is visible (password-masked)
   - [ ] **Voice Name** field is visible
   - [ ] **Advanced Settings** collapsible section is visible

4. **Fill in Configuration** (if you have credentials)
   - [ ] Region: `eastus` (or your Azure region)
   - [ ] API Key: Paste your Azure Speech key
   - [ ] Voice Name: `en-US-JennyNeural` (or your chosen voice)
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Advanced Settings**
   - [ ] Click **"Advanced Settings"** to expand
   - [ ] **Style** field appears (text input)
   - [ ] **Rate** field appears (text input with hint "+0%")
   - [ ] **Pitch** field appears (text input with hint "+0st")
   - [ ] Enter optional values if desired

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → Azure TTS
   - [ ] Verify **Enable** is still checked
   - [ ] Verify Region, API Key (asterisks), and Voice Name persisted
   - [ ] Verify status badge still shows "Connected" (if configured)
   - [ ] Expand Advanced Settings and check persistence

**Expected Result:** Configuration persists across page refreshes.

### Settings UI Test – TTS Provider Selector

1. **Navigate to Text Chat Settings**
   - [ ] In Settings, scroll to the **Text chat** section
   - [ ] Find the **"Text-to-speech provider"** dropdown

2. **Check Provider Options**
   - [ ] Dropdown shows three options:
     - "None — no TTS button"
     - "ElevenLabs"
     - "Azure TTS"
   - [ ] Default selected is "ElevenLabs" (for backward compatibility)

3. **Switch Provider**
   - [ ] Select **"Azure TTS"** from dropdown
   - [ ] Press `F5` to refresh
   - [ ] Verify **"Azure TTS"** is still selected

4. **Switch to None**
   - [ ] Select **"None"** from dropdown
   - [ ] Press `F5` to refresh
   - [ ] Verify **"None"** is still selected

**Expected Result:** Provider selection persists across page refreshes.

### Backend Endpoint Test (Unconfigured)

1. **Test Unconfigured Endpoint** (before entering credentials)
   - [ ] Open Browser DevTools (F12) → Network tab
   - [ ] Manually test endpoint using Console tab:
     ```javascript
     fetch('https://localhost:3000/integrations/azure-tts/tts', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ text: 'Test' })
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **503** with JSON `{ error: "azure_tts_not_configured" }`
   - [ ] Page should **NOT crash**

### Chat UI Test (Provider Selection)

1. **Test with Provider = None**
   - [ ] In Settings, set TTS provider to **"None"**
   - [ ] Go to https://localhost:3000/chat
   - [ ] Send a message (any message)
   - [ ] Wait for assistant response
   - [ ] **Expected:** NO "🔊 Speak answer" button appears (TTS disabled)

2. **Test with Provider = ElevenLabs (Not Configured)**
   - [ ] In Settings, set TTS provider to **"ElevenLabs"**
   - [ ] Ensure ElevenLabs is NOT configured (disabled or missing key/voice)
   - [ ] Go to Chat and send a message
   - [ ] **Expected:** NO "🔊 Speak answer" button appears (provider not connected)

3. **Test with Provider = Azure TTS (Not Configured)**
   - [ ] In Settings, set TTS provider to **"Azure TTS"**
   - [ ] Ensure Azure TTS is NOT configured
   - [ ] Go to Chat and send a message
   - [ ] **Expected:** NO "🔊 Speak answer" button appears (provider not connected)

4. **Test with Provider = Azure TTS (Configured)** (skip if no credentials)
   - [ ] Configure Azure TTS in Settings (Region, API Key, Voice Name)
   - [ ] Verify status shows "Connected" (green)
   - [ ] Set TTS provider to **"Azure TTS"**
   - [ ] Go to https://localhost:3000/chat
   - [ ] Send a message: **"Say hello in one sentence"**
   - [ ] Wait for assistant response
   - [ ] **Expected:** "🔊 Speak answer" button appears below the assistant message

### Functional Test (Only if Azure TTS is Configured)

**Skip this if you don't have Azure credentials.**

1. **Test Azure TTS Playback**
   - [ ] In Chat (with Azure configured and selected), send: **"Explain quantum computing in one sentence"**
   - [ ] Wait for assistant response
   - [ ] Click **"🔊 Speak answer"** button
   - [ ] **Expected:** Audio plays immediately (Azure-synthesized voice)
   - [ ] Button changes to **"⏹ Stop"** while audio is playing
   - [ ] Other "Speak answer" buttons on other messages are **disabled/grayed out**
   - [ ] Audio finishes playing → button returns to "🔊 Speak answer"

2. **Test Stop Button**
   - [ ] Send another message and get response
   - [ ] Click **"🔊 Speak answer"**
   - [ ] While audio is playing, click **"⏹ Stop"**
   - [ ] **Expected:** Audio stops immediately
   - [ ] Button returns to "🔊 Speak answer"

3. **Test Provider Switching**
   - [ ] With both ElevenLabs and Azure configured
   - [ ] Set provider to **"ElevenLabs"** in Settings
   - [ ] Send message in Chat, click "Speak answer"
   - [ ] **Expected:** ElevenLabs voice plays
   - [ ] Switch provider to **"Azure TTS"** in Settings
   - [ ] Send another message, click "Speak answer"
   - [ ] **Expected:** Azure voice plays (different from ElevenLabs)

4. **Test Error Handling (Bad API Key)** (optional destructive test)
   - [ ] Go to Settings → Azure TTS
   - [ ] Change API Key to invalid value (e.g., `invalid-key-123`)
   - [ ] Go back to Chat
   - [ ] Try clicking "🔊 Speak answer"
   - [ ] **Expected:** Error message appears in chat UI (e.g., "TTS failed: 502")
   - [ ] Chat continues to work (no crash)
   - [ ] Restore correct API key after test

**Expected Result:** Azure TTS plays audio correctly when configured; graceful error messages when misconfigured.

### Regression Test (Other Integrations)

1. **Verify ElevenLabs Still Works**
   - [ ] Go to Settings → Integrations → ElevenLabs
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Set TTS provider to "ElevenLabs"
   - [ ] Verify "Speak answer" button works with ElevenLabs voice

2. **Verify Local LLM Still Works**
   - [ ] Go to Settings → Integrations → Local LLM
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

3. **Verify Web Search Still Works**
   - [ ] Go to Settings → Integrations → Web Search
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

4. **Verify Chat Works Without TTS**
   - [ ] Set TTS provider to "None"
   - [ ] Go to Chat
   - [ ] Send a message
   - [ ] **Expected:** Chat works normally, just no "Speak answer" button

**Expected Result:** Azure TTS is purely additive; all previous features work unchanged.

---

## Spotify Integration Tests (v5.7.0 New Feature)

This tests the new Spotify integration using Client Credentials Flow for backend track search:

### Prerequisites (Optional)

If you want to test with real Spotify API:
1. Sign up for Spotify Developer at https://developer.spotify.com/dashboard
2. Create an app and note the Client ID and Client Secret
3. **Note:** Client Credentials Flow does NOT require user login (perfect for backend search)

**Skip the functional test if you don't have Spotify credentials** – you can still test the UI configuration.

### Settings UI Test – Spotify Card

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **Spotify** card

2. **Check Initial State**
   - [ ] The card shows **"Not connected"** badge (gray)
   - [ ] The **Enable** checkbox is unchecked
   - [ ] **No "Coming soon" badge** should appear (that was removed in v5.7.0)

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **Client ID** field is visible (text input)
   - [ ] **Client Secret** field is visible (password-masked)
   - [ ] **Default Market (optional)** field is visible

4. **Fill in Configuration** (if you have credentials)
   - [ ] Client ID: Paste your Spotify app's Client ID
   - [ ] Client Secret: Paste your Spotify app's Client Secret
   - [ ] Default Market: `US` (or leave blank, defaults to US)
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Without Credentials** (default state)
   - [ ] Leave fields empty or enter dummy values
   - [ ] Status badge remains **"Not connected"** (gray)
   - [ ] No crashes or errors

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → Spotify
   - [ ] Verify **Enable** is still checked (if you enabled it)
   - [ ] Verify Client ID, Client Secret (asterisks), and Default Market persisted
   - [ ] Verify status badge still shows "Connected" (if configured with real credentials)

**Expected Result:** Configuration persists across page refreshes.

### Backend Endpoint Test (Unconfigured)

1. **Test Unconfigured Endpoint** (before entering credentials)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Manually test endpoint using Console:
     ```javascript
     fetch('https://localhost:3000/api/integrations/spotify/search', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query: 'test' })
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **503** with JSON:
     ```json
     { "ok": false, "error": "spotify_not_configured" }
     ```
   - [ ] Page should **NOT crash**

### Functional Test (Only if Spotify is Configured)

**Skip this if you don't have Spotify Developer credentials.**

1. **Test Track Search**
   - [ ] Configure Spotify in Settings (Client ID, Client Secret, optional Market)
   - [ ] Verify status shows "Connected" (green)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Test search with valid query:
     ```javascript
     fetch('https://localhost:3000/api/integrations/spotify/search', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query: 'never gonna give you up', limit: 5 })
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **200** with JSON:
     ```json
     {
       "ok": true,
       "results": [
         {
           "id": "...",
           "name": "Never Gonna Give You Up",
           "artists": ["Rick Astley"],
           "album": "...",
           "duration_ms": 213573,
           "preview_url": "...",
           "external_url": "https://open.spotify.com/track/..."
         }
       ]
     }
     ```
   - [ ] Verify results contain track metadata (name, artists, album, etc.)

2. **Test Empty Query Error**
   - [ ] Test with empty query:
     ```javascript
     fetch('https://localhost:3000/api/integrations/spotify/search', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query: '' })
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **400** with error

3. **Test Error Handling (Bad Credentials)** (optional destructive test)
   - [ ] Go to Settings → Spotify
   - [ ] Change Client Secret to invalid value (e.g., `invalid-secret-123`)
   - [ ] Try search request from Console
   - [ ] **Expected:** Status **502** with error message
   - [ ] Page continues to work (no crash)
   - [ ] Restore correct Client Secret after test

**Expected Result:** Spotify search returns track metadata when configured; graceful error messages when misconfigured.

### Current Limitations (v5.7.0)

1. **No Chat UI** (documented behavior)
   - [ ] Go to https://localhost:3000/chat
   - [ ] **Expected:** No Spotify search buttons or music controls visible (backend-only in v5.7.0)
   - [ ] Chat works normally for text conversations

2. **Backend Search Only**
   - [ ] Spotify integration is currently API-only
   - [ ] User-facing music search/playback UI will come in future versions (v5.7.x or v5.8.0)

**Expected Result:** Spotify is backend-only in v5.7.0; no user-facing music UI yet.

### Regression Test (Other Integrations)

1. **Verify Azure TTS Still Works**
   - [ ] Go to Settings → Integrations → Azure TTS
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

2. **Verify ElevenLabs Still Works**
   - [ ] Go to Settings → Integrations → ElevenLabs
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

3. **Verify Local LLM Still Works**
   - [ ] Go to Settings → Integrations → Local LLM
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

4. **Verify Web Search Still Works**
   - [ ] Go to Settings → Integrations → Web Search
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

5. **Verify Chat Works Without Spotify**
   - [ ] Disable Spotify (or leave unconfigured)
   - [ ] Go to Chat
   - [ ] Send a message
   - [ ] **Expected:** Chat works normally (Spotify is purely additive)

**Expected Result:** Spotify is purely additive; all previous features work unchanged.

---

## Gmail Integration Tests (v5.8.0 New Feature)

This tests the new Gmail integration skeleton with OAuth2 refresh token backend:

### Prerequisites (Optional)

If you want to test with real Gmail API:
1. Create OAuth2 Client in Google Cloud Console
2. Enable Gmail API for your project
3. Obtain refresh token via OAuth2 Playground or custom script
4. **Note:** OAuth2 wizard UI is NOT implemented; manual token entry required

**Skip the functional test if you don't have Gmail credentials** – you can still test the UI configuration.

### Settings UI Test – Gmail Card

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **Gmail** card

2. **Check Initial State**
   - [ ] The card shows **"Not connected"** badge (gray)
   - [ ] The **Enable** checkbox is unchecked
   - [ ] **No "Coming soon" badge** should appear (that was removed in v5.8.0)

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **Client ID** field is visible (text input)
   - [ ] **Client Secret** field is visible (password-masked)
   - [ ] **Redirect URI** field is visible (text input, optional)
   - [ ] **User Email** field is visible (text input)
   - [ ] **Refresh Token** field is visible (password-masked)

4. **Fill in Configuration** (if you have credentials)
   - [ ] Client ID: Paste your Google OAuth2 Client ID
   - [ ] Client Secret: Paste your Client Secret
   - [ ] Redirect URI: Enter if needed (optional)
   - [ ] User Email: Enter Gmail account (e.g., `yourname@gmail.com`)
   - [ ] Refresh Token: Paste refresh token from OAuth flow
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Without Credentials** (default state)
   - [ ] Leave fields empty or enter dummy values
   - [ ] Status badge remains **"Not connected"** (gray)
   - [ ] No crashes or errors

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → Gmail
   - [ ] Verify **Enable** is still checked (if you enabled it)
   - [ ] Verify Client ID, Client Secret (asterisks), Redirect URI, Email, Token persisted
   - [ ] Verify status badge still shows "Connected" (if configured with real credentials)

**Expected Result:** Configuration persists across page refreshes.

### Backend Endpoint Test (Unconfigured)

1. **Test Unconfigured Endpoint** (before entering credentials)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Manually test endpoint using Console:
     ```javascript
     fetch('https://localhost:3000/api/integrations/gmail/test', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({})
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **503** with JSON:
     ```json
     { "ok": false, "error": "gmail_not_configured" }
     ```
   - [ ] Page should **NOT crash**

### Functional Test (Only if Gmail is Configured)

**Skip this if you don't have Gmail OAuth2 credentials.**

1. **Test Connection**
   - [ ] Configure Gmail in Settings (Client ID, Secret, Email, Token)
   - [ ] Verify status shows "Connected" (green)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Test connection:
     ```javascript
     fetch('https://localhost:3000/api/integrations/gmail/test', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({})
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **200** with JSON:
     ```json
     {
       "ok": true,
       "messageCount": 5,
       "messages": [
         {
           "id": "...",
           "threadId": "...",
           "snippet": "...",
           "subject": "...",
           "from": "...",
           "date": "..."
         }
       ]
     }
     ```
   - [ ] Verify messages contain subject, from, date fields

2. **Test Error Handling (Bad Token)** (optional destructive test)
   - [ ] Go to Settings → Gmail
   - [ ] Change Refresh Token to invalid value (e.g., `invalid-token-123`)
   - [ ] Try connection test from Console
   - [ ] **Expected:** Status **502** with error (e.g., `token_exchange_failed`)
   - [ ] Page continues to work (no crash)
   - [ ] Restore correct token after test

**Expected Result:** Gmail test endpoint returns message summaries when configured; graceful errors when misconfigured.

### Current Limitations (v5.8.0)

1. **No OAuth Wizard** (documented behavior)
   - [ ] No "Connect with Google" button in Settings
   - [ ] User must manually obtain refresh token via external tools

2. **No Inbox UI** (documented behavior)
   - [ ] Go to https://localhost:3000/chat
   - [ ] **Expected:** No Gmail inbox, email reader, or message UI visible (backend-only in v5.8.0)
   - [ ] Chat works normally for text conversations

3. **Backend Test Only**
   - [ ] Gmail integration is currently API-only
   - [ ] User-facing email management UI will come in future versions (v5.8.x or v5.9.0)

**Expected Result:** Gmail is backend skeleton only in v5.8.0; no user-facing email UI yet.

### Regression Test (Other Integrations)

1. **Verify Spotify Still Works**
   - [ ] Go to Settings → Integrations → Spotify
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

2. **Verify Azure TTS Still Works**
   - [ ] Go to Settings → Integrations → Azure TTS
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

3. **Verify ElevenLabs Still Works**
   - [ ] Go to Settings → Integrations → ElevenLabs
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works

4. **Verify Local LLM Still Works**
   - [ ] Go to Settings → Integrations → Local LLM
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

5. **Verify Web Search Still Works**
   - [ ] Go to Settings → Integrations → Web Search
   - [ ] Verify configuration is still present
   - [ ] Verify connection status badge still works

6. **Verify Chat Works Without Gmail**
   - [ ] Disable Gmail (or leave unconfigured)
   - [ ] Go to Chat
   - [ ] Send a message
   - [ ] **Expected:** Chat works normally (Gmail is purely additive)

**Expected Result:** Gmail is purely additive; all previous features work unchanged.

---

## Google Calendar Integration Tests (v5.9.0 New Feature)

This tests the new Google Calendar integration skeleton with OAuth2 refresh token backend:

### Prerequisites (Optional)

If you want to test with real Google Calendar API:
1. Create OAuth2 Client in Google Cloud Console
2. Enable Google Calendar API for your project
3. Obtain refresh token via OAuth2 Playground or custom script
4. **Note:** OAuth2 wizard UI is NOT implemented; manual token entry required

**Skip the functional test if you don't have Google Calendar credentials** – you can still test the UI configuration.

### Settings UI Test – Google Calendar Card

1. **Navigate to Settings → Integrations**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Scroll to the **Integrations** section
   - [ ] Find the **Google Calendar** card

2. **Check Initial State**
   - [ ] The card shows **"Not connected"** badge (gray)
   - [ ] The **Enable** checkbox is unchecked
   - [ ] **No "Coming soon" badge** should appear (that was removed in v5.9.0)

3. **Enable and Configure**
   - [ ] Check the **Enable** checkbox
   - [ ] Configuration fields appear below
   - [ ] **Client ID** field is visible (text input)
   - [ ] **Client Secret** field is visible (password-masked)
   - [ ] **Redirect URI** field is visible (text input, optional)
   - [ ] **Calendar ID** field is visible (text input, placeholder: "primary")
   - [ ] **Refresh Token** field is visible (password-masked)

4. **Fill in Configuration** (if you have credentials)
   - [ ] Client ID: Paste your Google OAuth2 Client ID
   - [ ] Client Secret: Paste your Client Secret
   - [ ] Redirect URI: Enter if needed (optional)
   - [ ] Calendar ID: Enter "primary" or specific calendar ID
   - [ ] Refresh Token: Paste refresh token from OAuth flow
   - [ ] The status badge changes to **"Connected"** (green)

5. **Test Without Credentials** (default state)
   - [ ] Leave fields empty or enter dummy values
   - [ ] Status badge remains **"Not connected"** (gray)
   - [ ] No crashes or errors

6. **Refresh and Verify Persistence**
   - [ ] Press `F5` to refresh the page
   - [ ] Go back to Settings → Integrations → Google Calendar
   - [ ] Verify **Enable** is still checked (if you enabled it)
   - [ ] Verify Client ID, Client Secret (asterisks), Redirect URI, Calendar ID, Token persisted
   - [ ] Verify status badge still shows "Connected" (if configured with real credentials)

**Expected Result:** Configuration persists across page refreshes.

### Backend Endpoint Test (Unconfigured)

1. **Test Unconfigured Endpoint** (before entering credentials)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Manually test endpoint using Console:
     ```javascript
     fetch('https://localhost:3000/api/integrations/google-calendar/test', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({})
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **503** with JSON:
     ```json
     { "ok": false, "error": "google_calendar_not_configured" }
     ```
   - [ ] Page should **NOT crash**

### Functional Test (Only if Google Calendar is Configured)

**Skip this if you don't have Google Calendar OAuth2 credentials.**

1. **Test Connection**
   - [ ] Configure Google Calendar in Settings (Client ID, Secret, Calendar ID, Token)
   - [ ] Verify status shows "Connected" (green)
   - [ ] Open Browser DevTools (F12) → Console tab
   - [ ] Test connection:
     ```javascript
     fetch('https://localhost:3000/api/integrations/google-calendar/test', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({})
     }).then(r => r.json()).then(console.log)
     ```
   - [ ] **Expected Response:** Status **200** with JSON:
     ```json
     {
       "ok": true,
       "events": [
         {
           "id": "...",
           "summary": "...",
           "start": "2025-12-07T14:00:00Z",
           "end": "2025-12-07T15:00:00Z"
         }
       ]
     }
     ```
   - [ ] Verify events contain summary, start, end ISO date strings

2. **Test Error Handling (Bad Token)** (optional destructive test)
   - [ ] Go to Settings → Google Calendar
   - [ ] Change Refresh Token to invalid value (e.g., `invalid-token-123`)
   - [ ] Try connection test from Console
   - [ ] **Expected:** Status **502** with error (e.g., `token_exchange_failed`)
   - [ ] Page continues to work (no crash)
   - [ ] Restore correct token after test

**Expected Result:** Google Calendar test endpoint returns event summaries when configured; graceful errors when misconfigured.

### Current Limitations (v5.9.0)

1. **No OAuth Wizard** (documented behavior)
   - [ ] No "Connect with Google" button in Settings
   - [ ] User must manually obtain refresh token via external tools

2. **No Calendar UI** (documented behavior)
   - [ ] **Expected:** No `/calendar` route, no event list, no calendar grid visible (backend-only in v5.9.0)
   - [ ] Future versions will add calendar UI

3. **Backend Test Only**
   - [ ] Google Calendar integration is currently API-only
   - [ ] User-facing calendar management UI will come in future versions (v5.9.x or v5.10.0)

**Expected Result:** Google Calendar is backend skeleton only in v5.9.0; no user-facing calendar UI yet.

### Regression Test (Gmail Still Works)

1. **Verify Gmail Still Works**
   - [ ] Go to Settings → Integrations → Gmail
   - [ ] Verify configuration is still present (if you had it configured)
   - [ ] Verify connection status badge still works
   - [ ] Gmail test endpoint still returns expected responses

**Expected Result:** Google Calendar is purely additive; Gmail and all other integrations work unchanged.

---

## Notification System Tests (V6.0.0 New Feature)

This tests the new notification system with event scheduler, REST API, and real-time toast UI:

### Prerequisites

**No special setup required** – the notification system is built-in and auto-initializes on server startup.

### Visual Toast Test (Manual)

1. **Navigate to any AKIOR page**
   - [ ] Go to https://localhost:3000/akior (or /chat, /holomat, etc.)
   - [ ] Page loads normally

2. **Schedule a Test Notification**
   - [ ] Open a **new PowerShell window** (keep AKIOR running)
   - [ ] Run this command to schedule a notification for 10 seconds from now:
     ```powershell
     $body = @{
       type = "system_update"
       payload = @{
         message = "V6.0.0 notification test!"
       }
       triggerAt = (Get-Date).AddSeconds(10).ToString("o")
     } | ConvertTo-Json
     
     Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" -Body $body -ContentType "application/json" -SkipCertificateCheck
     ```
   - [ ] **Expected:** Command returns JSON with `ok: true` and an `eventId`

3. **Watch for Toast Notification**
   - [ ] Keep AKIOR page open and visible
   - [ ] **After 10 seconds**: A toast notification slides in from the **top-right** corner
   - [ ] Toast shows:
     - System update icon (⚙️)
     - Title: "System Update"
     - Message: "V6.0.0 notification test!"
   - [ ] Toast has a colored background and dismiss button (X)

4. **Test Auto-Dismiss**
   - [ ] Do NOT click the dismiss button
   - [ ] **After 10 seconds**: Toast automatically fades out and disappears

5. **Test Manual Dismiss**
   - [ ] Schedule another notification (run the PowerShell command again)
   - [ ] Wait for toast to appear
   - [ ] **Click the X button** in the top-right of the toast
   - [ ] **Expected:** Toast immediately disappears

6. **Test Multiple Notifications**
   - [ ] Schedule THREE notifications with 5-second delays:
     ```powershell
     # Notification 1 (5 seconds)
     $body1 = @{ type = "email_notification"; payload = @{ message = "First notification" }; triggerAt = (Get-Date).AddSeconds(5).ToString("o") } | ConvertTo-Json
     Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" -Body $body1 -ContentType "application/json" -SkipCertificateCheck
     
     # Notification 2 (6 seconds)
     $body2 = @{ type = "calendar_reminder"; payload = @{ message = "Second notification" }; triggerAt = (Get-Date).AddSeconds(6).ToString("o") } | ConvertTo-Json
     Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" -Body $body2 -ContentType "application/json" -SkipCertificateCheck
     
     # Notification 3 (7 seconds)
     $body3 = @{ type = "printer_alert"; payload = @{ message = "Third notification" }; triggerAt = (Get-Date).AddSeconds(7).ToString("o") } | ConvertTo-Json
     Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" -Body $body3 -ContentType "application/json" -SkipCertificateCheck
     ```
   - [ ] **Expected:** Three toasts appear **stacked vertically** in the top-right
   - [ ] Each has a different icon (📧, 📅, 🖨️)
   - [ ] All three auto-dismiss independently after their own 10-second timers

### Backend API Test (PowerShell)

1. **Test Invalid Payload (Missing Field)**
   - [ ] Run this command (missing `triggerAt`):
     ```powershell
     $bad = @{ type = "test"; payload = @{} } | ConvertTo-Json
     Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" -Body $bad -ContentType "application/json" -SkipCertificateCheck
     ```
   - [ ] **Expected:** Error response with status 400

2. **Test Notification History**
   - [ ] Run this command:
     ```powershell
     Invoke-RestMethod -Method Get -Uri "https://localhost:3000/api/notifications/history?limit=5" -SkipCertificateCheck
     ```
   - [ ] **Expected:** JSON with `notifications` array containing previously fired notifications
   - [ ] Each notification has `id`, `type`, `payload`, `fired: true`, `firedAt` timestamp

### Notification Preferences Test

1. **Navigate to Settings**
   - [ ] Go to https://localhost:3000/settings
   - [ ] Look for **"Notification Preferences"** section (may be under a "Notifications" heading)

2. **Check Preference Toggles**
   - [ ] Toggles/checkboxes for notification types should be visible:
     - Calendar reminder
     - Email notification
     - Printer alert
     - Camera alert
     - System update
     - Integration error
     - Custom
   - [ ] **All should be checked by default**

3. **Test Filtering (Optional Advanced Test)**
   - [ ] **Uncheck** "System update" preference
   - [ ] Save settings (if there's a save button)
   - [ ] Schedule a `system_update` notification
   - [ ] **Expected:** Toast should NOT appear (filtered by preference)
   - [ ] **Re-check** "System update" to restore normal behavior

### CI Smoke Test (Already Implemented)

**Note:** The notification smoke tests are already integrated into CI. When you run `npm run ci:smoke`, these tests automatically run:

1. **Schedule endpoint test**: POST to `/api/notifications/schedule` with future timestamp
2. **SSE stream test**: GET to `/api/notifications/stream` to verify connection

**You don't need to manually test these** – they're part of the automated CI pipeline.

### Expected Result

- [ ] Toasts appear exactly when scheduled (within 1 second accuracy)
- [ ] Toasts slide in smoothly from top-right
- [ ] Each notification type has a distinctive icon and color
- [ ] Auto-dismiss works after 10 seconds
- [ ] Manual dismiss (X button) works immediately
- [ ] Multiple toasts stack vertically without overlap
- [ ] Backend API returns proper errors for invalid requests
- [ ] Notification history endpoint returns fired events
- [ ] User preferences filter notifications correctly

**Expected Result:** Notification system is fully functional and user-facing.

---

## Notification Drawer & History UI Tests (V6.1.0 New Feature)

This tests the new notification drawer UI, bell icon with badge, and read/unread tracking:

### Prerequisites

**No special setup required** – the drawer is automatically available on all pages.

### Bell Icon & Badge Test

1. **Verify Bell Icon Appears**
   - [ ] Open any AKIOR page (https://localhost:3000/akior or /chat)
   - [ ] Look for a **bell icon** in the **top-right corner** of the page
   - [ ] Bell icon should be visible and styled in gray/white
   - [ ] Hover over the bell icon – it should change to white

2. **Test Badge with Unread Notifications**
   - [ ] Schedule a test notification (use PowerShell command from v6.0.0 section above)
   - [ ] Wait for notification to fire (toast appears)
   - [ ] **Check bell icon** – a **red badge** with count "1" should appear on the icon
   - [ ] Schedule another notification
   - [ ] Badge should update to "2"

3. **Test Badge Maximum Display**
   - [ ] Schedule 10+ notifications with 1-second intervals
   - [ ] **Expected:** Badge shows "9+" when 10 or more unread notifications exist

### Drawer Opening & Closing Test

1. **Open Drawer**
   - [ ] Click the bell icon
   - [ ] A **drawer panel slides in from the right side** of the screen
   - [ ] Drawer has:
     - Header: "Notifications" with count (e.g., "Notifications (2)")
     - Close button (X) in header
     - Action buttons: "Mark all as read", "Clear all"
     - List of notifications below

2. **Close Drawer (Multiple Methods)**
   - [ ] Click the **X button** in header – drawer slides out and closes
   - [ ] Reopen drawer, click the **dark backdrop** behind the drawer – drawer closes
   - [ ] Reopen drawer, press **Escape key** – drawer closes

3. **Drawer Responsiveness**
   - [ ] On desktop: Drawer is 480px wide from right edge
   - [ ] On mobile/small screen: Drawer is full-screen width
   - [ ] Animation is smooth (0.3s slide-in)

### Notification List Display Test

1. **Verify Notification Items**
   - [ ] Open drawer with 2-3 notifications
   - [ ] Each notification shows:
     - Type icon (📅, 🖨️, 📹, ⚙️, etc.)
     - Title (formatted from type, e.g., "System Update")
     - Message/payload text (truncated if long)
     - Relative timestamp ("2m ago", "Just now", "3d ago")
     - Blue dot indicator for unread notifications

2. **Verify Sort Order**
   - [ ] Notifications are displayed **newest first**
   - [ ] Most recent notification is at the top

3. **Test Empty State**
   - [ ] Clear all notifications (see section below)
   - [ ] Drawer shows empty state:
     - Large bell icon (🔔)
     - Message: "No notifications"
     - Subtext: "Notifications will appear here when they arrive"

### Read/Unread Tracking Test

1. **Mark Single Notification as Read**
   - [ ] Open drawer with unread notifications (blue dots visible)
   - [ ] **Click on an unread notification**
   - [ ] **Expected:**
     - Blue dot disappears
     - Notification text becomes slightly grayed out
     - Badge count decreases by 1
   - [ ] Click on the same notification again – nothing changes (already read)

2. **Mark All as Read**
   - [ ] Open drawer with multiple unread notifications
   - [ ] Click **"Mark all as read"** button
   - [ ] **Expected:**
     - All blue dots disappear
     - All notification text becomes grayed out
     - Bell badge disappears (count = 0)

3. **Clear All Notifications**
   - [ ] Open drawer with notifications
   - [ ] Click **"Clear all"** button
   - [ ] **Expected:**
     - Drawer shows empty state
     - All notifications removed from drawer
     - Bell badge disappears
   - [ ] **Note:** This does NOT delete server history (test history loading below)

### History Loading Test

1. **Test Initial History Load**
   - [ ] Schedule 3-5 notifications and wait for them to fire
   - [ ] **Refresh the page** (F5) to clear client state
   - [ ] Open the drawer for the **first time**
   - [ ] **Expected:**
     - Drawer loads notification history from server
     - Past notifications appear in the list (may take 1-2 seconds)
     - History notifications are marked as **read** (no blue dots, grayed text)

2. **Test History Caching**
   - [ ] Close the drawer
   - [ ] Reopen the drawer
   - [ ] **Expected:**
     - History is NOT fetched again (already cached)
     - Same notifications appear instantly

3. **Test Live + History Merge**
   - [ ] With drawer open showing history
   - [ ] Schedule a new notification (should fire immediately)
   - [ ] **Expected:**
     - New notification appears at the **top** of the list (prepended)
     - New notification is marked as **unread** (blue dot)
     - Badge updates to show unread count
     - Both toast and drawer update simultaneously

### Drawer + Toast Interaction Test

1. **Test Independent Behavior**
   - [ ] Open drawer
   - [ ] Schedule a notification
   - [ ] **Expected:**
     - Toast appears in **top-right** (separate from drawer)
     - Notification also appears in drawer list
     - Toast auto-dismisses after 10 seconds
     - Notification **stays** in drawer (does not disappear)

2. **Test Badge Update Flow**
   - [ ] Start with zero notifications
   - [ ] Schedule 3 notifications with 2-second delays
   - [ ] Watch the **badge count**:
     - [ ] Badge appears with "1" when first notification fires
     - [ ] Badge updates to "2" when second fires
     - [ ] Badge updates to "3" when third fires
   - [ ] Open drawer and click "Mark all as read"
   - [ ] Badge disappears

### Accessibility & Keyboard Test

1. **Test Keyboard Navigation**
   - [ ] Press **Tab** key multiple times to focus the bell icon
   - [ ] Press **Enter** or **Space** key
   - [ ] **Expected:** Drawer opens
   - [ ] Press **Escape** key
   - [ ] **Expected:** Drawer closes

2. **Test ARIA Labels**
   - [ ] Right-click bell icon → Inspect
   - [ ] Verify `aria-label="Open notifications"` exists
   - [ ] When drawer is open, verify `aria-expanded="true"`
   - [ ] When drawer is closed, verify `aria-expanded="false"`

### Theme Consistency Test

1. **Test Dark Mode Styling**
   - [ ] Open drawer in dark mode (default)
   - [ ] Verify:
     - Dark background (`#0b0f14`)
     - White text with opacity variants
     - Glassmorphism backdrop blur
     - Border is white/10 opacity

2. **Test Different Accent Colors**
   - [ ] Go to Settings → Appearance
   - [ ] Switch to different theme (Midnight Purple, Solar Flare, etc.)
   - [ ] Open notification drawer
   - [ ] **Expected:** Drawer styling adapts to current theme accent color

### Performance Test

1. **Test with Many Notifications**
   - [ ] Schedule 50+ notifications with 0.5-second intervals
   - [ ] Let them all fire
   - [ ] Open drawer
   - [ ] **Expected:**
     - Drawer opens smoothly (no lag)
     - Scrolling is smooth
     - No browser console errors
     - All 50+ notifications are visible in the list

### Expected Result Summary

- [ ] Bell icon is visible and responsive on all pages
- [ ] Badge shows unread count (1-9, "9+" for 10+)
- [ ] Drawer slides in/out smoothly with animation
- [ ] Drawer can be closed with X button, backdrop click, or Escape key
- [ ] Notifications display with icons, titles, messages, and timestamps
- [ ] Notifications are sorted newest-first
- [ ] Unread notifications show blue dot indicator
- [ ] Clicking unread notification marks it as read
- [ ] "Mark all as read" button updates all notifications and clears badge
- [ ] "Clear all" button removes all notifications from drawer (client-side only)
- [ ] History loads on first drawer open (limit 50 notifications)
- [ ] History notifications are marked as read by default
- [ ] Live notifications merge with history without duplicates
- [ ] Toast and drawer update independently
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] ARIA labels are present for accessibility
- [ ] Drawer styling is theme-aware and consistent

**Expected Result:** Notification drawer provides complete UI experience for managing and reviewing notifications.

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
- [ ] Chat/AKIOR either works with AI OR shows clear error message
- [ ] Local LLM integration UI works and persists configuration
- [ ] ElevenLabs TTS integration UI works and persists configuration
- [ ] Azure TTS integration UI works and persists configuration
- [ ] TTS provider selector works and persists selection
- [ ] "Speak answer" button appears/disappears based on selected provider and connection status
- [ ] Backend API returns 200 status codes for key endpoints
- [ ] Spotify integration UI works and persists configuration
- [ ] Spotify search endpoint returns 503 when unconfigured (expected behavior)
- [ ] Gmail integration UI works and persists configuration
- [ ] Gmail test endpoint returns 503 when unconfigured (expected behavior)
- [ ] Gmail integration UI works and persists configuration
- [ ] Gmail test endpoint returns 503 when unconfigured (expected behavior)
- [ ] Google Calendar integration UI works and persists configuration  
- [ ] Google Calendar test endpoint returns 503 when unconfigured (expected behavior)
- [ ] Smoke tests: 13/13 checks pass (5 pages + 8 APIs including Spotify, Gmail, and Google Calendar)

If all checkboxes are marked and no major issues were found, **v5.9.0 is ready for deployment!**

---

**End of Test Plan**

Thank you for taking the time to test AKIOR V5 OS. Your feedback helps ensure a stable, production-ready system.
