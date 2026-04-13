import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 3D Printer Dashboard Smoke Tests
 *
 * Covers the /3dprinters route backed by Bambu MQTT telemetry.
 * Assumes the server boots with a valid bambu-token.json so the real
 * printer (3DP-22E-409 / SN 22E8AJ5C1004409) auto-connects.
 *
 * Safe — read-only only. No control commands (pause/resume/stop) are sent.
 * API responses are NOT mocked; real server state is exercised.
 */

test.describe('3D Printer Dashboard Smoke', () => {

  test('loads /3dprinters without ErrorBoundary or unhandled exceptions', async ({ page }) => {
    // Capture unhandled JS exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const response = await page.goto('/3dprinters', { waitUntil: 'domcontentloaded' });

    // HTTP layer: page must be reachable
    expect(response!.status()).toBeLessThan(400);

    // Allow React hydration to complete
    await page.waitForTimeout(2000);

    // ErrorBoundary text must NOT appear (page.tsx renders no explicit boundary,
    // but the global Next.js boundary uses these strings)
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application Error');
    expect(bodyText).not.toContain('Something went wrong');

    // No unhandled JS exceptions
    expect(
      pageErrors.filter(m => m.includes('TypeError') || m.includes('Cannot read')),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`
    ).toHaveLength(0);
  });

  test('page heading "3D PRINTER DASHBOARD" is visible', async ({ page }) => {
    // page.tsx line 137: <h1 className="...">3D PRINTER DASHBOARD</h1>
    await page.goto('/3dprinters', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: '3D PRINTER DASHBOARD' })
    ).toBeVisible({ timeout: 8000 });
  });

  test('dashboard renders a printer card or empty-state within 10s', async ({ page }) => {
    await page.goto('/3dprinters', { waitUntil: 'domcontentloaded' });

    // Wait up to 10s for either outcome to appear in the DOM.
    //
    // Printer present path — page.tsx line 226:
    //   <h3 className="text-2xl text-blue-200 font-semibold truncate">{name}</h3>
    //   When Bambu MQTT is live this renders the printer name, e.g. "3DP-22E-409".
    //
    // Empty-state path — page.tsx line 345:
    //   <p className="text-blue-400 text-xl">No printers found</p>
    const printerCard = page.getByRole('heading', { name: /3DP-/i });
    const emptyState  = page.getByText('No printers found');

    await expect(printerCard.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('History tab switches view', async ({ page }) => {
    // Tab buttons are plain <button> elements — page.tsx lines 152-160:
    //   <button onClick={() => setTab('history')}>History</button>
    await page.goto('/3dprinters', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const historyBtn = page.getByRole('button', { name: 'History' });
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // After click the History tab content must appear.
    // page.tsx line 400: <p className="text-blue-400 text-xl">No print history found</p>
    // OR real history task cards are rendered — either is valid.
    const historyEmpty = page.getByText('No print history found');
    const historyCard  = page.locator('text=Device:').first();
    await expect(historyEmpty.or(historyCard)).toBeVisible({ timeout: 6000 });
  });

  test('captures full-page screenshot', async ({ page }) => {
    await page.goto('/3dprinters', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // let MQTT telemetry land

    const dir = 'test-results';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({
      path: path.join(dir, '3dprinters-smoke.png'),
      fullPage: true,
    });
  });
});
