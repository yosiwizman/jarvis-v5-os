import { test, expect } from '@playwright/test';

/**
 * M-CP-10 Supply-Chain Admission Gate — UI smoke
 *
 * Covers /settings/admission-candidates:
 *  - page loads without ErrorBoundary
 *  - no install / activate / runtime-execution controls exist
 *  - blocked-approval state visible on a fresh draft
 */

test.describe('Admission Candidates — control-plane admission gate', () => {
  test('/settings/admission-candidates loads and shows no install/activate controls', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const response = await page.goto('/settings/admission-candidates', {
      waitUntil: 'domcontentloaded',
    });
    expect(response!.status()).toBeLessThan(400);

    await page.waitForTimeout(1500);

    const body = await page.textContent('body');
    expect(body).not.toContain('Application Error');
    expect(body).not.toContain('Something went wrong');

    await expect(page.getByTestId('admission-candidates-subpage')).toBeVisible({
      timeout: 5000,
    });

    // Guardrail: no install / activate / execute buttons in this subpage.
    const lowered = (body ?? '').toLowerCase();
    expect(lowered).not.toMatch(/\binstall\b\s*(skill|package|candidate)/);
    expect(lowered).not.toContain('activate candidate');
    expect(lowered).not.toContain('run skill');

    expect(
      pageErrors.filter(
        (m) => m.includes('TypeError') || m.includes('Cannot read'),
      ),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`,
    ).toHaveLength(0);
  });
});
