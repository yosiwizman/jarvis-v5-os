import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  let pass = true;
  const results = [];

  try {
    await page.goto('http://localhost:3000/tasks', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    results.push('PASS: navigated to /tasks');

    // Wait 3 seconds for rendering
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({ path: '/tmp/akior-tasks-page.png', fullPage: true });
    results.push('PASS: screenshot saved to /tmp/akior-tasks-page.png');

    // Check for page text
    const body = await page.textContent('body');
    if (/scheduled tasks|tasks/i.test(body)) {
      results.push('PASS: page contains "Tasks" text');
    } else {
      results.push('FAIL: page does not contain expected "Tasks" text');
      pass = false;
    }

    // Look for Add Task / + button
    const addBtn = await page.$('button:has-text("Add Task"), button:has-text("+"), [aria-label*="add" i]');
    if (addBtn) {
      results.push('PASS: found Add Task / + button');
    } else {
      results.push('INFO: no Add Task / + button found (may be expected)');
    }
  } catch (err) {
    results.push(`FAIL: ${err.message}`);
    pass = false;
  } finally {
    await browser.close();
  }

  console.log('\n=== Smoke Test: /tasks page ===');
  results.forEach((r) => console.log(r));
  console.log(`\nOverall: ${pass ? 'PASS' : 'FAIL'}\n`);
  process.exit(pass ? 0 : 1);
})();
