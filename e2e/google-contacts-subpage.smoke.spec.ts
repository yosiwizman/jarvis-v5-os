import { test, expect } from '@playwright/test';

/**
 * Google Contacts Subpage Smoke Tests
 *
 * Covers the /settings/channels/contacts route backed by the DEC-033
 * managed-browser-session gateway (browser-session-gateway lane).
 * No live gateway session is required — these tests only verify that
 * the subpage renders correctly, the descriptor registration is wired up,
 * and that no ErrorBoundary or insecure-banner overlay obstructs the page.
 *
 * Safe — read-only. No connect, send, or mutation actions are performed.
 * No backend APIs are called directly from the spec.
 * In CI, global-setup.ts mints an admin session via POST /api/auth/e2e/bootstrap
 * under PLAYWRIGHT_E2E_AUTH=1, making the page reachable.
 */

test.describe('Google Contacts Subpage Smoke', () => {

  test('/settings/channels/contacts loads without ErrorBoundary or unhandled exceptions', async ({ page }) => {
    // Capture unhandled JS exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const response = await page.goto('/settings/channels/contacts', { waitUntil: 'domcontentloaded' });

    // HTTP layer: page must be reachable
    expect(response!.status()).toBeLessThan(400);

    // Allow React hydration to complete
    await page.waitForTimeout(2000);

    // ErrorBoundary text must NOT appear
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application Error');
    expect(bodyText).not.toContain('Something went wrong');

    // No unhandled JS exceptions
    expect(
      pageErrors.filter(m => m.includes('TypeError') || m.includes('Cannot read')),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`
    ).toHaveLength(0);
  });

  test('no insecure-banner overlay obstructs the page', async ({ page }) => {
    await page.goto('/settings/channels/contacts', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The amber LAN-access banner must not be present
    // Matches: div.fixed.z-[100].bg-amber-500/95
    await expect(
      page.locator('div.fixed.z-\\[100\\].bg-amber-500\\/95')
    ).toHaveCount(0);

    // Corroborate: insecure-access banner text must not be visible
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Secure LAN Access');
  });

  test('Contacts subpage testid is visible and Google Contacts provider card is visible', async ({ page }) => {
    await page.goto('/settings/channels/contacts', { waitUntil: 'domcontentloaded' });

    // The root div must carry the expected testid
    await expect(
      page.getByTestId('channels-contacts-subpage')
    ).toBeVisible({ timeout: 10000 });

    // Use the provider-cluster testid — heading-regex matches multiple elements
    // once the account card renders (learned from PR #127 Calendar fix).
    // The ProviderCluster wrapper renders data-testid="provider-cluster-${providerId}".
    await expect(
      page.getByTestId('provider-cluster-google-contacts')
    ).toBeVisible({ timeout: 10000 });
  });

});
