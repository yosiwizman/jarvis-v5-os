/**
 * Spotify Client
 * 
 * Client for Spotify Web API using Client Credentials Flow
 * Provides track search functionality with token caching
 */

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  defaultMarket?: string | null;
}

export interface SpotifyTrackSummary {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  preview_url: string | null;
  external_url: string;
}

// Module-level token cache
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Fetch access token using Client Credentials Flow
 */
async function fetchAccessToken(cfg: SpotifyConfig): Promise<string> {
  // Check if we have a valid cached token
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60000) {
    // Token is valid for at least 1 more minute
    return cachedAccessToken;
  }

  // Prepare credentials
  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

  try {
    console.log('[Spotify] Fetching new access token via Client Credentials Flow');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout for token fetch

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Spotify] Token fetch failed: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Spotify token fetch failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Spotify token response missing access_token');
    }

    // Cache the token (expires_in is in seconds)
    cachedAccessToken = data.access_token;
    const expiresInMs = (data.expires_in || 3600) * 1000;
    tokenExpiresAt = Date.now() + expiresInMs;

    console.log(`[Spotify] Token cached, expires in ${Math.floor(expiresInMs / 1000)}s`);

    return cachedAccessToken as string;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Spotify] Token fetch timeout after 10 seconds');
      throw new Error('Spotify token fetch timeout');
    }

    // Log error without exposing credentials
    console.error('[Spotify] Token fetch failed:', (error as Error).message);
    throw error;
  }
}

/**
 * Search for tracks on Spotify
 * @returns Array of track summaries
 */
export async function searchTracks(
  cfg: SpotifyConfig,
  query: string,
  limit: number = 10
): Promise<SpotifyTrackSummary[]> {
  // Get access token (from cache or fetch new)
  const accessToken = await fetchAccessToken(cfg);

  // Build search URL
  const market = cfg.defaultMarket || 'US';
  const searchParams = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(Math.min(limit, 50)), // Spotify max is 50
    market
  });

  const url = `https://api.spotify.com/v1/search?${searchParams.toString()}`;

  try {
    console.log(`[Spotify] Searching tracks: query="${query.substring(0, 50)}", limit=${limit}, market=${market}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
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
      console.error(`[Spotify] Search failed: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Spotify search failed: ${response.status}`);
    }

    const data = await response.json();

    // Parse track results
    const tracks: SpotifyTrackSummary[] = [];

    if (data.tracks && Array.isArray(data.tracks.items)) {
      for (const item of data.tracks.items) {
        tracks.push({
          id: item.id,
          name: item.name,
          artists: item.artists?.map((a: any) => a.name) || [],
          album: item.album?.name || 'Unknown Album',
          duration_ms: item.duration_ms || 0,
          preview_url: item.preview_url || null,
          external_url: item.external_urls?.spotify || ''
        });
      }
    }

    console.log(`[Spotify] Found ${tracks.length} tracks`);

    return tracks;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Spotify] Search request timeout after 30 seconds');
      throw new Error('Spotify search request timeout');
    }

    // Log error without exposing token
    console.error('[Spotify] Search failed:', (error as Error).message);
    throw error;
  }
}
