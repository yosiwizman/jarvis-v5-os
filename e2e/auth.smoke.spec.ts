import { test, expect } from '@playwright/test';

/**
 * Owner PIN Authentication E2E Tests
 * 
 * Tests the PIN authentication system including:
 * - First-run access to /setup without auth
 * - PIN configuration flow
 * - Login/logout flows
 * - Route protection after PIN is set
 */

test.describe('Auth API', () => {
  test('GET /api/auth/me returns auth state', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('ok', true);
    expect(data).toHaveProperty('admin');
    expect(data).toHaveProperty('pinConfigured');
    expect(typeof data.admin).toBe('boolean');
    expect(typeof data.pinConfigured).toBe('boolean');
  });

  test('POST /api/auth/pin/set validates PIN format', async ({ request }) => {
    // First check if PIN is already configured
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    // Skip if PIN is already configured (can't test set without admin)
    if (meData.pinConfigured) {
      test.skip();
      return;
    }
    
    // Test invalid PIN (too short)
    const shortResponse = await request.post('/api/auth/pin/set', {
      data: { pin: '123' }
    });
    expect(shortResponse.status()).toBe(400);
    const shortData = await shortResponse.json();
    expect(shortData.ok).toBe(false);
    expect(shortData.error).toContain('4-8 digits');
    
    // Test invalid PIN (not numeric)
    const alphaResponse = await request.post('/api/auth/pin/set', {
      data: { pin: 'abcd' }
    });
    expect(alphaResponse.status()).toBe(400);
  });

  test('POST /api/auth/pin/login requires configured PIN', async ({ request }) => {
    // First check if PIN is configured
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    if (!meData.pinConfigured) {
      // Should fail when PIN not configured
      const response = await request.post('/api/auth/pin/login', {
        data: { pin: '1234' }
      });
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('not configured');
    } else {
      // Should fail with invalid PIN
      const response = await request.post('/api/auth/pin/login', {
        data: { pin: '0000' }
      });
      // Could be 401 (invalid) or 200 with ok:false
      const data = await response.json();
      if (response.status() === 401) {
        expect(data.ok).toBe(false);
      }
    }
  });
});

test.describe('System Status with Auth', () => {
  test('/api/health/status includes auth details', async ({ request }) => {
    const response = await request.get('/api/health/status');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('details');
    expect(data.details).toHaveProperty('auth');
    expect(data.details.auth).toHaveProperty('pinConfigured');
    expect(typeof data.details.auth.pinConfigured).toBe('boolean');
  });

  test('/api/health/status shows setup_required when PIN not configured', async ({ request }) => {
    const response = await request.get('/api/health/status');
    const data = await response.json();
    
    if (!data.details.auth.pinConfigured) {
      expect(data.level).toBe('setup_required');
      expect(data.reasons).toContain('Owner PIN not configured');
    }
  });
});

test.describe('Setup Page Access', () => {
  test('/setup is accessible when PIN not configured', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    if (!meData.pinConfigured) {
      // Should be accessible without auth
      await page.goto('/setup', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      // Should see the setup page
      await expect(page.locator('[data-testid="setup-page"]')).toBeVisible({ timeout: 5000 });
      
      // Should see PIN setup step
      await expect(page.getByText('Set Owner PIN').first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('/setup shows PIN step as first step', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    if (!meData.pinConfigured) {
      await page.goto('/setup', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // First step indicator should be PIN
      const firstStep = page.locator('.rounded-lg').first();
      await expect(firstStep).toContainText('Set Owner PIN');
    } else {
      test.skip();
    }
  });
});

test.describe('Login Page', () => {
  test('/login page loads', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Should see the brand mark
    await expect(page.locator('[data-testid="brand-mark"]')).toBeVisible();
  });

  test('/login shows appropriate options based on PIN status', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    if (meData.pinConfigured) {
      // Should see Admin Login button when PIN is configured
      await expect(page.getByText('Admin Login (PIN)')).toBeVisible();
    } else {
      // Should see setup prompt when PIN is not configured
      await expect(page.getByText('Go to Setup Wizard')).toBeVisible();
    }
  });

  test('/login shows setup prompt when PIN not configured', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    if (!meData.pinConfigured) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Should show first run setup required message
      await expect(page.getByText('First Run Setup Required')).toBeVisible();
      // Should show Go to Setup Wizard button
      await expect(page.getByText('Go to Setup Wizard')).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('Menu Page', () => {
  test('/menu shows admin status bar when PIN configured', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    if (meData.pinConfigured) {
      // Should show admin status bar
      const statusText = meData.admin ? 'Admin unlocked' : 'Admin locked';
      await expect(page.getByText(statusText)).toBeVisible({ timeout: 5000 });
    }
  });

  test('/menu shows Setup Wizard card during first run', async ({ page, request }) => {
    // Check PIN status
    const meResponse = await request.get('/api/auth/me');
    const meData = await meResponse.json();
    
    if (!meData.pinConfigured) {
      await page.goto('/menu', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Should show Setup Wizard with first run badge
      await expect(page.getByText('Setup Wizard')).toBeVisible();
      await expect(page.getByText('First run')).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('Diagnostics Page', () => {
  test('/diagnostics shows auth status section', async ({ page }) => {
    await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Should show auth status section
    await expect(page.locator('[data-testid="auth-status"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Admin Authentication')).toBeVisible();
    await expect(page.getByText('Owner PIN:')).toBeVisible();
    await expect(page.getByText('Admin session:')).toBeVisible();
  });
});
