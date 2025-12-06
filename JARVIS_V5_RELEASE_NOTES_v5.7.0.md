# Jarvis V5.7.0 – Spotify Integration (Client Credentials)

**Release Date:** December 6, 2025  
**Version:** v5.7.0

---

## Summary

Jarvis V5.7.0 introduces **Spotify integration** using the Client Credentials Flow, enabling backend track search functionality. This release adds the foundational Spotify backend client, API endpoint, and configuration UI in Settings—establishing the wiring needed for future music-focused features.

This is a **backend + config + test** release. The Spotify integration provides track search capabilities through the API, with full configuration options in Settings. User-facing music browsing and playback controls will arrive in future releases (v5.7.x or v5.8.0).

All previous features from v5.0.0–v5.6.0 remain intact: dual TTS providers (ElevenLabs + Azure), Local LLM support, Web Search, Weather integration, comprehensive theming, real-time HUD, and more. Spotify is **purely additive**—Jarvis continues to work exactly like v5.6.0 when Spotify is not configured.

---

## What's New in v5.7.0

### 🎵 Spotify Integration (Client Credentials Flow)

Spotify is now a fully supported integration in Jarvis, offering backend music search capabilities via Spotify's Web API.

#### Spotify Configuration Card

Settings → Integrations → Spotify now features a complete configuration card:

- **Status pill:** Green "Connected" when Client ID + Client Secret are set, gray "Not connected" otherwise
- **Enable toggle:** Turn Spotify integration on/off
- **Client ID field:** Text input for Spotify application Client ID
- **Client Secret field:** Password-masked input for Spotify application Client Secret
- **Default Market field (optional):** ISO 3166-1 alpha-2 country code (e.g., `US`, `GB`, `DE`)
  - Controls which market's catalog is searched (affects track availability)
  - Defaults to `US` if not specified

All settings persist to server-side JSON and sync across devices on your LAN.

#### Backend Implementation

- **New Spotify client:** `apps/server/src/clients/spotifyClient.ts`
  - Implements Client Credentials Flow: `POST https://accounts.spotify.com/api/token`
  - Module-level token caching (accessToken + expiresAt)
  - Automatically refreshes expired tokens (cached tokens valid for ~1 hour)
  - Calls Spotify Search API: `GET https://api.spotify.com/v1/search?type=track&q={query}&limit={limit}&market={market}`
  - Returns normalized track summaries with essential metadata
  - 30-second timeout with abort controller for search requests
  - 10-second timeout for token fetch
  - Robust error handling without logging secrets or credentials

- **New Spotify endpoint:** `POST /integrations/spotify/search`
  - **Request body:** `{ query: string; limit?: number }` (query required, limit defaults to 10)
  - **Success response (200):**
    - `Content-Type: application/json`
    - Returns `{ ok: true, results: SpotifyTrackSummary[] }`
    - Each track summary includes:
      - `id`: Spotify track ID
      - `name`: Track title
      - `artists`: Array of artist names
      - `album`: Album name
      - `duration_ms`: Track length in milliseconds
      - `preview_url`: 30-second MP3 preview URL (may be null)
      - `external_url`: Spotify web player URL
  - **Error responses:**
    - `400 Bad Request` if query is missing or empty
    - `503 Service Unavailable` with JSON `{ ok: false, error: 'spotify_not_configured' }` when integration is disabled or unconfigured
    - `502 Bad Gateway` when Spotify API call fails

#### Configuration Model Updates

- **`SpotifyIntegrationConfig`** in `packages/shared/src/integrations.ts`:
  ```typescript
  {
    enabled: boolean;
    clientId: string | null;
    clientSecret: string | null;
    defaultMarket: string | null;  // e.g. "US", "GB", "DE"
  }
  ```

- **Integration metadata** updated:
  - `comingSoon: false` for Spotify
  - `isIntegrationConnected()` checks: `enabled && clientId && clientSecret`

---

## How to Configure Spotify

### Prerequisites

