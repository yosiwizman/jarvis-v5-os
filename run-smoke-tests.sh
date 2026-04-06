#!/usr/bin/env bash
# AKIOR Jarvis V5 OS — Full Smoke Test
# Runs Playwright against all pages, saves screenshots, prints results
# Usage: ./run-smoke-tests.sh
# Exit code: 0 = all pass, 1 = any fail

set -euo pipefail
cd "$(dirname "$0")"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="/tmp/akior-smoke-${TIMESTAMP}"
mkdir -p "$OUTDIR"

RUNNER="$(pwd)/.smoke-runner-${TIMESTAMP}.mjs"
cat > "$RUNNER" << 'PLAYWRIGHT_EOF'
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const outdir = process.argv[2] || '/tmp/akior-smoke';
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
  { path: '/settings/channels', name: 'channels' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];
  let failures = 0;

  for (const p of pages) {
    try {
      const resp = await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = resp?.status() ?? 0;
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${outdir}/${p.name}.png`, fullPage: true });
      results.push({ page: p.name, status, result: 'PASS' });
    } catch (err) {
      results.push({ page: p.name, status: 0, result: 'FAIL' });
      failures++;
    }
  }

  console.log('\n=== AKIOR SMOKE TEST RESULTS ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Screenshots: ${outdir}/`);
  console.log('');
  console.log('Page'.padEnd(18) + 'Status'.padEnd(8) + 'Result');
  console.log('-'.repeat(40));
  for (const r of results) {
    console.log(`${r.page.padEnd(18)}${String(r.status).padEnd(8)}${r.result}`);
  }
  console.log('-'.repeat(40));
  console.log(`${results.length - failures}/${results.length} passed`);

  await browser.close();
  process.exit(failures > 0 ? 1 : 0);
})();
PLAYWRIGHT_EOF

echo "Running smoke tests..."
node "$RUNNER" "$OUTDIR"
EXIT_CODE=$?
rm -f "$RUNNER"

echo ""
echo "Screenshots saved to: $OUTDIR/"
exit $EXIT_CODE
