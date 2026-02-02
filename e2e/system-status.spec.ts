import { test, expect } from '@playwright/test';

/**
 * System Status Endpoint & UI Tests
 * 
 * These tests verify:
 * - /api/health/status returns valid JSON with correct schema
 * - Status level is one of the defined semantic levels
 * - Diagnostics page shows system status card
 * - HUD widget shows appropriate status indicator (not ERROR when healthy)
 */

test.describe('System Status Endpoint Contract', () => {
  test('/api/health/status returns valid schema', async ({ request }) => {
    const response = await request.get('/api/health/status');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Required fields
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('level');
    expect(data).toHaveProperty('reasons');
    expect(data).toHaveProperty('details');
    expect(data).toHaveProperty('git_sha');
    expect(data).toHaveProperty('time');
    
    // Type validation
    expect(typeof data.ok).toBe('boolean');
    expect(typeof data.level).toBe('string');
    expect(Array.isArray(data.reasons)).toBe(true);
    expect(typeof data.details).toBe('object');
  });

  test('/api/health/status level is a valid semantic level', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();
    
    const validLevels = ['healthy', 'setup_required', 'needs_trust', 'degraded', 'error'];
    expect(validLevels).toContain(data.level);
  });

  test('/api/health/status has no-cache headers', async ({ request }) => {
    const response = await request.get('/api/health/status');
    
    expect(response.status()).toBe(200);
    
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toMatch(/no-store|no-cache/i);
  });

  test('/api/health/status ok correlates with level', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();
    
    // ok should be true only when level is 'healthy'
    if (data.level === 'healthy') {
      expect(data.ok).toBe(true);
    } else {
      expect(data.ok).toBe(false);
    }
  });

  test('/api/health/status reasons array matches level', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();
    
    // If level is not healthy, reasons should not be empty
    if (data.level !== 'healthy') {
      expect(data.reasons.length).toBeGreaterThan(0);
    }
    
    // All reasons should be strings
    for (const reason of data.reasons) {
      expect(typeof reason).toBe('string');
    }
  });

  test('/api/health/status details has expected structure', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();
    
    // Details should have keys and notifications subsections
    expect(data.details).toHaveProperty('keys');
    expect(data.details).toHaveProperty('notifications');
    expect(data.details).toHaveProperty('uptime');
    
    // keys should have openai boolean
    expect(typeof data.details.keys.openai).toBe('boolean');
    
    // notifications should have ok boolean
    expect(typeof data.details.notifications.ok).toBe('boolean');
  });
});

test.describe('Diagnostics Page System Status', () => {
  test('/diagnostics shows system status card', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // System status card should be visible
    const statusCard = page.locator('[data-testid="system-status"]');
    await expect(statusCard).toBeVisible({ timeout: 10000 });
  });

  test('/diagnostics shows HTTPS trust status card', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // HTTPS trust status card should be visible
    const httpsStatus = page.locator('[data-testid="https-trust-status"]');
    await expect(httpsStatus).toBeVisible({ timeout: 10000 });
  });

  test('/diagnostics system status shows correct level from API', async ({ page, request }) => {
    // Get status from API
    const apiResponse = await request.get('/api/health/status');
    const apiData = await apiResponse.json();
    
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const statusCard = page.locator('[data-testid="system-status"]');
    await expect(statusCard).toBeVisible({ timeout: 10000 });

    // Card should reflect the level
    if (apiData.level === 'healthy') {
      await expect(statusCard).toContainText('System Healthy');
    } else if (apiData.level === 'setup_required') {
      await expect(statusCard).toContainText('Setup Required');
    } else if (apiData.level === 'degraded') {
      await expect(statusCard).toContainText('Degraded');
    }
  });
});

test.describe('HUD Widget Status Indicator', () => {
  test('HUD widget on /menu does NOT show red ERROR when API is reachable', async ({ page, request }) => {
    // First verify the API is reachable
    const apiResponse = await request.get('/api/health/status');
    expect(apiResponse.status()).toBe(200);
    
    const apiData = await apiResponse.json();
    
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Look for the status indicator
    const hudStatus = page.locator('[data-testid="hud-connection-status"]');
    
    // If status element exists and API level is not 'error', should NOT show ERROR
    if (await hudStatus.isVisible()) {
      const statusText = await hudStatus.textContent();
      
      // If API says we're not in error state, UI should not show ERROR
      if (apiData.level !== 'error') {
        expect(statusText?.toUpperCase()).not.toBe('ERROR');
      }
    }
  });

  test('HUD widget shows appropriate color for status level', async ({ page, request }) => {
    // Get current status level
    const apiResponse = await request.get('/api/health/status');
    const apiData = await apiResponse.json();
    
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hudIndicator = page.locator('[data-testid="hud-status-indicator"]');
    
    if (await hudIndicator.isVisible()) {
      // Check color class based on level
      if (apiData.level === 'healthy') {
        // Should have green styling
        await expect(hudIndicator).toHaveClass(/green|success/i);
      } else if (apiData.level === 'setup_required' || apiData.level === 'degraded') {
        // Should have yellow/amber styling
        await expect(hudIndicator).toHaveClass(/yellow|amber|warning/i);
      }
    }
  });
});
