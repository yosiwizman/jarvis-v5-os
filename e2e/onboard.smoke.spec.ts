import { test, expect } from '@playwright/test';

test.describe('Onboarding Page', () => {
  test('loads and shows onboarding content', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/onboard', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toContainText(/onboarding|setup/i);

    expect(pageErrors, `Page errors: ${pageErrors.map(e => e.message).join(', ')}`).toHaveLength(0);
  });
});
