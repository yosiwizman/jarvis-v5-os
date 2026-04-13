#!/usr/bin/env tsx
/**
 * AKIOR V5 Smoke Test Script
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
 *   AKIOR_SMOKE_BASE_URL - Override base URL for AKIOR smoke tests (default: https://localhost:3000)
 */

import https from "https";

const BASE_URL = process.env.JARVIS_SMOKE_BASE_URL ?? "https://localhost:3000";
const API_BASE_URL = process.env.JARVIS_SMOKE_API_URL ?? BASE_URL;

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
    method?: "GET" | "POST";
    body?: any;
    useApiBase?: boolean;
  } = {},
): Promise<CheckResult> {
  const {
    expectedStatus = 200,
    validateJson = false,
    assertOkField = false,
    method = "GET",
    body = undefined,
    useApiBase = false,
  } = options;
  const url = `${useApiBase ? API_BASE_URL : BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      method,
      // @ts-ignore - agent is valid for https requests
      agent: url.startsWith("https") ? agent : undefined,
      ...(body && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
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
  console.log(`🔍 AKIOR V5 Smoke Tests`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  const checks: Promise<CheckResult>[] = [
    // HTML pages
    check("Home page", "/"),
    check("Settings page", "/settings"),
    check("Chat page", "/chat"),
    check("Menu page", "/menu"),
    check("Holomat page", "/holomat"),

    // API endpoints (use API_BASE_URL in CI mode) - all routes have /api prefix
    check("System metrics API", "/api/system/metrics", {
      validateJson: true,
      useApiBase: true,
    }),
    check("3D print token status API", "/api/3dprint/token-status", {
      validateJson: true,
      useApiBase: true,
    }),
    check("Web search API (unconfigured)", "/api/integrations/web-search", {
      method: "POST",
      body: { query: "test query" },
      expectedStatus: 503, // Expected: not configured
      validateJson: true,
      useApiBase: true,
    }),
    check(
      "ElevenLabs TTS API (unconfigured)",
      "/api/integrations/elevenlabs/tts",
      {
        method: "POST",
        body: { text: "Hello from smoke tests" },
        expectedStatus: 503, // Expected: not configured
        validateJson: true,
        useApiBase: true,
      },
    ),
    check("Azure TTS API (unconfigured)", "/api/integrations/azure-tts/tts", {
      method: "POST",
      body: { text: "Hello from smoke tests" },
      expectedStatus: 503, // Expected: not configured
      validateJson: true,
      useApiBase: true,
    }),
    check("Spotify API (unconfigured)", "/api/integrations/spotify/search", {
      method: "POST",
      body: { query: "test" },
      expectedStatus: 503, // Expected: not configured
      validateJson: true,
      useApiBase: true,
    }),
    // DEC-033: Gmail and Google Calendar are no longer "integrations". They
    // are first-class channel providers (packages/shared/src/channels.ts) with
    // their own API surface under /api/channels/*. The legacy endpoints
    // /api/integrations/gmail/test and /api/integrations/google-calendar/test
    // were purged by DEC-033. Smoke now probes the channels-era surface via
    // the counts endpoint, which is a pure synchronous aggregator and does
    // not depend on any live managed-browser session.
    check("Channels counts API", "/api/channels/counts", {
      method: "GET",
      expectedStatus: 200,
      validateJson: true,
      useApiBase: true,
    }),

    // Notification system endpoints - backend routes have /api prefix
    check("Notification schedule API", "/api/notifications/schedule", {
      method: "POST",
      body: {
        type: "system.test",
        payload: { message: "smoke test notification" },
        triggerAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
      },
      validateJson: true,
      assertOkField: true,
      useApiBase: true,
    }),
    check("Notification SSE stream API", "/api/notifications/stream", {
      method: "GET",
      expectedStatus: 200,
      useApiBase: true,
    }),
  ];

  const results = await Promise.all(checks);

  console.log("");
  results.forEach(logResult);

  const failedCount = results.filter((r) => !r.ok).length;

  console.log("");
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
  console.error("💥 Smoke test runner crashed:");
  console.error(err);
  process.exit(1);
});
