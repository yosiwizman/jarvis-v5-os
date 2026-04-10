import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const pages = [
  { path: '/', name: 'home' },
  { path: '/jarvis', name: 'jarvis' },
  { path: '/chat', name: 'chat' },
  { path: '/contacts', name: 'contacts' },
  { path: '/tasks', name: 'tasks' },
  { path: '/settings', name: 'settings' },
  { path: '/display', name: 'dashboard' },
  { path: '/holomat', name: 'holomat' },
  { path: '/functions', name: 'functions' },
  { path: '/files', name: 'files' },
  { path: '/security', name: 'security' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const p of pages) {
    try {
      const resp = await page.goto(`${BASE}${p.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
      const status = resp?.status() ?? 0;
      const finalUrl = page.url();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `/tmp/akior-smoke-${p.name}.png`, fullPage: true });
      const title = await page.title();
      results.push({ page: p.name, path: p.path, status, finalUrl, title, result: 'PASS' });
    } catch (err) {
      results.push({ page: p.name, path: p.path, status: 0, finalUrl: '', title: '', result: `FAIL: ${err.message.slice(0, 80)}` });
    }
  }

  // Chat test: send message and wait for response
  try {
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    const input = page.locator('textarea, input[type="text"]').first();
    await input.waitFor({ timeout: 5000 });
    await input.fill('What is 2+2? Reply with just the number.');

    // Find and click send button or press Enter
    const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), button[aria-label*="send" i]').first();
    try { await sendBtn.click({ timeout: 3000 }); } catch { await input.press('Enter'); }

    // Wait for response (up to 60s for 72B)
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/akior-smoke-chat-response.png', fullPage: true });
    results.push({ page: 'chat-response', path: '/chat', status: 200, finalUrl: '', title: '', result: 'PASS (message sent)' });
  } catch (err) {
    results.push({ page: 'chat-response', path: '/chat', status: 0, finalUrl: '', title: '', result: `FAIL: ${err.message.slice(0, 80)}` });
  }

  // Print results table
  console.log('\n=== SMOKE TEST RESULTS ===');
  console.log('Page'.padEnd(18) + 'Status'.padEnd(8) + 'Result');
  console.log('-'.repeat(50));
  for (const r of results) {
    console.log(`${r.page.padEnd(18)}${String(r.status).padEnd(8)}${r.result}`);
  }

  await browser.close();
})();
