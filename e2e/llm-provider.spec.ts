import { test, expect } from '@playwright/test';

/**
 * LLM Provider Abstraction E2E Tests
 * 
 * Tests for:
 * - Settings → Setup Wizard link
 * - LLM provider configuration endpoints
 * - Health/status LLM reporting
 * - Setup Wizard LLM step UI
 */

test.describe('Settings → Setup Wizard Link', () => {
  test('Settings page has Setup Wizard link', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Setup Wizard section should be visible
    const setupWizardSection = page.getByText('Setup Wizard');
    await expect(setupWizardSection.first()).toBeVisible({ timeout: 5000 });

    // Link should point to /setup
    const setupLink = page.locator('[data-testid="setup-wizard-link"]');
    await expect(setupLink).toBeVisible({ timeout: 5000 });
    await expect(setupLink).toHaveAttribute('href', '/setup');
  });

  test('Settings → Setup link navigates correctly', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Wait longer for hydration in CI

    // Wait for the Setup Wizard link to be visible
    const setupLink = page.locator('[data-testid="setup-wizard-link"]');
    await expect(setupLink).toBeVisible({ timeout: 15000 });

    // Scroll into view and click (force click to bypass any overlays in CI)
    await setupLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Brief wait after scroll
    await setupLink.click({ force: true, timeout: 30000 });

    // Should navigate to /setup or /login (if PIN auth required)
    // Wait for navigation to complete (either setup or login)
    await page.waitForURL(/\/(setup|login)/, { timeout: 20000 });
    
    // Verify we navigated away from settings
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(setup|login)/);
  });
});

test.describe('LLM Provider API Endpoints', () => {
  test('GET /api/admin/llm/config returns config without secrets', async ({ request }) => {
    const response = await request.get('/api/admin/llm/config');
    
    // Requires admin auth - may return 401 or 200 depending on session
    if (response.status() === 401) {
      const data = await response.json();
      expect(data.error).toBeDefined();
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Should have required fields
    expect(data.provider).toBeDefined();
    expect(data.configured).toBeDefined();
    
    // Should NOT have raw API key (security check)
    expect(data.apiKey).toBeUndefined();
  });

  test('POST /api/admin/llm/config validates provider', async ({ request }) => {
    const response = await request.post('/api/admin/llm/config', {
      data: {
        provider: 'invalid-provider',
        apiKey: 'test-key'
      }
    });

    // If not admin, should get 401
    if (response.status() === 401) {
      return;
    }

    // Should reject invalid provider
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('provider');
  });

  test('POST /api/admin/llm/config requires API key for openai-cloud', async ({ request }) => {
    const response = await request.post('/api/admin/llm/config', {
      data: {
        provider: 'openai-cloud'
        // Missing apiKey
      }
    });

    // If not admin, should get 401
    if (response.status() === 401) {
      return;
    }

    // Should require API key
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('API key');
  });

  test('POST /api/admin/llm/config requires baseUrl for local-compatible', async ({ request }) => {
    const response = await request.post('/api/admin/llm/config', {
      data: {
        provider: 'local-compatible'
        // Missing baseUrl
      }
    });

    // If not admin, should get 401
    if (response.status() === 401) {
      return;
    }

    // Should require base URL
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('base URL');
  });

  test('POST /api/admin/llm/test validates connection', async ({ request }) => {
    const response = await request.post('/api/admin/llm/test', {
      data: {
        provider: 'openai-cloud',
        apiKey: 'sk-invalid-test-key'
      }
    });

    // If not admin, should get 401
    if (response.status() === 401) {
      return;
    }

    // Should return result (ok: false for invalid key)
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });
});

test.describe('Health Status LLM Reporting', () => {
  test('/api/health/status includes LLM provider info', async ({ request }) => {
    const response = await request.get('/api/health/status');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    
    // Should have details.llm section
    expect(data.details).toBeDefined();
    expect(data.details.llm).toBeDefined();
    
    // LLM section should have required fields
    expect(data.details.llm.provider).toBeDefined();
    expect(typeof data.details.llm.configured).toBe('boolean');
    
    // Should NOT expose secrets
    expect(data.details.llm.apiKey).toBeUndefined();
  });

  test('/api/health/status reports LLM not configured when missing', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();

    // If LLM is not configured, should be in reasons
    if (!data.details.llm.configured) {
      expect(data.reasons.some((r: string) => r.toLowerCase().includes('llm'))).toBe(true);
    }
  });
});

test.describe('Setup Wizard LLM Step UI', () => {
  test('Setup page shows LLM Provider step', async ({ page }) => {
    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Should show LLM Provider step heading
    await expect(page.getByText('LLM Provider').first()).toBeVisible({ timeout: 5000 });
  });

  test('Setup page has provider selector buttons', async ({ page }) => {
    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Should have OpenAI Cloud option
    await expect(page.getByText('OpenAI Cloud')).toBeVisible({ timeout: 5000 });
    
    // Should have Local/Compatible option
    await expect(page.getByText('Local / Compatible')).toBeVisible({ timeout: 5000 });
  });

  test('Setup page shows API key input for OpenAI Cloud', async ({ page }) => {
    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // OpenAI Cloud should be selected by default
    // Should show API key input
    const apiKeyInput = page.locator('input[placeholder="sk-..."]');
    await expect(apiKeyInput).toBeVisible({ timeout: 5000 });
  });

  test('Selecting Local/Compatible shows base URL input', async ({ page }) => {
    await page.goto('/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click Local/Compatible button
    await page.getByText('Local / Compatible').click();

    // Should show base URL input
    const baseUrlInput = page.locator('input[placeholder="http://localhost:11434/v1"]');
    await expect(baseUrlInput).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Diagnostics LLM Status', () => {
  test('Diagnostics page shows LLM status section', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should have LLM status section with proper test ID
    const llmStatus = page.locator('[data-testid="llm-status"]');
    
    // LLM status appears when status.details.llm exists
    // Check if it's visible OR check that the status request worked
    const statusResponse = await page.request.get('/api/health/status');
    const status = await statusResponse.json();
    
    if (status.details?.llm) {
      await expect(llmStatus).toBeVisible({ timeout: 5000 });
    }
  });
});
