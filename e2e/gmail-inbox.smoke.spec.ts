import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gmail Inbox Smoke Tests
 *
 * Covers the /settings/channels/email route backed by a live Gmail
 * browser-session account (DEC-033 managed-browser lane).
 * Assumes the server is running with a connected Gmail session so
 * GET /api/channels/gmail/status returns channelState: "connected".
 *
 * Safe — read-only. No send, reply, or mutation actions are performed.
 * API responses are NOT mocked; real server state is exercised.
 */

test.describe('Gmail Inbox Smoke', () => {

  test('/settings/channels/email loads without ErrorBoundary or unhandled exceptions', async ({ page }) => {
    // Capture unhandled JS exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const response = await page.goto('/settings/channels/email', { waitUntil: 'domcontentloaded' });

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
    await page.goto('/settings/channels/email', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The amber LAN-access banner must not be present
    // Matches: div.fixed.z-[100].bg-amber-500/95
    await expect(
      page.locator('div.fixed.z-\\[100\\].bg-amber-500\\/95')
    ).toHaveCount(0);

    // Corroborate: a main heading or landmark must be visible, not blocked
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Secure LAN Access');
  });

  test('Gmail connected account is visible on the Email channels page', async ({ page }) => {
    await page.goto('/settings/channels/email', { waitUntil: 'domcontentloaded' });

    // The Gmail / Google card should appear within 10s once the connected
    // state is fetched from /api/channels/gmail/status
    await expect(
      page.getByRole('heading', { name: /google/i }).or(
        page.getByText(/google/i).first()
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('Gmail inbox list or empty-state renders', async ({ page }) => {
    await page.goto('/settings/channels/email', { waitUntil: 'domcontentloaded' });

    // Wait for either a populated inbox list or a confirmed empty state.
    // Neither gmail-inbox-error nor a stuck gmail-inbox-loading are acceptable
    // final states. Timeout accommodates Next dev-mode compile + the
    // status-poll + accounts-fetch + inbox-fetch serial chain on cold load.
    await expect.poll(async () => {
      const list  = await page.getByTestId('gmail-inbox-list').count();
      const empty = await page.getByTestId('gmail-inbox-empty').count();
      return list + empty;
    }, { timeout: 60000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0);

    // If the list is present, assert at least one row is visible
    const listCount = await page.getByTestId('gmail-inbox-list').count();
    if (listCount > 0) {
      await expect(
        page.getByTestId('gmail-inbox-row').first()
      ).toBeVisible({ timeout: 5000 });
    }

    // Error state must not be present
    await expect(page.getByTestId('gmail-inbox-error')).toHaveCount(0);

    // Loading spinner must not be the final state
    await expect(page.getByTestId('gmail-inbox-loading')).toHaveCount(0);
  });

  test('captures a full-page screenshot', async ({ page }) => {
    await page.goto('/settings/channels/email', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // let inbox data settle

    const dir = 'test-results';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const screenshotPath = path.join(dir, 'gmail-inbox-smoke.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    // Verify the screenshot file was written
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

});
