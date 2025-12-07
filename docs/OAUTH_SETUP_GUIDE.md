# OAuth Setup Guide: Gmail & Google Calendar Integration

Complete guide for configuring Google OAuth2 integrations in J.A.R.V.I.S.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Google Cloud Project Setup](#google-cloud-project-setup)
4. [OAuth2 Credentials Configuration](#oauth2-credentials-configuration)
5. [Obtaining Refresh Tokens](#obtaining-refresh-tokens)
6. [J.A.R.V.I.S. Configuration](#jarvis-configuration)
7. [Testing Your Integration](#testing-your-integration)
8. [Token Management](#token-management)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

---

## Overview

J.A.R.V.I.S. integrates with Gmail and Google Calendar using **OAuth2 Refresh Token flow**. This guide walks you through:

- Creating a Google Cloud project
- Generating OAuth2 credentials
- Obtaining refresh tokens
- Configuring J.A.R.V.I.S. with your credentials

**Estimated Time:** 30-45 minutes

---

## Prerequisites

Before starting, ensure you have:

- ✅ A Google account with Gmail and Google Calendar enabled
- ✅ Access to [Google Cloud Console](https://console.cloud.google.com/)
- ✅ J.A.R.V.I.S. server running locally
- ✅ Node.js 18+ installed
- ✅ Administrator access to your J.A.R.V.I.S. installation

---

## Google Cloud Project Setup

### Step 1: Create a New Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top left) → **New Project**
3. Enter project details:
   - **Project Name:** `J.A.R.V.I.S. Integration` (or any name)
   - **Organization:** Leave as default (if personal account)
4. Click **Create** and wait for project creation

### Step 2: Enable Required APIs

1. In the project dashboard, navigate to **APIs & Services** → **Library**
2. Search for and enable the following APIs:

   **Gmail API:**
   - Search: `Gmail API`
   - Click on the result
   - Click **Enable**

   **Google Calendar API:**
   - Search: `Google Calendar API`
   - Click on the result
   - Click **Enable**

3. Wait for APIs to be enabled (usually takes a few seconds)

---

## OAuth2 Credentials Configuration

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **User Type:**
   - Select **External** (for personal use)
   - Click **Create**

3. Fill in the **App Information:**
   - **App name:** `J.A.R.V.I.S.`
   - **User support email:** Your email address
   - **Developer contact email:** Your email address
   - Click **Save and Continue**

4. **Scopes Configuration:**
   - Click **Add or Remove Scopes**
   - Search and select the following scopes:
     - `https://www.googleapis.com/auth/gmail.readonly` (Read Gmail)
     - `https://www.googleapis.com/auth/gmail.send` (Send Gmail)
     - `https://www.googleapis.com/auth/gmail.modify` (Modify Gmail)
     - `https://www.googleapis.com/auth/calendar.readonly` (Read Calendar)
     - `https://www.googleapis.com/auth/calendar.events` (Manage Calendar Events)
   - Click **Update** → **Save and Continue**

5. **Test Users:**
   - Click **Add Users**
   - Enter your Gmail address
   - Click **Add** → **Save and Continue**

6. Review and click **Back to Dashboard**

### Step 4: Create OAuth2 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Configure the OAuth client:
   - **Application type:** Desktop app
   - **Name:** `J.A.R.V.I.S. Desktop Client`
4. Click **Create**
5. A dialog appears with your credentials:
   - **Client ID:** `xxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret:** `xxxxx-xxxxxxxxx`
6. Click **Download JSON** (save this file securely)
7. Click **OK**

---

## Obtaining Refresh Tokens

### Step 5: Generate OAuth2 Refresh Token

**Option A: Using OAuth2 Playground (Recommended)**

1. Visit [Google OAuth2 Playground](https://developers.google.com/oauthplayground/)
2. Click the **Settings** icon (top right gear icon)
3. Check **"Use your own OAuth credentials"**
4. Enter your **Client ID** and **Client Secret** from Step 4
5. Close settings

6. **Select & Authorize APIs:**
   - In the left sidebar, expand **Gmail API v1**
   - Select:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Expand **Google Calendar API v3**
   - Select:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
   - Click **Authorize APIs**

7. **Sign in with Google:**
   - Choose the Google account you added as a test user
   - Click **Advanced** → **Go to J.A.R.V.I.S. (unsafe)** (this is safe, it's your app)
   - Check all permission checkboxes
   - Click **Continue**

8. **Exchange authorization code:**
   - You'll be redirected to the playground
   - Click **Exchange authorization code for tokens**
   - Copy the **Refresh token** (starts with `1//`)
   - **IMPORTANT:** Save this token securely - you'll only see it once!

**Option B: Using Manual cURL (Advanced)**

If you prefer command-line:

```bash
# Step 1: Generate authorization URL
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/gmail.send%20https://www.googleapis.com/auth/gmail.modify%20https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent

# Step 2: Paste URL in browser, authorize, and copy the 'code' parameter from the redirect URL

# Step 3: Exchange code for refresh token
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost" \
  -d "grant_type=authorization_code"

# Response includes 'refresh_token' - save this!
```

---

## J.A.R.V.I.S. Configuration

### Step 6: Configure Gmail Integration

1. Locate your J.A.R.V.I.S. settings file:
   - Path: `data/settings.json` (in J.A.R.V.I.S. root directory)

2. Open `settings.json` in a text editor

3. Add/Update the Gmail configuration:

```json
{
  "integrations": {
    "gmail": {
      "enabled": true,
      "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "refreshToken": "1//YOUR_REFRESH_TOKEN",
      "userEmail": "your-email@gmail.com"
    }
  }
}
```

**Replace:**
- `YOUR_CLIENT_ID` → Client ID from Step 4
- `YOUR_CLIENT_SECRET` → Client Secret from Step 4
- `YOUR_REFRESH_TOKEN` → Refresh token from Step 5
- `your-email@gmail.com` → Your Gmail address

### Step 7: Configure Google Calendar Integration

In the same `settings.json` file, add the Calendar configuration:

```json
{
  "integrations": {
    "gmail": {
      "enabled": true,
      "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "refreshToken": "1//YOUR_REFRESH_TOKEN",
      "userEmail": "your-email@gmail.com"
    },
    "google_calendar": {
      "enabled": true,
      "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "refreshToken": "1//YOUR_REFRESH_TOKEN",
      "userEmail": "your-email@gmail.com"
    }
  }
}
```

**Note:** You can use the **same credentials** for both Gmail and Calendar (same Client ID, Client Secret, and Refresh Token).

### Step 8: Restart J.A.R.V.I.S. Server

Restart the server to load the new configuration:

```bash
# Stop the server (Ctrl+C)

# Start the server
pnpm run dev
# or
npm run dev
```

---

## Testing Your Integration

### Test Gmail Connection

**Option 1: Using J.A.R.V.I.S. UI**

1. Open J.A.R.V.I.S. HoloMat interface
2. Click the **Email app** (📧 icon)
3. The app should load your inbox
4. Try sending a test email

**Option 2: Using API Endpoint**

```bash
# Test Gmail connection
curl -X POST http://localhost:3001/api/integrations/gmail/test

# Expected response:
{
  "ok": true,
  "messageCount": 5,
  "messages": [...]
}
```

### Test Google Calendar Connection

**Option 1: Using J.A.R.V.I.S. UI**

1. Open J.A.R.V.I.S. HoloMat interface
2. Click the **Calendar app** (📅 icon)
3. The calendar should display events from your Google Calendar
4. Days with events should show cyan dots

**Option 2: Using API Endpoint**

```bash
# Test Google Calendar connection
curl -X POST http://localhost:3001/api/integrations/google-calendar/test

# Expected response:
{
  "ok": true,
  "upcomingEvents": [...]
}
```

### Test Voice Commands

Once configured, try these voice commands:

- **"Check my email"** - Fetches recent emails
- **"Send email to john@example.com about the project"** - Compose email via voice
- **"What's on my calendar today?"** - View calendar events

---

## Token Management

### Understanding Token Lifecycle

**Refresh Token:**
- Valid indefinitely (until revoked)
- Used to obtain short-lived access tokens
- Stored in `settings.json`
- **Never expires** unless you revoke it manually

**Access Token:**
- Valid for 1 hour
- Automatically refreshed by J.A.R.V.I.S. clients
- Not stored (regenerated as needed)

### Token Refresh Flow

J.A.R.V.I.S. automatically handles token refresh:

1. When making an API request, the client exchanges the refresh token for an access token
2. The access token is used for the API call
3. If the access token expires, a new one is obtained automatically

**No manual intervention required!**

### Revoking Tokens (If Needed)

If you need to revoke access:

1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "J.A.R.V.I.S." in the list
3. Click **Remove Access**
4. Generate new credentials following this guide again

---

## Troubleshooting

### Common Issues

#### 1. **"gmail_not_configured" Error**

**Cause:** Settings file missing or incorrect

**Solution:**
- Verify `data/settings.json` exists
- Check that `integrations.gmail.enabled` is `true`
- Ensure all fields are filled correctly
- Restart the server

#### 2. **"token_exchange_failed" Error**

**Cause:** Invalid refresh token or credentials

**Solution:**
- Verify Client ID and Client Secret are correct
- Ensure refresh token was copied completely (should start with `1//`)
- Check that the refresh token hasn't been revoked
- Generate a new refresh token if needed

#### 3. **"gmail_api_request_failed" Error**

**Cause:** API not enabled or network issue

**Solution:**
- Verify Gmail API is enabled in Google Cloud Console
- Check network connectivity
- Ensure test user is added in OAuth consent screen

#### 4. **"Permission Denied" When Authorizing**

**Cause:** Email not added as test user

**Solution:**
- Go to **OAuth consent screen** → **Test users**
- Add your Gmail address
- Try authorization again

#### 5. **Email Notifications Not Working**

**Cause:** Email notification system not initialized

**Solution:**
- Check server logs for initialization messages
- Verify `email_notification` is enabled in notification preferences
- Try manual trigger: `GET /api/email-notifications/trigger`

### Debug Logging

Enable verbose logging to troubleshoot:

1. Open `apps/server/src/clients/gmailClient.ts`
2. Look for `console.log` statements - these show OAuth flow details
3. Check server console output for error messages

---

## Security Best Practices

### 🔒 Protecting Your Credentials

1. **Never commit credentials to Git:**
   - Add `data/settings.json` to `.gitignore`
   - Use environment variables for production deployments

2. **Limit scope access:**
   - Only request the OAuth scopes you actually need
   - Remove unused scopes to minimize risk

3. **Use test users during development:**
   - Keep your app in "Testing" mode in OAuth consent screen
   - Only add trusted test users

4. **Rotate tokens periodically:**
   - Regenerate refresh tokens every 6-12 months
   - Revoke old tokens when generating new ones

5. **Secure your settings file:**
   - On Linux/macOS: `chmod 600 data/settings.json`
   - On Windows: Set file permissions to restrict access

### 🛡️ Production Deployment

For production deployments:

1. **Use environment variables:**

```bash
export GMAIL_CLIENT_ID="your_client_id"
export GMAIL_CLIENT_SECRET="your_client_secret"
export GMAIL_REFRESH_TOKEN="your_refresh_token"
export GMAIL_USER_EMAIL="your_email@gmail.com"
```

2. **Encrypt sensitive data:**
   - Use secret management tools (AWS Secrets Manager, HashiCorp Vault)
   - Encrypt `settings.json` at rest

3. **Enable audit logging:**
   - Monitor OAuth token usage
   - Track API call frequency

---

## Additional Resources

### Google Documentation

- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [Google Calendar API Reference](https://developers.google.com/calendar/api/v3/reference)
- [OAuth2 Guide](https://developers.google.com/identity/protocols/oauth2)
- [OAuth2 Playground](https://developers.google.com/oauthplayground/)

### J.A.R.V.I.S. Resources

- [Gmail Client Source Code](../apps/server/src/clients/gmailClient.ts)
- [Google Calendar Client Source Code](../apps/server/src/clients/googleCalendarClient.ts)
- [Email Notification System](../apps/server/src/integrations/email-notifications.ts)

### Support

If you encounter issues not covered in this guide:

1. Check server logs: `apps/server/logs/`
2. Review GitHub Issues: [J.A.R.V.I.S. Issues](https://github.com/your-repo/issues)
3. Enable debug mode in the Gmail/Calendar clients

---

## Summary Checklist

Before marking setup as complete, verify:

- ✅ Google Cloud project created
- ✅ Gmail API enabled
- ✅ Google Calendar API enabled
- ✅ OAuth consent screen configured
- ✅ OAuth2 credentials generated
- ✅ Refresh token obtained
- ✅ `settings.json` updated with credentials
- ✅ Server restarted
- ✅ Gmail integration tested
- ✅ Google Calendar integration tested
- ✅ Voice commands tested (optional)
- ✅ Email notifications working (optional)

**Congratulations!** Your J.A.R.V.I.S. Gmail and Google Calendar integration is now fully configured! 🎉

---

## Appendix: Example Settings File

Complete `settings.json` example:

```json
{
  "notifications": {
    "enabled": true,
    "preferences": {
      "calendar_reminder": true,
      "email_notification": true,
      "system_alert": true
    }
  },
  "integrations": {
    "gmail": {
      "enabled": true,
      "clientId": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
      "clientSecret": "GOCSPX-xxxxxxxxxxxxxxxxx",
      "refreshToken": "1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "userEmail": "user@gmail.com"
    },
    "google_calendar": {
      "enabled": true,
      "clientId": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
      "clientSecret": "GOCSPX-xxxxxxxxxxxxxxxxx",
      "refreshToken": "1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "userEmail": "user@gmail.com"
    },
    "spotify": {
      "enabled": false
    }
  },
  "email_notifications": {
    "enabled": true,
    "checkIntervalMinutes": 5,
    "notifyUnreadOnly": true,
    "maxMessagesPerCheck": 10,
    "filters": {
      "senderWhitelist": [],
      "subjectKeywords": []
    }
  }
}
```

**Note:** Replace all placeholder values with your actual credentials.

---

*Last Updated: December 2024*
*Version: 1.0.0*
