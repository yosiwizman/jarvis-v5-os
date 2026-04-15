import { test, expect } from '@playwright/test';

/**
 * Assistant Briefing Inbox Smoke Tests
 *
 * Covers the /settings/assistant route and the briefing classify/approve/reject
 * flow backed by the deterministic classifier in /api/assistant/*.
 *
 * No live session or credentials are required — all flow through the
 * deterministic classifier rules wired in Pod 2:
 *   - safe verb  → state: safe_to_do_automatically
 *   - risky verb → state: needs_approval, approvalStatus: pending
 *
 * Safe — read/classify/approve only. No send, email, reply, or external
 * mutation actions are performed.
 */

test.describe('Assistant Briefing Inbox Smoke', () => {

  test('/settings/assistant loads without ErrorBoundary or unhandled exceptions', async ({ page }) => {
    // Capture unhandled JS exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const response = await page.goto('/settings/assistant', { waitUntil: 'domcontentloaded' });

    // HTTP layer: page must be reachable
    expect(response!.status()).toBeLessThan(400);

    // Allow React hydration to complete
    await page.waitForTimeout(2000);

    // ErrorBoundary text must NOT appear
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application Error');
    expect(bodyText).not.toContain('Something went wrong');

    // Root subpage testid must be present
    await expect(
      page.getByTestId('assistant-briefing-subpage')
    ).toBeVisible({ timeout: 5000 });

    // No unhandled JS exceptions
    expect(
      pageErrors.filter(m => m.includes('TypeError') || m.includes('Cannot read')),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`
    ).toHaveLength(0);
  });

  test('submit a safe briefing and see safe_to_do_automatically result', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/settings/assistant', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Fill in a safe-verb briefing (contains "watch" + "remind me" — safe verbs)
    await page.getByTestId('assistant-briefing-input').fill(
      'Watch for replies from John and remind me when one arrives'
    );

    // Submit
    await page.getByTestId('assistant-briefing-submit').click();

    // Wait for result panel to appear
    await expect(
      page.getByTestId('assistant-briefing-result')
    ).toBeVisible({ timeout: 10000 });

    // Result must indicate safe classification
    const resultText = await page.getByTestId('assistant-briefing-result').textContent();
    expect(resultText).toMatch(/safe_to_do_automatically/i);

    // No new unhandled exceptions
    expect(
      pageErrors.filter(m => m.includes('TypeError') || m.includes('Cannot read')),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`
    ).toHaveLength(0);
  });

  test('submit a risky briefing, see needs_approval in result, approve it', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/settings/assistant', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Fill in a risky-verb briefing (contains "reply" + "tell them" — risky verbs)
    await page.getByTestId('assistant-briefing-input').fill(
      'Reply to this customer and tell them I am away for the rest of the week'
    );

    // Submit
    await page.getByTestId('assistant-briefing-submit').click();

    // Wait for result panel and assert needs_approval
    await expect(
      page.getByTestId('assistant-briefing-result')
    ).toBeVisible({ timeout: 10000 });

    const resultText = await page.getByTestId('assistant-briefing-result').textContent();
    expect(resultText).toMatch(/needs_approval/i);

    // Approvals list must now contain at least one pending row
    await expect(
      page.getByTestId('assistant-approvals-list')
    ).toBeVisible({ timeout: 5000 });

    const rowCount = await page.getByTestId('assistant-approvals-row').count();
    expect(rowCount).toBeGreaterThan(0);

    // Click the first approve button
    const approveBtn = page.getByTestId('assistant-approve-btn').first();
    await approveBtn.click();

    // After approval, poll until the approved row disappears from pending list
    // OR until the list is empty (both are valid truthful post-approval states).
    // A row is removed from pending once approvalStatus is no longer "pending".
    await expect.poll(
      async () => {
        const remaining = await page.getByTestId('assistant-approvals-row').count();
        const emptyMsg = await page.getByTestId('assistant-approvals-empty').count();
        // Either the row count dropped, or the empty state appeared
        return remaining === 0 || emptyMsg > 0 || remaining < rowCount;
      },
      { timeout: 10000, intervals: [500, 1000, 2000] }
    ).toBe(true);

    // No unhandled exceptions throughout
    expect(
      pageErrors.filter(m => m.includes('TypeError') || m.includes('Cannot read')),
      `Unhandled exceptions: ${pageErrors.join(' | ')}`
    ).toHaveLength(0);
  });

});
