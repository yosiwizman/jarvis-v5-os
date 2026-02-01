import { test, expect } from '@playwright/test';

test.describe('Onboarding Page', () => {
  test('loads and shows onboarding content', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/onboard', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toContainText(/onboarding|setup/i);

    // Wait for async hydration and Live Status checks before asserting errors
    await page.waitForSelector('[data-testid="live-status"], [data-testid="onboarding-checklist"]', { timeout: 5000 }).catch(() => {
      // Element not found is ok, continue with error assertion
    });
    // Add a short wait for any deferred async errors
    await page.waitForTimeout(500);

    expect(pageErrors, `Page errors: ${pageErrors.map(e => e.message).join(', ')}`).toHaveLength(0);
  });
});
