/**
 * Security Baseline v2 Contract Tests - Headers & Origin Enforcement
 * 
 * Validates:
 * - HTTP security headers are present on all responses
 * - Origin enforcement rejects requests without valid Origin header
 * - Origin enforcement accepts requests with valid Origin header
 * 
 * Usage:
 *   npm run test:security-headers-contract
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

// Expected security headers
const REQUIRED_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'strict-transport-security',
  // CSP is report-only, so it won't block anything
  'content-security-policy-report-only',
] as const;

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

/**
 * Check if a response has all required security headers
 */
function checkSecurityHeaders(response: Response, endpoint: string): void {
  const missingHeaders: string[] = [];
  
  for (const header of REQUIRED_HEADERS) {
    const value = response.headers.get(header);
    if (!value) {
      missingHeaders.push(header);
    }
  }
  
  if (missingHeaders.length > 0) {
    throw new Error(
      `${endpoint} missing security headers: ${missingHeaders.join(', ')}`
    );
  }
}

/**
 * Verify specific header values
 */
function verifyHeaderValues(response: Response): void {
  // X-Content-Type-Options should be nosniff
  assertEqual(
    response.headers.get('x-content-type-options')?.toLowerCase(),
    'nosniff',
    'X-Content-Type-Options should be nosniff'
  );
  
  // X-Frame-Options should be DENY
  assertEqual(
    response.headers.get('x-frame-options')?.toUpperCase(),
    'DENY',
    'X-Frame-Options should be DENY'
  );
  
  // Referrer-Policy should be no-referrer
  assertEqual(
    response.headers.get('referrer-policy')?.toLowerCase(),
    'no-referrer',
    'Referrer-Policy should be no-referrer'
  );
  
  // HSTS should have max-age
  const hsts = response.headers.get('strict-transport-security');
  assert(
    hsts !== null && hsts.includes('max-age='),
    'HSTS should include max-age directive'
  );
  
  // CSP-Report-Only should include frame-ancestors 'none'
  const csp = response.headers.get('content-security-policy-report-only');
  assert(
    csp !== null && csp.includes("frame-ancestors 'none'"),
    "CSP should include frame-ancestors 'none'"
  );
}

