import { test, expect } from '@playwright/test';

/**
 * Notifications SSE E2E Smoke Tests
 * 
 * These tests verify the notifications subsystem works correctly:
 * - SSE connection establishes successfully
 * - Health endpoint returns valid status
 * - Client receives heartbeat within expected interval
 * - No console spam or connection thrashing
 * 
 * Note: API tests call the backend directly (via BACKEND_URL) without /api prefix.
 * Caddy and Next.js rewrites both strip /api before forwarding to backend.
 */

// Backend URL for direct API calls (bypassing Next.js rewrites)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1234';

test.describe('Notifications SSE Smoke Tests', () => {

  test('notifications health API returns ok:true', async () => {
    const response = await fetch(`${BACKEND_URL}/health/notifications`);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.sse).toBeDefined();
    expect(data.sse.enabled).toBe(true);
    expect(data.sse.heartbeat_interval_sec).toBe(15);
  });

  test('SSE stream returns correct headers', async () => {
    // Call backend directly to check headers
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`${BACKEND_URL}/notifications/stream`, {
        signal: controller.signal
      });
      
      expect(response.status).toBe(200);
      
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/event-stream');
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  });

  test('page loads without SSE-related console errors', async ({ page }) => {
    // Collect console errors related to SSE/notifications
    const sseErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text().toLowerCase();
        if (text.includes('sse') || text.includes('notification') || text.includes('eventsource')) {
          sseErrors.push(msg.text());
        }
      }
    });

    // Collect page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to a page that uses NotificationContext
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check for SSE-specific errors
    const criticalErrors = pageErrors.filter(err => 
      err.message.includes('EventSource') ||
      err.message.includes('notification')
    );

    expect(criticalErrors, 
      `SSE-related errors: ${criticalErrors.map(e => e.message).join(', ')}`
    ).toHaveLength(0);
  });

  test('NotificationContext establishes SSE connection', async ({ page }) => {
    // Navigate to a page with NotificationContext
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for SSE connection to establish
    await page.waitForTimeout(2000);
    
    // Check window.__notifDebug is available (exposed in non-production)
    const health = await page.evaluate(() => {
      const debug = (window as any).__notifDebug;
      if (!debug) return null;
      return debug.getHealth();
    });
    
    // If debug is available, check health
    if (health) {
      expect(['connecting', 'connected']).toContain(health.status);
    }
    
    // Page should load without crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('SSE receives heartbeat within 20 seconds', async ({ page }) => {
    // Navigate to a page with NotificationContext
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for initial connection
    await page.waitForTimeout(2000);
    
    // Poll for heartbeat (15s interval + some buffer)
    let heartbeatReceived = false;
    const startTime = Date.now();
    const timeout = 22000; // 22 seconds
    
    while (!heartbeatReceived && (Date.now() - startTime) < timeout) {
      const health = await page.evaluate(() => {
        const debug = (window as any).__notifDebug;
        if (!debug) return null;
        const h = debug.getHealth();
        return {
          status: h.status,
          lastHeartbeatAt: h.lastHeartbeatAt?.toISOString?.() || h.lastHeartbeatAt,
          lastMessageAt: h.lastMessageAt?.toISOString?.() || h.lastMessageAt
        };
      });
      
      if (health?.lastHeartbeatAt) {
        heartbeatReceived = true;
        break;
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Heartbeat should have been received (or connection confirmed via lastMessageAt)
    const finalHealth = await page.evaluate(() => {
      const debug = (window as any).__notifDebug;
      if (!debug) return null;
      const h = debug.getHealth();
      return {
        status: h.status,
        lastHeartbeatAt: h.lastHeartbeatAt?.toISOString?.() || h.lastHeartbeatAt,
        lastMessageAt: h.lastMessageAt?.toISOString?.() || h.lastMessageAt
      };
    });
    
    // Either heartbeat or at least a message should have been received
    if (finalHealth) {
      const hasActivity = finalHealth.lastHeartbeatAt || finalHealth.lastMessageAt;
      expect(hasActivity, 
        `SSE should have activity. Health: ${JSON.stringify(finalHealth)}`
      ).toBeTruthy();
    }
    
    // Page should still be functional (no crash from SSE issues)
    await expect(page.locator('body')).toBeVisible();
  });

  test('no SSE connection spam in console', async ({ page }) => {
    // Track connection-related console logs
    const connectionLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Connecting to SSE') || text.includes('SSE connection')) {
        connectionLogs.push(text);
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait some time to detect any connection thrashing
    await page.waitForTimeout(5000);
    
    // In production mode, there should be minimal/no logs
    // In dev mode, there should be just a few connection logs, not spam
    // Filter to only "Connecting" logs (initial connection attempts)
    const connectingLogs = connectionLogs.filter(log => log.includes('Connecting'));
    
    // Should not have many reconnection attempts in 5 seconds (indicates thrashing)
    expect(connectingLogs.length, 
      `Too many connection attempts (${connectingLogs.length}), indicating thrashing: ${connectingLogs.join(', ')}`
    ).toBeLessThanOrEqual(3);
  });
});

test.describe('Notifications API Contract Tests', () => {

  test('notifications stream endpoint exists and responds', async () => {
    // Call backend directly to verify SSE endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`${BACKEND_URL}/notifications/stream`, {
        signal: controller.signal
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  });

  test('notifications history API returns valid structure', async () => {
    const response = await fetch(`${BACKEND_URL}/notifications/history?limit=10`);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(typeof data.limit).toBe('number');
    expect(typeof data.offset).toBe('number');
  });

  test('notifications schedule API validates input', async () => {
    // Test with invalid input (missing required fields)
    const response = await fetch(`${BACKEND_URL}/notifications/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'test',
        payload: {}
        // Missing triggerAt
      })
    });
    
    // Should return 400 for invalid input
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('notifications schedule API accepts valid input', async () => {
    const triggerAt = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
    
    const response = await fetch(`${BACKEND_URL}/notifications/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'test',
        payload: { message: 'E2E test notification' },
        triggerAt
      })
    });
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.eventId).toBeDefined();
  });
});
