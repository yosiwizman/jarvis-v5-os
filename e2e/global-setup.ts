import { chromium, request as pwRequest, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright global setup — E2E authenticated session bootstrap.
 *
 * Hits the test-only POST /api/auth/e2e/bootstrap server route (gated by
 * PLAYWRIGHT_E2E_AUTH=1 on the server process) to mint a real admin session
 * cookie, then saves the resulting storageState to e2e/.auth/admin.json.
 *
 * Specs reference storageState via playwright.config.ts `use.storageState`.
 * Unauthenticated browser contexts (no storageState) still redirect to /login
 * — the product auth wall is unchanged.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const authDir = path.resolve('e2e', '.auth');
  const statePath = path.join(authDir, 'admin.json');

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  try {
    const res = await context.request.post('/api/auth/e2e/bootstrap');
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`E2E auth bootstrap failed: HTTP ${res.status()} body=${body}`);
    }
    const body = await res.json().catch(() => ({}));
    if (!body?.ok) {
      throw new Error(`E2E auth bootstrap body not ok: ${JSON.stringify(body)}`);
    }
    // Persist the session cookie to storageState.
    await context.storageState({ path: statePath });
    console.log(`[e2e] admin storageState saved → ${statePath}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