1. **Spotify Developer account:**
   - Sign up for free at [Spotify for Developers](https://developer.spotify.com/dashboard)
   - Create an app in the Spotify Dashboard
   - Note the **Client ID** and **Client Secret** from your app's settings
   - **Note:** Client Credentials Flow does not require user authentication—perfect for backend search

2. **No redirect URIs needed:**
   - Client Credentials Flow doesn't involve user login
   - You can leave Redirect URIs blank in the Spotify Dashboard

### Configuration Steps

1. **Open Settings:**
   - Navigate to `https://localhost:3000/settings` (or your LAN IP)
   - Scroll to **Integrations → Spotify**

2. **Enable Integration:**
   - Check the **"Enable"** checkbox

3. **Enter Configuration:**
   - **Client ID:** Paste your Spotify app's Client ID
   - **Client Secret:** Paste your Spotify app's Client Secret (password-masked)
   - **Default Market (optional):** Enter a two-letter country code (e.g., `US`, `GB`, `DE`)
     - This controls which regional catalog is searched
     - Leave blank or set to `US` for U.S. market

4. **Verify Connection:**
   - Status pill should change to green **"Connected"**
   - If not connected, double-check Client ID and Client Secret

### Current Behavior (v5.7.0)

- **Backend search works:** The `/integrations/spotify/search` endpoint is fully functional
- **Settings show connection status:** Green "Connected" when enabled with valid credentials
- **No chat UI yet:** Future versions will add user-facing music search/playback controls

### Expected Use Cases (Developer/API Testing)

You can test the Spotify search endpoint using:

```bash
curl -X POST https://localhost:3000/api/integrations/spotify/search \
  -H "Content-Type: application/json" \
  -d '{"query": "never gonna give you up", "limit": 5}'
```

Expected response:
```json
{
  "ok": true,
  "results": [
    {
      "id": "4uLU6hMCjMI75M1A2tKUQC",
      "name": "Never Gonna Give You Up",
      "artists": ["Rick Astley"],
      "album": "Whenever You Need Somebody",
      "duration_ms": 213573,
      "preview_url": "https://p.scdn.co/mp3-preview/...",
      "external_url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
    }
  ]
}
```

---

## Quick Recap of Earlier v5.x Releases

### v5.0.0 – Initial Local OS (June 2025)

- Holomat radial app launcher with draggable windows
- Jarvis voice assistant with real-time API
- 3D model generation and viewer
- Camera streaming and security dashboard
- Local HTTPS setup with mkcert + dev TLS proxy
- Server-side settings storage

### v5.2.0 – Theming, HUD, Weather & Integrations Cockpit (November 2025)

- **Full theming system:** Light/Dark modes, custom accent colors, persistent preferences
- **HUD with live metrics:** CPU load, memory usage, system stats on all pages
- **Weather integration:** OpenWeather API with location-based forecasts
- **Integrations cockpit:** Centralized UI for managing integrations
- **System metrics API:** Real-time OS stats at `/api/system/metrics`

### v5.3.0 – Web Search Integration (November 2025)

- **Web Search integration:** Generic HTTP client for Tavily, SerpAPI, and other search providers
- **Web-aware chat:** Enable web search in Text Chat settings for up-to-date information
- **Settings UI:** Configuration card with Base URL, API key, and region inputs

### v5.4.0 – Local LLM Integration (December 2025)

- **Local LLM support:** Ollama and custom HTTP API providers
- **Intelligent routing:** Local-primary, cloud-primary, and legacy modes with automatic fallback
- **Full configuration UI:** Provider, model, temperature, max tokens, API key

### v5.5.0 – ElevenLabs TTS Integration (December 2025)

- **ElevenLabs text-to-speech:** High-quality neural voice generation
- **Full configuration UI:** API key, voice ID, model ID, advanced voice settings
- **Chat UI "Speak answer" button:** Play assistant responses aloud with one click

### v5.6.0 – Azure TTS Integration (December 2025)

- **Azure Text-to-Speech:** Second TTS provider with Microsoft's neural voices
- **Multi-provider architecture:** Choose between ElevenLabs, Azure TTS, or None
- **Full configuration UI:** Region, API key, voice name, style, rate, pitch
- **Settings-driven provider selection:** Explicit provider choice in Text Chat settings

### v5.7.0 – Spotify Integration (December 2025)

- **Spotify backend:** Client Credentials Flow with token caching
- **Search endpoint:** `/integrations/spotify/search` returns track metadata
- **Configuration UI:** Enable toggle, Client ID/Secret, Default Market
- **Foundation for future features:** Music browsing, playback controls in later versions

---

## Architecture Overview

### Spotify Client Credentials Flow

```
Application startup
    ↓
spotifyClient.ts initializes module-level cache
    ↓
cachedAccessToken = null, tokenExpiresAt = 0
    ↓
User enables Spotify in Settings
    ↓
Settings saved to server JSON (clientId, clientSecret, defaultMarket)
    ↓
API call: POST /integrations/spotify/search { query, limit }
    ↓
Server loads settings and validates configuration
    ↓
┌──────────────────────────────────────────────────┐
│ Configuration Check                              │
├──────────────────────────────────────────────────┤
│ Enabled? Client ID? Client Secret?              │
│   ├─ NO → Return 503 with JSON error            │
│   └─ YES → Continue to searchTracks()           │
└──────────────────────────────────────────────────┘
    ↓
Call searchTracks(cfg, query, limit) in spotifyClient.ts
    ↓
fetchAccessToken() checks cached token validity
    ↓
┌──────────────────────────────────────────────────┐
│ Token Cache Check                                │
├──────────────────────────────────────────────────┤
│ cachedAccessToken exists AND                     │
│ tokenExpiresAt > now + 60 seconds?              │
│   ├─ YES → Return cached token                  │
│   └─ NO → Fetch new token from Spotify          │
└──────────────────────────────────────────────────┘
    ↓
POST https://accounts.spotify.com/api/token
    Headers: Authorization: Basic base64(clientId:clientSecret)
    Body: grant_type=client_credentials
    ↓
Spotify returns { access_token, expires_in }
    ↓
Cache token: cachedAccessToken = access_token
             tokenExpiresAt = now + expires_in (in ms)
    ↓
Use cached token for search request
    ↓
GET https://api.spotify.com/v1/search
    Params: type=track, q={query}, limit={limit}, market={market}
    Headers: Authorization: Bearer {access_token}
    ↓
┌──────────────────────────────────────────────────┐
│ Spotify Search API Response                     │
├──────────────────────────────────────────────────┤
│ Success → Parse tracks.items array              │
│ Error → Throw error (network, bad creds, etc.)  │
└──────────────────────────────────────────────────┘
    ↓
Normalize track data to SpotifyTrackSummary[]
    ↓
Server returns { ok: true, results: [...] } to client
    ↓
Client receives track metadata for display/playback
```

### Token Caching Strategy

- **Token lifetime:** Spotify access tokens typically expire after ~1 hour (3600 seconds)
- **Cache validity:** Token is reused if it expires more than 60 seconds in the future
- **Automatic refresh:** When cached token is expired or missing, client fetches new token
- **Module-level cache:** All search requests share the same cached token
- **No persistent storage:** Token cache is in-memory only (resets on server restart)

### Security Considerations

- **Client Secret never logged:** Only non-sensitive error messages are logged
- **Password-masked input:** Client Secret field in Settings uses `type="password"`
- **Server-side validation:** Credentials never exposed to client-side JavaScript
- **HTTPS required:** All API communication uses TLS encryption
- **No user data:** Client Credentials Flow doesn't access user playlists or listening history

---

## Quality Gates

All quality gates passed for v5.7.0:

### Automated Checks

- ✅ **TypeScript compilation:** 0 errors (`npm run typecheck`)
  - Server, Web, and Shared packages all compile cleanly
  - New spotifyClient.ts has full type safety

- ✅ **Production build:** All packages built successfully, 19 routes generated
  - Next.js production build completes without warnings
  - Settings page: 12.2 kB (includes Spotify card)

- ✅ **CI smoke tests:** 11/11 checks passed (`npm run ci:smoke`)
  - 5 page routes: Home, Settings, Chat, Menu, Holomat
  - 6 API endpoints:
    - System metrics (200 expected)
    - 3D print token status (200 expected)
    - Web Search unconfigured (503 expected)
    - ElevenLabs TTS unconfigured (503 expected)
    - Azure TTS unconfigured (503 expected)
    - **NEW:** Spotify unconfigured (503 expected)

### Manual Testing

- ✅ **Settings UI:** Spotify card displays correctly with all fields
- ✅ **Connection status:** Green "Connected" when configured, gray "Not connected" when unconfigured
- ✅ **API endpoint:** `/integrations/spotify/search` returns 503 when unconfigured
- ✅ **API endpoint (configured):** Returns valid track results when configured with real credentials
- ✅ **Token caching:** Second request reuses cached token (verified in logs)
- ✅ **Error handling:** Graceful error responses for missing query, bad credentials, network failures

---

## Backward Compatibility

### No Breaking Changes

- **Spotify disabled by default:** Integration is opt-in, enabled only when configured
- **Existing behavior preserved:** If Spotify is never configured, Jarvis behaves exactly like v5.6.0
- **All v5.6.0 features intact:** ElevenLabs, Azure TTS, Local LLM, Web Search, Weather all unchanged
- **Settings migration:** All previous integration settings remain intact

### Upgrade from v5.6.0

If you're upgrading from v5.6.0:

1. Pull the latest code: `git pull origin main`
2. Checkout v5.7.0: `git checkout v5.7.0`
3. Install dependencies: `npm install` (if needed)
4. Rebuild packages: `npm run build`
5. Start the system: `npm start`

Your existing integrations (TTS, Local LLM, Web Search, etc.) will continue to work. Spotify appears as a new card in Settings, disabled by default. Configure it only when you're ready to use Spotify features.

---

## Known Limitations

### Spotify Integration (v5.7.0)

- **Backend only:** No chat UI for searching or playing tracks (coming in future versions)
- **Client Credentials Flow:** Cannot access user-specific data (playlists, listening history, playback control)
  - Future versions may add Authorization Code Flow for user-based features
- **Search only:** Current implementation provides track search; playback requires Spotify Connect API (future work)
- **Preview URLs:** Some tracks may have `null` preview URLs (Spotify doesn't provide previews for all tracks)
- **Rate limits:** Spotify API has rate limits; excessive requests may be throttled (no usage tracking yet)
- **Manual market entry:** Market code must be typed; no country picker UI yet
- **Internet required:** Spotify API requires internet access (even when using Local LLM for chat)

### Other Integrations

- **TTS (ElevenLabs/Azure):** No streaming; audio synthesized in full before playback
- **Local LLM:** No tool calling support. No streaming responses.
- **Web Search:** Requires separate API key (Tavily, SerpAPI, etc.)
- **Weather:** Requires `OPENWEATHER_API_KEY` environment variable on the server

### System

- **HTTPS required:** Camera streaming and certain browser APIs require HTTPS. Use `npm start` for full functionality.
- **mkcert required:** For trusted local certificates

---

## Future Work (v5.7.x / v5.8.0)

### Chat UI for Spotify Search

- Add a command or button in Chat to search Spotify tracks
- Display search results inline with track metadata
- Allow users to click tracks to open in Spotify or play preview

### Music Browser Tab

- Dedicated "Spotify" tab in the UI for browsing search results
- Grid/list view of tracks with album art, artist names, duration
- Filter and sort options (genre, release date, popularity)

### Playback Integration (Spotify Connect)

- Control playback on user devices via Spotify Connect API
- Requires Authorization Code Flow (user login)
- Play/pause/skip controls in Jarvis UI
- Real-time playback status display (currently playing track, progress bar)

### Usage Tracking

- Display API usage metrics (requests per day, rate limit warnings)
- Track character/request limits for free-tier Spotify apps
- Alert users before hitting rate limits

### Market/Region Picker

- Dropdown or autocomplete UI for selecting market (instead of typing country codes)
- Display country names alongside codes (e.g., "United States (US)")

### Playlist Management (Authorization Code Flow)

- Fetch user playlists
- Create/edit playlists from Jarvis
- Add tracks to playlists directly from search results

### Album and Artist Search

- Extend search to albums and artists (not just tracks)
- Display artist bio, top tracks, related artists
- Display album tracklist, release date, cover art

### Voice-Activated Music Control

- "Jarvis, play Never Gonna Give You Up"
- "Jarvis, search for Taylor Swift"
- Natural language music commands integrated with voice assistant

---

## Migration from v5.6.0

**No breaking changes.** If you're upgrading from v5.6.0:

1. Pull the latest code: `git pull origin main`
2. Checkout v5.7.0: `git checkout v5.7.0`
3. Install dependencies: `npm install`
4. Rebuild packages: `npm run build`
5. Start the system: `npm start`

Spotify is **disabled by default**. Your existing workflow with TTS, Local LLM, Web Search, and other integrations continues unchanged. Enable Spotify in Settings when you're ready to use it.

---

## Contributors

**Lead Developer:** Max (CTO)  
**Product Owner:** Mr. W  
**Release Manager:** Max  

---

## Support & Resources

- **Repository:** [https://github.com/yosiwizman/jarvis-v5-os](https://github.com/yosiwizman/jarvis-v5-os)
- **Documentation:** See repository root for detailed guides
- **Issues:** Report bugs via GitHub Issues
- **Discussions:** Use GitHub Discussions for questions and feature requests
- **Spotify API Docs:** [https://developer.spotify.com/documentation/web-api](https://developer.spotify.com/documentation/web-api)

---

**Thank you for using Jarvis V5!** 🚀🎵
