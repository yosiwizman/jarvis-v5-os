#!/usr/bin/env tsx
/**
 * Jarvis V5 Smoke Test Script
 * 
 * Quick CLI smoke test that verifies key endpoints are responding correctly.
 * 
 * Usage:
 *   npm run smoke
 * 
 * Requirements:
 *   - Dev server must be running (npm start)
 *   - Base URL defaults to https://localhost:3000
 * 
 * Environment:
 *   JARVIS_BASE_URL - Override base URL (default: https://localhost:3000)
 */

import https from 'https';

const BASE_URL = process.env.JARVIS_BASE_URL ?? 'https://localhost:3000';

// Allow self-signed certificates for local dev
const agent = new https.Agent({
  rejectUnauthorized: false,
});

interface CheckResult {
  name: string;
  url: string;
  status: number;
  ok: boolean;
  error?: string;
}

async function check(
  name: string,
  path: string,
  options: {
    expectedStatus?: number;
    validateJson?: boolean;
    assertOkField?: boolean;
  } = {}
): Promise<CheckResult> {
  const { expectedStatus = 200, validateJson = false, assertOkField = false } = options;
  const url = `${BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      // @ts-ignore - agent is valid for https requests
      agent: url.startsWith('https') ? agent : undefined,
    });

    const status = response.status;
    let ok = status === expectedStatus;
    let error: string | undefined;

    // If we expect JSON, parse and validate
    if (validateJson && ok) {
      try {
        const json = await response.json();
        
        // If assertOkField is true, check that json.ok === true
        if (assertOkField && json.ok !== true) {
          ok = false;
          error = `JSON field 'ok' is not true (got: ${json.ok})`;
        }
      } catch (parseError) {
        ok = false;
        error = `Failed to parse JSON: ${parseError}`;
      }
    }

    return { name, url, status, ok, error };
  } catch (err) {
    return {
      name,
      url,
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function logResult(result: CheckResult): void {
  if (result.ok) {
    console.log(`✅ ${result.name} (${result.status})`);
  } else {
    console.log(`❌ ${result.name} (${result.status})`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   URL: ${result.url}`);
  }
}

async function runSmokeTests(): Promise<void> {
  console.log(`🔍 Jarvis V5 Smoke Tests`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  const checks: Promise<CheckResult>[] = [
    // HTML pages
    check('Home page', '/'),
    check('Settings page', '/settings'),
    check('Chat page', '/chat'),
    check('Menu page', '/menu'),
    check('Holomat page', '/holomat'),

    // API endpoints
    check('System metrics API', '/api/system/metrics', {
      validateJson: true,
      assertOkField: true,
    }),
    check('3D print token status API', '/api/3dprint/token-status', {
      validateJson: true,
      assertOkField: true,
    }),
  ];

  const results = await Promise.all(checks);

  console.log('');
  results.forEach(logResult);

  const failedCount = results.filter((r) => !r.ok).length;

  console.log('');
  if (failedCount === 0) {
    console.log(`✅ All ${results.length} checks passed!`);
    process.exit(0);
  } else {
    console.log(`❌ ${failedCount} of ${results.length} checks failed.`);
    process.exit(1);
  }
}

// Run the tests
runSmokeTests().catch((err) => {
  console.error('💥 Smoke test runner crashed:');
  console.error(err);
  process.exit(1);
});
