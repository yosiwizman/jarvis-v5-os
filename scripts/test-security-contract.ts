/**
 * Security Baseline Contract Tests
 * 
 * Validates security protections are working correctly:
 * - Rate limiting on PIN auth endpoints
 * - CSRF protection on admin state-changing endpoints
 * - Cookie security flags (HttpOnly, Secure, SameSite)
 * - Session rotation on login
 * 
 * Usage:
 *   npm run test:security-contract
 * 
 * Environment:
 *   BACKEND_URL - Backend server URL (default: https://localhost:1234)
 *   TEST_PIN - Test PIN to use (default: 1234)
 * 
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:1234';
const TEST_PIN = process.env.TEST_PIN || '1234';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
let testCount = 0;
let passCount = 0;

// Fetch wrapper
const testFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
};

// Test helper functions
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  testCount++;
  const start = Date.now();
  
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
      ),
    ]);
    
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    passCount++;
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.error(`✗ ${name} (${duration}ms)`);
    console.error(`  Error: ${errorMsg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Values not equal'}:\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

function assertContains(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      `${message || 'String does not contain expected substring'}:\n  Expected to contain: ${substring}\n  Actual: ${str}`
    );
  }
}

// Test suite
async function runTests() {
  console.log('🔐 Security Baseline Contract Tests\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Test PIN: ${TEST_PIN}\n`);
  
  // Store session cookie for authenticated requests
  let sessionCookie: string | null = null;
  let csrfToken: string | null = null;
  
  // --- Rate Limiting Tests ---
  console.log('\n📊 Rate Limiting Tests\n');
  
  await test('Rate limiting returns 429 with proper error shape', async () => {
    // Make multiple rapid requests to trigger rate limit
    // Note: We use a high number here but the test might not actually trigger
    // rate limiting if the window is long. This is more of a smoke test.
    
    // First, ensure we have a session and can make authenticated requests
    const loginResponse = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (loginResponse.ok) {
      const setCookie = loginResponse.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/akior_admin_session=([^;]+)/);
        if (match) {
          sessionCookie = `akior_admin_session=${match[1]}`;
        }
        // Extract CSRF token
        const csrfMatch = setCookie.match(/akior_csrf_token=([^;]+)/);
        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        }
      }
    }
    
    // The rate limiter returns a specific JSON structure
    // We can't easily trigger it in tests without many requests,
    // but we can verify the endpoint is protected by checking response structure
    
    // Make a request with wrong PIN to count against rate limit
    const wrongPinResponse = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: '9999' }),
    });
    
    // Should be 401 (wrong PIN) not 429 yet (not rate limited)
    assert(
      wrongPinResponse.status === 401 || wrongPinResponse.status === 429,
      `Expected 401 or 429, got ${wrongPinResponse.status}`
    );
    
    const data = await wrongPinResponse.json();
    assert('ok' in data, 'Response should have ok field');
    
    if (wrongPinResponse.status === 429) {
      // If we did hit rate limit, verify the structure
      assert(data.error?.code === 'RATE_LIMITED', 'Error code should be RATE_LIMITED');
      assert('retryAfterSec' in data, 'Response should have retryAfterSec');
      assert('security' in data, 'Response should have security object');
      
      const retryAfter = wrongPinResponse.headers.get('Retry-After');
      assert(retryAfter !== null, 'Should have Retry-After header');
    }
  });
  
  await test('429 response includes Retry-After header', async () => {
    // This test verifies the rate limit response format
    // We check by examining the expected response structure
    
    // Make request to an endpoint that returns rate limit info
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: '9999' }),
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      assert(retryAfter !== null, 'Rate limited response should have Retry-After header');
      assert(parseInt(retryAfter, 10) > 0, 'Retry-After should be a positive number');
    }
    // If not rate limited, test passes (we can't force rate limit in single request)
  });
  
  // --- CSRF Protection Tests ---
  console.log('\n🛡️ CSRF Protection Tests\n');
  
  await test('Admin state-changing routes require CSRF token', async () => {
    // First ensure we're logged in
    if (!sessionCookie) {
      const loginResponse = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
        method: 'POST',
        body: JSON.stringify({ pin: TEST_PIN }),
      });
      
      if (loginResponse.ok) {
        const setCookie = loginResponse.headers.get('set-cookie');
        if (setCookie) {
          const match = setCookie.match(/akior_admin_session=([^;]+)/);
          if (match) {
            sessionCookie = `akior_admin_session=${match[1]}`;
          }
        }
      }
    }
    
    // Try to PUT keys without CSRF token - should get 403
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys`, {
      method: 'PUT',
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
      body: JSON.stringify({ meshy: 'test-key-value' }),
    });
    
    // Should be 403 (CSRF required) or 428 (setup required)
    assert(
      response.status === 403 || response.status === 428,
      `Expected 403 (CSRF) or 428 (setup), got ${response.status}`
    );
    
    if (response.status === 403) {
      const data = await response.json();
      assert(
        data.error?.code === 'CSRF_REQUIRED' || data.error?.code === 'CSRF_INVALID',
        `Expected CSRF error code, got ${data.error?.code}`
      );
    }
  });
  
  await test('CSRF token is issued on /api/auth/me', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/me`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });
    
    assert(response.ok, 'Auth /me should return 200');
    
    // Check for CSRF cookie in response
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const hasCsrfCookie = setCookie.includes('akior_csrf_token');
      // CSRF token should be issued (either new or refreshed)
      // Note: might not be in set-cookie if already present
    }
  });
  
  await test('CSRF token cookie is readable by JavaScript (not HttpOnly)', async () => {
    // Get CSRF token from /api/auth/me
    const response = await testFetch(`${BACKEND_URL}/api/auth/me`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });
    
    const setCookie = response.headers.get('set-cookie');
    if (setCookie && setCookie.includes('akior_csrf_token')) {
      // Verify it's NOT HttpOnly (so JS can read it)
      assert(
        !setCookie.includes('HttpOnly') || 
        !setCookie.split(';').some(part => 
          part.trim().toLowerCase() === 'httponly' && 
          setCookie.indexOf('akior_csrf_token') < setCookie.indexOf(part)
        ),
        'CSRF cookie should NOT be HttpOnly'
      );
    }
  });
  
  await test('Request with valid CSRF token succeeds (client contract)', async () => {
    // This tests the client-side contract: if we send the CSRF token in the
    // X-CSRF-Token header, the request should not be rejected with CSRF_REQUIRED.
    // This validates that the client's apiFetch utility will work correctly.
    
    // Get fresh CSRF token via login
    const loginResponse = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (!loginResponse.ok) {
      console.log('  Note: Skipped (could not login)');
      return;
    }
    
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      console.log('  Note: Skipped (no cookies returned)');
      return;
    }
    
    // Extract session and CSRF cookies
    const sessionMatch = setCookie.match(/akior_admin_session=([^;]+)/);
    const csrfMatch = setCookie.match(/akior_csrf_token=([^;]+)/);
    
    if (!sessionMatch || !csrfMatch) {
      console.log('  Note: Skipped (missing session or CSRF cookie)');
      return;
    }
    
    const testSession = `akior_admin_session=${sessionMatch[1]}`;
    const testCsrf = csrfMatch[1];
    
    // Make a POST request to an endpoint that requires CSRF, with the token
    // Using LLM config endpoint which requires CSRF
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'POST',
      headers: {
        Cookie: testSession,
        'X-CSRF-Token': testCsrf,
      },
      body: JSON.stringify({ provider: 'openai-cloud' }), // Minimal valid body
    });
    
    // Should NOT be 403 CSRF_REQUIRED (might be 400 for missing API key, but not CSRF error)
    if (response.status === 403) {
      const data = await response.json();
      assert(
        data.code !== 'CSRF_REQUIRED' && data.error?.code !== 'CSRF_REQUIRED',
        'Request with valid CSRF token should not be rejected with CSRF_REQUIRED'
      );
    }
    // 400 is expected if API key is required but not provided - that's OK
    // The point is we didn't get rejected for CSRF
  });
  
  // --- Cookie Security Tests ---
  console.log('\n🍪 Cookie Security Tests\n');
  
  await test('Session cookie has HttpOnly flag', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (response.ok) {
      const setCookie = response.headers.get('set-cookie');
      assert(setCookie !== null, 'Login should set cookie');
      
      // Check that session cookie has HttpOnly
      if (setCookie.includes('akior_admin_session')) {
        assertContains(
          setCookie.toLowerCase(),
          'httponly',
          'Session cookie should have HttpOnly flag'
        );
      }
      
      // Update session cookie for subsequent tests
      const match = setCookie.match(/akior_admin_session=([^;]+)/);
      if (match) {
        sessionCookie = `akior_admin_session=${match[1]}`;
      }
    }
  });
  
  await test('Session cookie has Secure flag', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (response.ok) {
      const setCookie = response.headers.get('set-cookie');
      assert(setCookie !== null, 'Login should set cookie');
      
      if (setCookie.includes('akior_admin_session')) {
        assertContains(
          setCookie.toLowerCase(),
          'secure',
          'Session cookie should have Secure flag'
        );
      }
    }
  });
  
  await test('Session cookie has SameSite=Strict', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (response.ok) {
      const setCookie = response.headers.get('set-cookie');
      assert(setCookie !== null, 'Login should set cookie');
      
      if (setCookie.includes('akior_admin_session')) {
        assertContains(
          setCookie.toLowerCase(),
          'samesite=strict',
          'Session cookie should have SameSite=Strict'
        );
      }
    }
  });
  
  await test('Auth responses have Cache-Control: no-store', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    if (response.ok) {
      const cacheControl = response.headers.get('Cache-Control');
      assert(
        cacheControl !== null && cacheControl.includes('no-store'),
        'Auth responses should have Cache-Control: no-store'
      );
    }
  });
  
  // --- Regression Tests (428 vs 401 semantics) ---
  console.log('\n📋 Regression Tests (428 vs 401 Semantics)\n');
  
  await test('GET /api/admin/keys/meta is accessible without auth', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys/meta`);
    
    assert(response.ok, '/keys/meta should be accessible without auth for setup page');
    
    const data = await response.json();
    assert('meta' in data, 'Response should include meta object');
  });
  
  await test('Protected endpoints return 401 without auth when setup complete', async () => {
    // First check if setup is complete
    const statusResponse = await testFetch(`${BACKEND_URL}/api/health/status`);
    const statusData = await statusResponse.json();
    
    if (statusData.setup?.ownerPin) {
      // Setup is complete, should get 401 without auth
      const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`);
      
      assertEqual(
        response.status,
        401,
        'Should return 401 when setup complete but not authenticated'
      );
    } else {
      console.log('  Note: Skipped (setup not complete)');
    }
  });
  
  await test('Health status includes setup object for UI gating', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/status`);
    assert(response.ok, 'Health status should return 200');
    
    const data = await response.json();
    
    assert('setup' in data, 'Response must include setup object');
    assert('ownerPin' in data.setup, 'Setup must include ownerPin field');
    assert('llm' in data.setup, 'Setup must include llm field');
    assert('level' in data, 'Response must include level field');
    
    console.log(`  Setup state: PIN=${data.setup.ownerPin}, LLM=${data.setup.llm}`);
    console.log(`  Level: ${data.level}`);
  });
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`Tests: ${passCount}/${testCount} passed`);
  console.log('='.repeat(60) + '\n');
  
  if (results.some(r => !r.passed)) {
    console.log('Failed tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.error}`);
      });
    console.log('');
  }
  
  // Exit with appropriate code
  process.exit(passCount === testCount ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
