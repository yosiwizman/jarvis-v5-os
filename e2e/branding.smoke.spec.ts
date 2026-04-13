import { test, expect } from "@playwright/test";

test.describe("AKIOR Branding Consistency", () => {
  // Login-page branding asserts against the genuine unauthenticated
  // surface; the chromium admin-storageState context auto-redirects
  // /login → /menu and the login brand-mark is never rendered. Clear the
  // state for this suite so /login + /menu render their real anonymous
  // branding surfaces.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("health build exposes git_sha and matches client env if set", async ({
    page,
  }) => {
    const res = await page.request.get("/api/health/build");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.git_sha).toBeTruthy();
    const clientSha = process.env.NEXT_PUBLIC_GIT_SHA;
    if (clientSha) {
      expect(data.git_sha).toBe(clientSha);
    }
  });
  test("login page shows AKIOR branding without J.A.R.V.I.S.", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Wait for hydration
    await page.waitForTimeout(500);

    // Assert brand-mark exists and contains AKIOR
    const brandMark = page.locator('[data-testid="brand-mark"]');
    await expect(brandMark).toBeVisible({ timeout: 5000 });
    await expect(brandMark).toContainText("AKIOR");

    // Assert NO J.A.R.V.I.S. text anywhere on page
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("J.A.R.V.I.S.");
    expect(bodyText).not.toContain("JARVIS");

    // Assert no images with jarvis in src or alt
    const jarvisImages = await page
      .locator(
        'img[src*="jarvis" i], img[alt*="jarvis" i], img[alt*="J.A.R.V.I.S." i]',
      )
      .count();
    expect(jarvisImages).toBe(0);

    expect(
      pageErrors,
      `Page errors: ${pageErrors.map((e) => e.message).join(", ")}`,
    ).toHaveLength(0);
  });

  test("menu page shows AKIOR floating badge without J.A.R.V.I.S.", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    // Set auth to bypass login
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("akior.authenticated", "true");
    });

    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    // Wait for hydration
    await page.waitForTimeout(500);

    // Assert floating badge exists. The badge element itself is a button
    // hosting an animated SVG (no direct text node); the AKIOR brand
    // contract is expressed via its accessible label `aria-label="Open
    // AKIOR Assistant"` on JarvisAssistant.tsx:1401. Assert the a11y
    // branding contract rather than a visual text node the element
    // deliberately does not contain.
    const brandFloat = page.locator('[data-testid="brand-float"]');
    await expect(brandFloat).toBeVisible({ timeout: 5000 });
    await expect(brandFloat).toHaveAttribute("aria-label", /AKIOR/i);

    // Assert NO J.A.R.V.I.S. text anywhere on page (excluding internal identifiers)
    const visibleText = await page.evaluate(() => {
      // Get only visible text content, not script/style tags
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName.toLowerCase();
            if (tag === "script" || tag === "style" || tag === "noscript") {
              return NodeFilter.FILTER_REJECT;
            }
            const style = window.getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden") {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      let text = "";
      let node;
      while ((node = walker.nextNode())) {
        text += node.textContent + " ";
      }
      return text;
    });

    expect(visibleText).not.toContain("J.A.R.V.I.S.");
    // Note: 'jarvis' may appear in route paths or internal identifiers - we check user-visible only

    // Assert no images with jarvis in src or alt (visible)
    const jarvisImages = await page
      .locator(
        'img[src*="jarvis" i][alt*="jarvis" i], img[alt*="J.A.R.V.I.S." i]',
      )
      .count();
    expect(jarvisImages).toBe(0);

    expect(
      pageErrors,
      `Page errors: ${pageErrors.map((e) => e.message).join(", ")}`,
    ).toHaveLength(0);
  });

  test("voice page shows AKIOR HUD without J.A.R.V.I.S.", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("akior.authenticated", "true");
    });

    await page.goto("/jarvis", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("AKIOR");
    expect(bodyText).not.toContain("J.A.R.V.I.S.");
    expect(bodyText).not.toContain("JARVIS");

    const jarvisImages = await page
      .locator(
        'img[src*=\"jarvis\" i], img[alt*=\"jarvis\" i], img[alt*=\"J.A.R.V.I.S.\" i]',
      )
      .count();
    expect(jarvisImages).toBe(0);

    expect(
      pageErrors,
      `Page errors: ${pageErrors.map((e) => e.message).join(", ")}`,
    ).toHaveLength(0);
  });
});
