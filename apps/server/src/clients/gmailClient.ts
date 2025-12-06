/**
 * Gmail Client
 * 
 * Client for Gmail API using OAuth2 Refresh Token flow
 * Provides connection testing and message fetching functionality
 */

export interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string | null;
  from: string | null;
  date: string | null;
}

export interface GmailTestResult {
  ok: boolean;
  messageCount?: number;
  messages?: GmailMessageSummary[];
  error?: string;
}

/**
 * Exchange refresh token for access token using Google OAuth2 token endpoint
 */
async function fetchAccessToken(config: GmailClientConfig, timeoutMs: number = 10000): Promise<string> {
  try {
    console.log('[Gmail] Fetching access token via refresh token flow');

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
      console.error(`[Gmail] Token exchange failed: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Token response missing access_token');
    }

    console.log('[Gmail] Access token obtained successfully');

    return data.access_token;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Gmail] Token exchange timeout');
      throw new Error('Token exchange timeout');
    }

    // Log error without exposing secrets
    console.error('[Gmail] Token exchange failed:', (error as Error).message);
    throw error;
  }
}

/**
 * Fetch message details from Gmail API
 */
async function fetchMessageDetails(
  accessToken: string,
  userId: string,
  messageId: string,
  timeoutMs: number
): Promise<GmailMessageSummary | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[Gmail] Failed to fetch message ${messageId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Extract headers
    const headers = data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || null;
    const from = headers.find((h: any) => h.name === 'From')?.value || null;
    const date = headers.find((h: any) => h.name === 'Date')?.value || null;

    return {
      id: data.id || messageId,
      threadId: data.threadId || '',
      snippet: data.snippet || '',
      subject,
      from,
      date
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error(`[Gmail] Message fetch timeout for ${messageId}`);
    } else {
      console.error(`[Gmail] Failed to fetch message ${messageId}:`, (error as Error).message);
    }
    return null;
  }
}

/**
 * Test Gmail connection by fetching recent messages
 * @returns GmailTestResult with message summaries or error
 */
export async function testGmailConnection(
  config: GmailClientConfig,
  options?: { maxMessages?: number; timeoutMs?: number }
): Promise<GmailTestResult> {
  const maxMessages = options?.maxMessages ?? 5;
  const timeoutMs = options?.timeoutMs ?? 30000;

  try {
    // Step 1: Exchange refresh token for access token
    const accessToken = await fetchAccessToken(config, 10000);

    // Step 2: List recent messages
    console.log(`[Gmail] Fetching up to ${maxMessages} recent messages for ${config.userEmail}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxMessages}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!listResponse.ok) {
      const errorText = await listResponse.text().catch(() => 'Unknown error');
      console.error(`[Gmail] List messages failed: HTTP ${listResponse.status}: ${errorText.substring(0, 200)}`);
      return {
        ok: false,
        error: 'gmail_api_request_failed'
      };
    }

    const listData = await listResponse.json();
    const messageIds = (listData.messages || []).map((m: any) => m.id);

    console.log(`[Gmail] Found ${messageIds.length} message(s)`);

    // Step 3: Fetch details for each message
    const messages: GmailMessageSummary[] = [];

    for (const messageId of messageIds) {
      const details = await fetchMessageDetails(accessToken, 'me', messageId, 5000);
      if (details) {
        messages.push(details);
      }
    }

    console.log(`[Gmail] Successfully retrieved ${messages.length} message summaries`);

    return {
      ok: true,
      messageCount: messages.length,
      messages
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Gmail] Connection test timeout');
      return {
        ok: false,
        error: 'connection_test_timeout'
      };
    }

    // Check if it's a token exchange error
    if ((error as Error).message.includes('Token exchange')) {
      return {
        ok: false,
        error: 'token_exchange_failed'
      };
    }

    console.error('[Gmail] Connection test failed:', (error as Error).message);
    return {
      ok: false,
      error: 'gmail_api_request_failed'
    };
  }
}
