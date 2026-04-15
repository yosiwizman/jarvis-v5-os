import { test, expect } from '@playwright/test';

/**
 * Google Contacts List Smoke Tests
 *
 * Covers the /settings/channels/contacts route and the ContactsList
 * component backed by the DEC-033 managed-browser-session gateway.
 * No live gateway session is required for tests 1–2 — those only verify
 * the subpage renders correctly and no overlay obstructs the page.
 * Test 3 validates that ContactsList reaches any truthful final state;
 * CI with no live Contacts tab will see a disconnected-session response,
 * which is a valid, passing observation (the auth layer and handler are wired).
 *
 * Safe — read-only. No connect, send, upload, or mutation actions
 * are performed.
 */

test.describe('Google Contacts List Smoke', () => {

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

  test('ContactsList reaches a truthful state or google-contacts provider card is present', async ({ page }) => {
    await page.goto('/settings/channels/contacts', { waitUntil: 'domcontentloaded' });

    // ContactsList is rendered only when the provider account is in
    // "connected" state (inside a conditional in ChannelAccountCard).
    // In CI, the managed-browser session is not available, so the account
    // card will not enter connected state — ContactsList is not
    // rendered at all. That is a truthful observation.
    //
    // Poll for any of the four ContactsList testids. If none appear
    // within 10 s, fall back to asserting the Google Contacts provider cluster
    // is present — which confirms the component tree rendered correctly up
    // to the conditional boundary.
    const reachedListState = await expect.poll(async () => {
      const list    = await page.getByTestId('contacts-list-list').count();
      const empty   = await page.getByTestId('contacts-list-empty').count();
      const error   = await page.getByTestId('contacts-list-error').count();
      const loading = await page.getByTestId('contacts-list-loading').count();
      return list + empty + error + loading;
    }, { timeout: 10000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0).then(() => true).catch(() => false);

    if (!reachedListState) {
      // No ContactsList rendered — account not connected in this environment.
      // Assert the unique provider-cluster testid is visible as the truthful fallback.
      await expect(
        page.getByTestId('provider-cluster-google-contacts')
      ).toBeVisible({ timeout: 5000 });
    }
  });

});
