/**
 * Google Calendar Client
 * 
 * Client for Google Calendar API using OAuth2 Refresh Token flow
 * Provides connection testing and upcoming events fetching functionality
 */

export interface GoogleCalendarClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string | null;
  refreshToken: string;
  calendarId: string; // "primary" or actual ID
}

export interface GoogleCalendarEventSummary {
  id: string;
  summary: string | null;
  start: string | null; // ISO string
  end: string | null;   // ISO string
}

export interface GoogleCalendarTestResult {
  ok: boolean;
  error?: string;
  events?: GoogleCalendarEventSummary[];
}

/**
 * Exchange refresh token for access token using Google OAuth2 token endpoint
 */
async function fetchAccessToken(config: GoogleCalendarClientConfig, timeoutMs: number = 10000): Promise<string> {
  try {
    console.log('[GoogleCalendar] Fetching access token via refresh token flow');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token'
      }).toString(),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GoogleCalendar] Token exchange failed: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Token response missing access_token');
    }

    console.log('[GoogleCalendar] Access token obtained successfully');

    return data.access_token;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[GoogleCalendar] Token exchange timeout');
      throw new Error('Token exchange timeout');
    }

    // Log error without exposing secrets
    console.error('[GoogleCalendar] Token exchange failed:', (error as Error).message);
    throw error;
  }
}

/**
 * Fetch upcoming events from Google Calendar API
 */
async function fetchUpcomingEvents(
  config: GoogleCalendarClientConfig,
  accessToken: string,
  timeoutMs: number = 20000
): Promise<GoogleCalendarEventSummary[]> {
  try {
    console.log(`[GoogleCalendar] Fetching upcoming events from calendar: ${config.calendarId}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Build query params
    const now = new Date().toISOString();
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('timeMin', now);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GoogleCalendar] Failed to fetch events: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Calendar API request failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    console.log(`[GoogleCalendar] Found ${items.length} upcoming event(s)`);

    // Map to our summary structure
    const events: GoogleCalendarEventSummary[] = items.map((item: any) => ({
      id: item.id || '',
      summary: item.summary || null,
      start: item.start?.dateTime || item.start?.date || null,
      end: item.end?.dateTime || item.end?.date || null
    }));

    return events;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[GoogleCalendar] Event fetch timeout');
      throw new Error('Event fetch timeout');
    }

    console.error('[GoogleCalendar] Failed to fetch events:', (error as Error).message);
    throw error;
  }
}

/**
 * Test Google Calendar connection by fetching upcoming events
 * @returns GoogleCalendarTestResult with events or error
 */
export async function testGoogleCalendarConnection(
  config: GoogleCalendarClientConfig
): Promise<GoogleCalendarTestResult> {
  try {
    // Step 1: Exchange refresh token for access token
    const accessToken = await fetchAccessToken(config, 10000);

    // Step 2: Fetch upcoming events
    const events = await fetchUpcomingEvents(config, accessToken, 20000);

    console.log(`[GoogleCalendar] Connection test successful: ${events.length} event(s) retrieved`);

    return {
      ok: true,
      events
    };
  } catch (error) {
    // Check if it's a token exchange error
    if ((error as Error).message.includes('Token exchange')) {
      console.error('[GoogleCalendar] Token exchange failed');
      return {
        ok: false,
        error: 'token_exchange_failed'
      };
    }

    // Check if it's a timeout
    if ((error as Error).message.includes('timeout')) {
      console.error('[GoogleCalendar] Connection test timeout');
      return {
        ok: false,
        error: 'connection_test_timeout'
      };
    }

    // Calendar API request failure
    console.error('[GoogleCalendar] Calendar API request failed:', (error as Error).message);
    return {
      ok: false,
      error: 'calendar_api_request_failed'
    };
  }
}
