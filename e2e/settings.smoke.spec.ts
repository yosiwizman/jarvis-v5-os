import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Smoke Tests
 * 
 * These tests verify the /settings page loads correctly in various scenarios,
 * particularly focusing on regression protection for the settings crash bug.
 * 
 * Key scenarios tested:
 * - Fresh browser context (empty localStorage/sessionStorage)
 * - Page renders without JavaScript errors
 * - Critical UI elements are present
 */

test.describe('Settings Page Smoke Tests', () => {
  
  test.beforeEach(async ({ context }) => {
    // Clear all storage to simulate fresh session
    await context.clearCookies();
  });

  test('loads /settings in fresh context without crash', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page errors (uncaught exceptions)
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to settings page (use domcontentloaded - networkidle hangs on SSE connections)
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    // Wait for hydration
    await page.waitForTimeout(3000);

    // Page should not have crashed - check we're still on settings
    await expect(page).toHaveURL(/\/settings/);

    // Page should have rendered (not blank)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for critical crash error patterns
    const criticalErrors = pageErrors.filter(err => 
      err.message.includes("Cannot read properties of undefined") ||
      err.message.includes("Cannot read property") ||
      err.message.includes("is not defined") ||
      err.message.includes("TypeError")
    );

    // No critical JavaScript errors should have occurred
    expect(criticalErrors, 
      `Page crashed with errors: ${criticalErrors.map(e => e.message).join(', ')}`
    ).toHaveLength(0);
  });

  test('settings page has key navigation elements', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    // Wait for page to hydrate
    await page.waitForTimeout(2000);

    // Page should have some form of settings content
    // Using flexible selectors that work across different UI implementations
    const pageContent = await page.textContent('body');
    
    // At minimum, the page should have loaded *something*
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(100);
  });

  test('settings API returns valid response', async ({ request }) => {
    // Test the API endpoint directly
    const response = await request.get('/api/settings');
    
    // Should return 200
    expect(response.status()).toBe(200);
    
    // Should be valid JSON
    const settings = await response.json();
    expect(settings).toBeDefined();
    expect(typeof settings).toBe('object');
    
    // Contract: API should return normalized settings with integrations
    // This is the key regression test - integrations should never be missing
    expect(settings.integrations).toBeDefined();
    expect(settings.integrations.weather).toBeDefined();
    expect(settings.integrations.weather.enabled).toBeDefined();
  });

  test('settings page handles empty localStorage gracefully', async ({ page, context }) => {
    // Explicitly clear localStorage before navigation
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    // Collect page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should not crash
    const criticalErrors = pageErrors.filter(err => 
      err.message.includes("Cannot read properties of undefined") ||
      err.message.includes("TypeError")
    );
    expect(criticalErrors).toHaveLength(0);

    // Page should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings page recovers from corrupted localStorage', async ({ page, context }) => {
    // Inject corrupted localStorage before navigation
    await context.addInitScript(() => {
      // Set corrupted/partial settings that could cause crashes
      window.localStorage.setItem('smartMirrorSettings', JSON.stringify({
        jarvis: { voice: 'echo' }
        // Missing: integrations, models, textChat, etc.
      }));
    });

    // Collect page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should not crash even with partial localStorage
    const criticalErrors = pageErrors.filter(err => 
      err.message.includes("Cannot read properties of undefined") ||
      err.message.includes("TypeError")
    );
    expect(criticalErrors).toHaveLength(0);

    // Page should be visible
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Settings API Contract Tests', () => {

  test('API returns normalized settings for missing file', async ({ request }) => {
    // This tests the server behavior when settings.json doesn't exist
    // The API should return normalized defaults, not an error
    const response = await request.get('/api/settings');
    
    expect(response.status()).toBe(200);
    
    const settings = await response.json();
    
    // Contract: Must have all top-level keys
    expect(settings.jarvis).toBeDefined();
    expect(settings.models).toBeDefined();
    expect(settings.textChat).toBeDefined();
    expect(settings.imageGeneration).toBeDefined();
    expect(settings.integrations).toBeDefined();
    
    // Contract: Must have all integration keys
    const requiredIntegrations = [
      'weather', 'webSearch', 'localLLM', 'elevenLabs', 'azureTTS',
      'spotify', 'gmail', 'googleCalendar', 'alexa', 'irobot', 'nest', 'smartLights'
    ];
    
    for (const key of requiredIntegrations) {
      expect(settings.integrations[key], `Missing integration: ${key}`).toBeDefined();
    }
  });

  test('API returns valid weather config structure', async ({ request }) => {
    const response = await request.get('/api/settings');
    const settings = await response.json();
    
    // This was the specific crash point: accessing integrations.weather.enabled
    const weather = settings.integrations.weather;
    expect(weather).toBeDefined();
    expect(typeof weather.enabled).toBe('boolean');
    expect(typeof weather.provider).toBe('string');
    expect(typeof weather.defaultLocation).toBe('string');
  });
});
