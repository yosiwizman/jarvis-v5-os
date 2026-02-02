import { test, expect } from '@playwright/test';

/**
 * Diagnostics Page & Web/Server Drift Detection Tests
 * 
 * These tests verify:
 * - /web-build endpoint returns web-specific build info
 * - /api/health/build returns server build info  
 * - Web and server SHAs match (no deployment drift)
 * - /diagnostics page loads and displays both SHAs
 */

test.describe('Web Build Endpoint', () => {
  test('/web-build returns valid build info', async ({ request }) => {
    const response = await request.get('/web-build');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Must have required fields
    expect(data.ok).toBe(true);
    expect(data.service).toBe('web');
    expect(data.git_sha).toBeDefined();
    expect(data.build_time).toBeDefined();
    expect(data.brand_version).toBeDefined();
    
    // SHA should be either 'unknown' (dev) or a short git hash (7-8 chars)
    expect(data.git_sha).toMatch(/^(unknown|[a-f0-9]{7,8})$/i);
  });

  test('/web-build has no-cache headers', async ({ request }) => {
    const response = await request.get('/web-build');
    
    expect(response.status()).toBe(200);
    
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toMatch(/no-store|no-cache/i);
  });
});

test.describe('Web/Server SHA Consistency', () => {
  test('web and server report the same SHA', async ({ request }) => {
    const [webResponse, serverResponse] = await Promise.all([
      request.get('/web-build'),
      request.get('/api/health/build'),
    ]);
    
    expect(webResponse.status()).toBe(200);
    expect(serverResponse.status()).toBe(200);
    
    const webData = await webResponse.json();
    const serverData = await serverResponse.json();
    
    const webSha = webData.git_sha;
    const serverSha = serverData.git_sha;
    
    // Both should report valid SHAs
    expect(webSha).toBeDefined();
    expect(serverSha).toBeDefined();
    
    // Skip comparison if either is 'unknown' (development mode)
    if (webSha !== 'unknown' && serverSha !== 'unknown') {
      expect(webSha).toBe(serverSha);
    }
  });
});

test.describe('Diagnostics Page', () => {
  test('/diagnostics returns 200', async ({ request }) => {
    const response = await request.get('/diagnostics');
    expect(response.status()).toBe(200);
  });

  test('/diagnostics page loads without errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      // Filter out hydration warnings - these are not fatal errors
      const msg = err.message || '';
      const isHydrationWarning = 
        msg.includes('Hydration') ||
        msg.includes('Text content does not match') ||
        msg.includes('server-rendered HTML');
      if (!isHydrationWarning) {
        pageErrors.push(err);
      }
    });

    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Page should have the diagnostics container
    const diagnosticsPage = page.locator('[data-testid="diagnostics-page"]');
    await expect(diagnosticsPage).toBeVisible({ timeout: 5000 });

    // Should show the title
    await expect(page.locator('h1')).toContainText('AKIOR Diagnostics');

    // No critical errors (hydration warnings filtered out)
    expect(pageErrors).toHaveLength(0);
  });

  test('/diagnostics shows web and server SHAs', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Wait for builds to load
    const webShaElement = page.locator('[data-testid="web-sha"]');
    const serverShaElement = page.locator('[data-testid="server-sha"]');

    await expect(webShaElement).toBeVisible({ timeout: 10000 });
    await expect(serverShaElement).toBeVisible({ timeout: 10000 });

    // Get the displayed SHAs
    const webSha = await webShaElement.textContent();
    const serverSha = await serverShaElement.textContent();

    // SHAs should be present (not empty)
    expect(webSha).toBeTruthy();
    expect(serverSha).toBeTruthy();

    // SHAs should not be "loading..."
    expect(webSha).not.toBe('loading...');
    expect(serverSha).not.toBe('loading...');
  });

  test('/diagnostics shows SHA status indicator', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Wait for status to appear (either match or drift warning)
    const shaStatus = page.locator('[data-testid="sha-status"]');
    await expect(shaStatus).toBeVisible({ timeout: 10000 });
  });

  test('/diagnostics detects drift when web/server mismatch', async ({ page, request }) => {
    // First check if there's actual drift via API
    const [webResponse, serverResponse] = await Promise.all([
      request.get('/web-build'),
      request.get('/api/health/build'),
    ]);

    const webData = await webResponse.json();
    const serverData = await serverResponse.json();

    const webSha = webData.git_sha;
    const serverSha = serverData.git_sha;

    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check if drift warning appears when SHAs don't match
    if (webSha !== 'unknown' && serverSha !== 'unknown' && webSha !== serverSha) {
      const driftWarning = page.locator('[data-testid="drift-warning"]');
      await expect(driftWarning).toBeVisible({ timeout: 5000 });
      await expect(driftWarning).toContainText('DEPLOYMENT DRIFT DETECTED');
    }
  });
});

test.describe('Diagnostics Link in Settings', () => {
  test('settings page has link to diagnostics', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find the diagnostics link in settings content (not HUD widget)
    // Use getByRole to find the specific "View Diagnostics" link
    const diagLink = page.getByRole('link', { name: 'View Diagnostics' });
    await expect(diagLink).toBeVisible({ timeout: 5000 });
  });
});
