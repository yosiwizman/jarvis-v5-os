import { test, expect } from '@playwright/test';

/**
 * Google Calendar Subpage Smoke Tests
 *
 * Covers the /settings/channels/calendar route backed by the DEC-033
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

test.describe('Google Calendar Subpage Smoke', () => {

  test('/settings/channels/calendar loads without ErrorBoundary or unhandled exceptions', async ({ page }) => {
    // Capture unhandled JS exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const response = await page.goto('/settings/channels/calendar', { waitUntil: 'domcontentloaded' });

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
    await page.goto('/settings/channels/calendar', { waitUntil: 'domcontentloaded' });
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

  test('Calendar subpage testid is present and Google Calendar provider card heading is visible', async ({ page }) => {
    await page.goto('/settings/channels/calendar', { waitUntil: 'domcontentloaded' });

    // The root div must carry the expected testid
    await expect(
      page.getByTestId('channels-calendar-subpage')
    ).toBeVisible({ timeout: 10000 });

    // The Google Calendar provider descriptor must render its display name
    // within the subpage (from UI_PROVIDERS["google-calendar"].displayName)
    await expect(
      page.getByRole('heading', { name: /google calendar/i }).or(
        page.getByText(/google calendar/i).first()
      )
    ).toBeVisible({ timeout: 10000 });
  });

});
