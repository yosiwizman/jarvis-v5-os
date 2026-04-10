import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Go to chat page (should redirect to login)
    console.log('1. Navigating to /chat...');
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const url = page.url();
    console.log(`   URL: ${url}`);

    // 2. Check if we're on login page
    if (url.includes('/login')) {
      console.log('2. On login page — entering PIN...');
      // Try entering PIN — look for input field
      const pinInput = page.locator('input[type="password"], input[type="text"], input[type="number"]').first();
      await pinInput.waitFor({ timeout: 5000 });
      await pinInput.fill('1234');

      // Look for submit button or press enter
      const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Enter"), button:has-text("Unlock")').first();
      try {
        await submitBtn.click({ timeout: 3000 });
      } catch {
        await pinInput.press('Enter');
      }

      // Wait for navigation
      await page.waitForURL('**/chat**', { timeout: 10000 }).catch(() => {
        console.log('   Did not redirect to /chat after login');
      });
      console.log(`   After login URL: ${page.url()}`);
    }

    // 3. Screenshot current state
    await page.screenshot({ path: '/tmp/akior-chat-before.png', fullPage: true });
    console.log('3. Screenshot saved: /tmp/akior-chat-before.png');

    // 4. Look for chat input
    console.log('4. Looking for chat input...');
    const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="chat" i], input[placeholder*="type" i], input[type="text"]').first();

    try {
      await chatInput.waitFor({ timeout: 10000 });
      console.log('   Found chat input');

      // 5. Type message
      await chatInput.fill('hello');
      console.log('5. Typed "hello"');

      // 6. Send (Enter or button)
      const sendBtn = page.locator('button:has-text("Send"), button[aria-label*="send" i], button[type="submit"]').first();
      try {
        await sendBtn.click({ timeout: 3000 });
      } catch {
        await chatInput.press('Enter');
      }
      console.log('6. Sent message');

      // 7. Wait for response (up to 60s for 72B model)
      console.log('7. Waiting for response (up to 60s)...');
      await page.waitForTimeout(3000);

      // Look for any new text that appeared
      const responseLocator = page.locator('.message, .response, .assistant, [data-role="assistant"], .chat-message').first();
      try {
        await responseLocator.waitFor({ timeout: 60000 });
        const text = await responseLocator.textContent();
        console.log(`   Response: ${text?.slice(0, 100)}`);
      } catch {
        console.log('   No specific response element found, checking page content...');
        const content = await page.textContent('body');
        console.log(`   Page text (last 200): ${content?.slice(-200)}`);
      }
    } catch {
      console.log('   Chat input not found on this page');
      console.log(`   Current URL: ${page.url()}`);
      const title = await page.title();
      console.log(`   Page title: ${title}`);
    }

    // 8. Final screenshot
    await page.screenshot({ path: '/tmp/akior-chat-after.png', fullPage: true });
    console.log('8. Screenshot saved: /tmp/akior-chat-after.png');

    console.log('\nSMOKE TEST COMPLETE');
  } catch (err) {
    console.error('SMOKE TEST FAILED:', err.message);
    await page.screenshot({ path: '/tmp/akior-chat-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