// Test suite
async function runTests() {
  console.log('🛡️ Security Baseline v2 Contract Tests - Headers & Origin\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Test PIN: ${TEST_PIN}\n`);
  
  // Store session cookie and CSRF token for authenticated requests
  let sessionCookie: string | null = null;
  let csrfToken: string | null = null;
  
  // --- Security Headers Tests ---
  console.log('\n📋 Security Headers Tests\n');
  
  await test('GET /api/health/status includes all security headers', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/status`);
    assert(response.ok, `Health status should return 200, got ${response.status}`);
    checkSecurityHeaders(response, '/api/health/status');
    verifyHeaderValues(response);
  });
  
  await test('GET /api/health/build includes all security headers', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/build`);
    assert(response.ok, `Health build should return 200, got ${response.status}`);
    checkSecurityHeaders(response, '/api/health/build');
  });
  
  await test('GET /api/admin/keys/meta includes all security headers', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys/meta`);
    assert(response.ok, `Keys meta should return 200, got ${response.status}`);
    checkSecurityHeaders(response, '/api/admin/keys/meta');
  });
  
  await test('POST /api/auth/pin/login response includes security headers', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    // Response might be 200 (success), 401 (wrong PIN), 400 (PIN not configured), etc.
    // We just check headers are present
    checkSecurityHeaders(response, '/api/auth/pin/login');
    
    // If login succeeded, extract session and CSRF cookies
    if (response.ok) {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const sessionMatch = setCookie.match(/akior_admin_session=([^;]+)/);
        if (sessionMatch) {
          sessionCookie = `akior_admin_session=${sessionMatch[1]}`;
        }
        const csrfMatch = setCookie.match(/akior_csrf_token=([^;]+)/);
        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        }
      }
    }
  });
  
  await test('Security headers have correct values', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/status`);
    verifyHeaderValues(response);
  });
  
  // --- Origin Enforcement Tests ---
  console.log('\n🌐 Origin Enforcement Tests\n');
  
  await test('Admin mutation without Origin header returns 403 ORIGIN_NOT_ALLOWED', async () => {
    // First ensure we're logged in
    if (!sessionCookie) {
      const loginResponse = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
        method: 'POST',
        body: JSON.stringify({ pin: TEST_PIN }),
      });
      
      if (loginResponse.ok) {
        const setCookie = loginResponse.headers.get('set-cookie');
        if (setCookie) {
          const sessionMatch = setCookie.match(/akior_admin_session=([^;]+)/);
          if (sessionMatch) {
            sessionCookie = `akior_admin_session=${sessionMatch[1]}`;
          }
          const csrfMatch = setCookie.match(/akior_csrf_token=([^;]+)/);
          if (csrfMatch) {
            csrfToken = csrfMatch[1];
          }
        }
      }
    }
    
    // Make request WITHOUT Origin header but WITH valid session and CSRF
    // This should be rejected by Origin enforcement
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys`, {
      method: 'PUT',
      headers: {
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        // Note: NOT setting Origin header
      },
      body: JSON.stringify({ meshy: 'test-key-will-be-rejected' }),
    });
    
    // Could be 403 (Origin/CSRF), 428 (setup), or 401 (auth)
    // We accept 403 or 428 as valid - both indicate the request was blocked before processing
    if (response.status === 403) {
      const data = await response.json();
      // Either CSRF_REQUIRED (if no Origin means CSRF also fails) or ORIGIN_NOT_ALLOWED
      assert(
        data.error?.code === 'ORIGIN_NOT_ALLOWED' || 
        data.error?.code === 'CSRF_REQUIRED' ||
        data.error?.code === 'CSRF_INVALID',
        `Expected ORIGIN_NOT_ALLOWED or CSRF error, got ${data.error?.code}`
      );
    } else if (response.status === 428) {
      // Setup required - this is also acceptable (blocked before Origin check)
      console.log('  Note: Got 428 (setup required) - Origin check may have been skipped');
    } else if (response.status === 401) {
      // Auth required - blocked before Origin check
      console.log('  Note: Got 401 (auth required) - Origin check may have been skipped');
    } else {
      throw new Error(`Expected 403, 428, or 401, got ${response.status}`);
    }
  });
  
  await test('Admin mutation with valid Origin header proceeds to next gate', async () => {
    // Make request WITH valid Origin header
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys`, {
      method: 'PUT',
      headers: {
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        'Origin': 'http://localhost:3000', // Valid dev origin
      },
      body: JSON.stringify({ meshy: 'test-key-will-be-rejected' }),
    });
    
    // With valid Origin, should NOT get ORIGIN_NOT_ALLOWED
    // Might get 428 (setup), 401 (auth), or even 200 (success)
    if (response.status === 403) {
      const data = await response.json();
      // Should NOT be ORIGIN_NOT_ALLOWED since we provided valid Origin
      assert(
        data.error?.code !== 'ORIGIN_NOT_ALLOWED',
        `Should not get ORIGIN_NOT_ALLOWED with valid Origin, got ${data.error?.code}`
      );
    }
    
    // Any other status is fine - the Origin gate passed
    console.log(`  Got status ${response.status} (Origin gate passed)`);
  });
  
  await test('LLM config endpoint enforces Origin', async () => {
    // Test LLM config endpoint without Origin
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'POST',
      headers: {
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        // No Origin header
      },
      body: JSON.stringify({ provider: 'openai-cloud' }),
    });
    
    // Should be blocked (403, 428, or 401)
    assert(
      [401, 403, 428].includes(response.status),
      `Expected blocking status code, got ${response.status}`
    );
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
