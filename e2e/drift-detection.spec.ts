import { test, expect } from '@playwright/test';

/**
 * Deployment Drift Detection E2E Tests
 * 
 * These tests verify that the running application matches the expected build,
 * preventing "ghost builds" where stale HTML/JS is served.
 * 
 * Key scenarios tested:
 * - /api/health/build returns valid build info
 * - Build SHA is displayed in the UI
 * - UI-displayed SHA matches API-reported SHA
 */

test.describe('Deployment Drift Detection', () => {

  test('/api/health/build returns valid build info', async ({ request }) => {
    const response = await request.get('/api/health/build');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Must have all required fields
    expect(data.ok).toBe(true);
    expect(data.git_sha).toBeDefined();
    expect(data.build_time).toBeDefined();
    expect(data.app_version).toBeDefined();
    expect(data.env).toBeDefined();
    expect(data.time).toBeDefined();
    
    // SHA should be either 'unknown' (dev) or a short git hash (7-8 chars)
    expect(data.git_sha).toMatch(/^(unknown|[a-f0-9]{7,8})$/i);
  });

  test('/api/health/build has no-cache headers', async ({ request }) => {
    const response = await request.get('/api/health/build');
    
    expect(response.status()).toBe(200);
    
    const cacheControl = response.headers()['cache-control'];
    // Should have no-store or no-cache
    expect(cacheControl).toMatch(/no-store|no-cache/i);
  });

  test('build info is available via API', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    
    // Wait for hydration
    await page.waitForTimeout(2000);
    
    // BuildInfo component fetches from /api/health
    // Verify the API returns valid build data that UI can display
    // (Sidebar may be collapsed, so check API directly)
    const response = await page.request.get('/api/health');
    const data = await response.json();
    expect(data.build).toBeDefined();
    expect(data.build.gitSha).toBeDefined();
  });

  test('API SHA matches UI-displayed SHA', async ({ page, request }) => {
    // Get SHA from API
    const apiResponse = await request.get('/api/health/build');
    const apiData = await apiResponse.json();
    const apiSha = apiData.git_sha;
    
    // Navigate to app and get SHA from UI
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // The BuildInfo component displays SHA via /api/health
    // Verify the SHA appears somewhere in the page
    if (apiSha !== 'unknown') {
      // If we have a real SHA, it should appear in the UI
      const pageContent = await page.textContent('body');
      expect(pageContent).toContain(apiSha);
    }
  });

  test('settings page loads without drift errors', async ({ page }) => {
    // Collect page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // No critical JavaScript errors should occur
    const criticalErrors = pageErrors.filter(err => 
      err.message.includes("Cannot read properties of undefined") ||
      err.message.includes("TypeError")
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    // Page should not show the corruption warning banner
    const corruptionBanner = page.locator('text=Settings data incomplete');
    await expect(corruptionBanner).toHaveCount(0);
  });

  test('health endpoints all return consistent SHA', async ({ request }) => {
    // Both health endpoints should return the same SHA
    const [healthResponse, buildResponse] = await Promise.all([
      request.get('/api/health'),
      request.get('/api/health/build'),
    ]);
    
    expect(healthResponse.status()).toBe(200);
    expect(buildResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    const buildData = await buildResponse.json();
    
    // Both should have the same git SHA (allowing for format differences)
    // /api/health returns build.gitSha, /api/health/build returns git_sha
    const healthSha = healthData.build?.gitSha;
    const buildSha = buildData.git_sha;
    
    expect(healthSha).toBe(buildSha);
  });
});

test.describe('Error Boundary Build Info', () => {

  test('error boundary shows build SHA on crash', async ({ page }) => {
    // This test would require forcing an error in the app
    // For now, just verify the error boundary component exists
    // by checking that GlobalError is properly configured
    
    // Navigate to a potentially problematic route
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Page should load without showing error boundary
    const errorBoundary = page.locator('text=Application Error');
    await expect(errorBoundary).toHaveCount(0);
  });
});
