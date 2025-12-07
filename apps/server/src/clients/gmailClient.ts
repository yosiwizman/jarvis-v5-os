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

export interface GmailInboxResult {
  ok: boolean;
  messages?: GmailMessageSummary[];
  nextPageToken?: string | null;
  error?: string;
}

export interface GmailFullMessage {
  id: string;
  threadId: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  date: string | null;
  body: string | null;
  snippet: string;
}

export interface GmailFullMessageResult {
  ok: boolean;
  message?: GmailFullMessage;
  error?: string;
}

export interface GmailSendEmailRequest {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface GmailSendResult {
  ok: boolean;
  messageId?: string;
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
 * Fetch inbox messages with pagination
 * @returns GmailInboxResult with messages and optional pagination token
 */
export async function fetchInboxMessages(
  config: GmailClientConfig,
  options?: { maxResults?: number; pageToken?: string; timeoutMs?: number; labelIds?: string[] }
): Promise<GmailInboxResult> {
  const maxResults = options?.maxResults ?? 20;
  const pageToken = options?.pageToken;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const labelIds = options?.labelIds ?? ['INBOX'];

  try {
    // Step 1: Exchange refresh token for access token
    const accessToken = await fetchAccessToken(config, 10000);

    // Step 2: List inbox messages with pagination
    console.log(`[Gmail] Fetching up to ${maxResults} messages (labels: ${labelIds.join(', ')})${pageToken ? ' (paginated)' : ''}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('maxResults', maxResults.toString());
    for (const labelId of labelIds) {
      url.searchParams.append('labelIds', labelId);
    }
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const listResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!listResponse.ok) {
      const errorText = await listResponse.text().catch(() => 'Unknown error');
      console.error(`[Gmail] List inbox failed: HTTP ${listResponse.status}: ${errorText.substring(0, 200)}`);
      return {
        ok: false,
        error: 'gmail_api_request_failed'
      };
    }

    const listData = await listResponse.json();
    const messageIds = (listData.messages || []).map((m: any) => m.id);
    const nextPageToken = listData.nextPageToken || null;

    console.log(`[Gmail] Found ${messageIds.length} message(s), nextPageToken: ${nextPageToken ? 'yes' : 'no'}`);

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
      messages,
      nextPageToken
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Gmail] Fetch inbox timeout');
      return {
        ok: false,
        error: 'fetch_inbox_timeout'
      };
    }

    if ((error as Error).message.includes('Token exchange')) {
      return {
        ok: false,
        error: 'token_exchange_failed'
      };
    }

    console.error('[Gmail] Fetch inbox failed:', (error as Error).message);
    return {
      ok: false,
      error: 'gmail_api_request_failed'
    };
  }
}

/**
 * Fetch full message details including body content
 */
export async function fetchFullMessage(
  config: GmailClientConfig,
  messageId: string,
  timeoutMs: number = 20000
): Promise<GmailFullMessageResult> {
  try {
    console.log(`[Gmail] Fetching full message details for ${messageId}`);

    // Step 1: Exchange refresh token for access token
    const accessToken = await fetchAccessToken(config, 10000);

    // Step 2: Fetch full message
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
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
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Gmail] Failed to fetch full message: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return {
        ok: false,
        error: 'gmail_api_request_failed'
      };
    }

    const data = await response.json();

    // Extract headers
    const headers = data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || null;
    const from = headers.find((h: any) => h.name === 'From')?.value || null;
    const to = headers.find((h: any) => h.name === 'To')?.value || null;
    const cc = headers.find((h: any) => h.name === 'Cc')?.value || null;
    const date = headers.find((h: any) => h.name === 'Date')?.value || null;

    // Extract body (try plain text first, then HTML)
    let body: string | null = null;
    const extractBody = (payload: any): string | null => {
      // If payload has body data directly
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
      
      // If payload has parts, look for text/plain or text/html
      if (payload.parts && Array.isArray(payload.parts)) {
        // Try to find text/plain first
        const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          return Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
        
        // Fallback to text/html
        const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
          return Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
        }
        
        // Recursively check nested parts
        for (const part of payload.parts) {
          const nestedBody = extractBody(part);
          if (nestedBody) return nestedBody;
        }
      }
      
      return null;
    };

    body = extractBody(data.payload);

    const message: GmailFullMessage = {
      id: data.id || messageId,
      threadId: data.threadId || '',
      subject,
      from,
      to,
      cc,
      date,
      body,
      snippet: data.snippet || ''
    };

    console.log(`[Gmail] Successfully fetched full message ${messageId}`);

    return {
      ok: true,
      message
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error(`[Gmail] Fetch full message timeout for ${messageId}`);
      return {
        ok: false,
        error: 'fetch_message_timeout'
      };
    }

    if ((error as Error).message.includes('Token exchange')) {
      return {
        ok: false,
        error: 'token_exchange_failed'
      };
    }

    console.error(`[Gmail] Failed to fetch full message ${messageId}:`, (error as Error).message);
    return {
      ok: false,
      error: 'gmail_api_request_failed'
    };
  }
}

/**
 * Send an email via Gmail API
 */
export async function sendEmail(
  config: GmailClientConfig,
  request: GmailSendEmailRequest,
  timeoutMs: number = 20000
): Promise<GmailSendResult> {
  try {
    console.log(`[Gmail] Sending email to ${request.to}`);

    // Step 1: Exchange refresh token for access token
    const accessToken = await fetchAccessToken(config, 10000);

    // Step 2: Create RFC 2822 formatted email
    const headers = [
      `From: ${config.userEmail}`,
      `To: ${request.to}`,
      request.cc ? `Cc: ${request.cc}` : null,
      request.bcc ? `Bcc: ${request.bcc}` : null,
      `Subject: ${request.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '', // Empty line separates headers from body
      request.body
    ]
      .filter(Boolean)
      .join('\r\n');

    // Base64url encode the email
    const encodedMessage = Buffer.from(headers)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Step 3: Send via Gmail API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Gmail] Failed to send email: HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return {
        ok: false,
        error: 'gmail_send_failed'
      };
    }

    const data = await response.json();
    console.log(`[Gmail] Email sent successfully, messageId: ${data.id}`);

    return {
      ok: true,
      messageId: data.id
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.error('[Gmail] Send email timeout');
      return {
        ok: false,
        error: 'send_email_timeout'
      };
    }

    if ((error as Error).message.includes('Token exchange')) {
      return {
        ok: false,
        error: 'token_exchange_failed'
      };
    }

    console.error('[Gmail] Failed to send email:', (error as Error).message);
    return {
      ok: false,
      error: 'gmail_send_failed'
    };
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
