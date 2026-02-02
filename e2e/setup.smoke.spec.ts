import { test, expect } from '@playwright/test';

/**
 * Setup Wizard Smoke Tests
 * 
 * These tests verify:
 * - /setup page loads correctly
 * - System status is displayed (not ERROR when it's setup_required)
 * - Setup page shows step indicators
 * - HUD shows SETUP (not ERROR) when API keys are missing
 */

test.describe('Setup Page', () => {
  test('/setup returns 200', async ({ request }) => {
    const response = await request.get('/setup');
    expect(response.status()).toBe(200);
  });

  test('/setup page loads without errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      // Filter out hydration warnings
      const msg = err.message || '';
      const isHydrationWarning = 
        msg.includes('Hydration') ||
        msg.includes('Text content does not match') ||
        msg.includes('server-rendered HTML');
      if (!isHydrationWarning) {
        pageErrors.push(err);
      }
    });

    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Page should have the setup container
    const setupPage = page.locator('[data-testid="setup-page"]');
    await expect(setupPage).toBeVisible({ timeout: 5000 });

    // Should show the title
    await expect(page.locator('h1')).toContainText('Setup');

    // No critical errors
    expect(pageErrors).toHaveLength(0);
  });

  test('/setup shows step indicators', async ({ page }) => {
    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Should show the three setup steps
    await expect(page.getByText('Trust HTTPS Certificate')).toBeVisible();
    await expect(page.getByText('Configure OpenAI API Key')).toBeVisible();
    await expect(page.getByText('Configure Meshy API Key')).toBeVisible();
  });

  test('/setup displays system status from API', async ({ page, request }) => {
    // Get status from API
    const apiResponse = await request.get('/api/health/status');
    expect(apiResponse.ok()).toBe(true);
    const apiData = await apiResponse.json();

    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Status indicator should reflect the API level
    const setupPage = page.locator('[data-testid="setup-page"]');
    await expect(setupPage).toBeVisible({ timeout: 5000 });

    // If setup_required, should show appropriate status (not ERROR)
    if (apiData.level === 'setup_required') {
      await expect(page.getByText('Setup Required')).toBeVisible({ timeout: 5000 });
    } else if (apiData.level === 'healthy') {
      await expect(page.getByText('All Systems Ready')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('System Status Semantics', () => {
  test('HUD does NOT show ERROR when status is setup_required', async ({ page, request }) => {
    // Check API status
    const apiResponse = await request.get('/api/health/status');
    const apiData = await apiResponse.json();

    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // If status is setup_required, HUD should show SETUP not ERROR
    if (apiData.level === 'setup_required') {
      const hudStatus = page.locator('[data-testid="hud-connection-status"]');
      if (await hudStatus.isVisible()) {
        const statusText = await hudStatus.textContent();
        expect(statusText?.toUpperCase()).not.toBe('ERROR');
        // Should show SETUP or similar
        expect(statusText?.toUpperCase()).toMatch(/SETUP|ONLINE|LOADING/);
      }
    }
  });

  test('/api/health/status returns setup_required when OpenAI key missing', async ({ request }) => {
    const response = await request.get('/api/health/status');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    
    // If OpenAI key is not configured, level should be setup_required (not error)
    if (data.details?.keys?.openai === false) {
      expect(data.level).toBe('setup_required');
      expect(data.reasons).toContain('OpenAI API key not configured');
    }
  });
});

test.describe('Setup Navigation', () => {
  test('menu shows Setup Wizard card when keys missing', async ({ page, request }) => {
    // Check if keys are missing via API
    const keysResponse = await request.get('/api/admin/keys/meta');
    if (!keysResponse.ok()) {
      test.skip();
      return;
    }

    const keysData = await keysResponse.json();
    const hasOpenAI = keysData.meta?.openai?.present;
    const hasMeshy = keysData.meta?.meshy?.present;

    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // If keys are missing, Setup Wizard card should appear
    if (!hasOpenAI || !hasMeshy) {
      await expect(page.getByText('Setup Wizard')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Action required')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Setup Wizard card links to /setup', async ({ page, request }) => {
    // Only run if keys are missing
    const keysResponse = await request.get('/api/admin/keys/meta');
    if (keysResponse.ok()) {
      const keysData = await keysResponse.json();
      if (keysData.meta?.openai?.present && keysData.meta?.meshy?.present) {
        test.skip();
        return;
      }
    }

    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const setupLink = page.locator('a[href="/setup"]');
    if (await setupLink.isVisible()) {
      await expect(setupLink).toContainText('Setup Wizard');
    }
  });
});

test.describe('Key Validation Endpoint', () => {
  test('/api/admin/keys/validate returns error for invalid key', async ({ request }) => {
    const response = await request.post('/api/admin/keys/validate', {
      data: {
        key: 'sk-invalid-test-key',
        provider: 'openai'
      }
    });

    // Should return 200 with ok: false for invalid key
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.provider).toBe('openai');
  });

  test('/api/admin/keys/validate requires key parameter', async ({ request }) => {
    const response = await request.post('/api/admin/keys/validate', {
      data: { provider: 'openai' }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('key is required');
  });
});
