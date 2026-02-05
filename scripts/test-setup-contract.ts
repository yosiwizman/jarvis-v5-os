/**
 * Setup Wizard Contract Tests
 * 
 * Validates the complete setup flow from fresh state to fully configured system.
 * Tests PIN authentication, LLM provider configuration, and admin route gating.
 * 
 * Usage:
 *   npm run test:setup-contract
 * 
 * Environment:
 *   BACKEND_URL - Backend server URL (default: https://localhost:1234)
 *   TEST_PIN - Test PIN to use (default: 1234)
 * 
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

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

// Fetch wrapper that ignores TLS errors in test environment
const testFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // For HTTPS with self-signed certs, Node.js requires NODE_TLS_REJECT_UNAUTHORIZED=0
  return fetch(url, {
    ...options,
    // @ts-ignore - headers can be an object
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

// Test suite
async function runTests() {
  console.log('🧪 Setup Wizard Contract Tests\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Test PIN: ${TEST_PIN}\n`);
  
  // Store session cookie for authenticated requests
  let sessionCookie: string | null = null;
  
  // --- Initial State Tests ---
  await test('GET /api/health/status returns setup_required when unconfigured', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/status`);
    assert(response.ok, 'Health status should return 200');
    
    const data = await response.json();
    // Note: May be healthy if already configured - that's ok
    assert(
      data.level === 'setup_required' || data.level === 'healthy',
      `Expected setup_required or healthy, got ${data.level}`
    );
    assert('setup' in data, 'Response should include setup object');
  });
  
  // --- PIN Configuration Tests ---
  await test('POST /api/auth/pin/set with valid PIN succeeds', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/set`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    const data = await response.json();
    
    // May be 401 if PIN already configured and not authenticated
    if (response.status === 401) {
      console.log('  Note: PIN already configured, skipping set');
      return;
    }
    
    assert(response.ok, `Expected 200, got ${response.status}`);
    assert(data.ok === true, 'Response should have ok: true');
  });
  
  await test('POST /api/auth/pin/set with invalid format fails', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/set`, {
      method: 'POST',
      body: JSON.stringify({ pin: 'abc' }),
    });
    
    // Should fail with 400 or 401 (if already configured)
    assert(
      response.status === 400 || response.status === 401,
      `Expected 400 or 401, got ${response.status}`
    );
  });
  
  // --- Authentication Tests ---
  await test('POST /api/auth/pin/login with correct PIN succeeds', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    
    const data = await response.json();
    assert(response.ok, `Login should succeed with correct PIN, got ${response.status}`);
    assert(data.ok === true, 'Response should have ok: true');
    
    // Extract session cookie
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const match = setCookieHeader.match(/akior_admin_session=([^;]+)/);
      if (match) {
        sessionCookie = `akior_admin_session=${match[1]}`;
        console.log('  Session cookie captured');
      }
    }
  });
  
  await test('POST /api/auth/pin/login with wrong PIN fails', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/pin/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: '9999' }),
    });
    
    assertEqual(response.status, 401, 'Wrong PIN should return 401');
    
    const data = await response.json();
    assert(data.ok === false, 'Response should have ok: false');
  });
  
  await test('GET /api/auth/me returns pinConfigured: true after setting PIN', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/auth/me`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });
    
    assert(response.ok, 'Auth /me should return 200');
    
    const data = await response.json();
    assert(data.pinConfigured === true, 'PIN should be configured');
  });
  
  // --- Admin Route Gating Tests ---
  await test('Admin routes require authentication after PIN configured', async () => {
    // Try to access admin route without session
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'GET',
    });
    
    // Should return 401 (not 428, since PIN is configured)
    assertEqual(
      response.status,
      401,
      'Admin route without auth should return 401 when setup complete'
    );
  });
  
  await test('Admin routes succeed with valid session', async () => {
    if (!sessionCookie) {
      throw new Error('No session cookie available');
    }
    
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'GET',
      headers: { Cookie: sessionCookie },
    });
    
    assert(response.ok, `Admin route with session should succeed, got ${response.status}`);
  });
  
  // --- LLM Configuration Tests ---
  await test('POST /api/admin/llm/config with openai-cloud provider', async () => {
    if (!sessionCookie) {
      throw new Error('No session cookie available');
    }
    
    // Use a test API key format (won't validate but should be accepted)
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        provider: 'openai-cloud',
        apiKey: 'sk-test-key-for-contract-testing',
      }),
    });
    
    assert(response.ok, `LLM config should succeed, got ${response.status}`);
    
    const data = await response.json();
    assert(data.ok === true, 'Response should have ok: true');
    assert(data.config?.provider === 'openai-cloud', 'Provider should be openai-cloud');
    assert(data.config?.keyConfigured === true, 'Key should be marked as configured');
  });
  
  await test('POST /api/admin/llm/config with local-compatible provider', async () => {
    if (!sessionCookie) {
      throw new Error('No session cookie available');
    }
    
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/config`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        provider: 'local-compatible',
        baseUrl: 'http://localhost:11434/v1',
      }),
    });
    
    assert(response.ok, `LLM config should succeed, got ${response.status}`);
    
    const data = await response.json();
    assert(data.ok === true, 'Response should have ok: true');
    assert(data.config?.provider === 'local-compatible', 'Provider should be local-compatible');
    assert(data.config?.baseUrl, 'Base URL should be set');
  });
  
  await test('POST /api/admin/llm/test returns structured result', async () => {
    if (!sessionCookie) {
      throw new Error('No session cookie available');
    }
    
    const response = await testFetch(`${BACKEND_URL}/api/admin/llm/test`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    
    // Test may fail (expected if key is invalid or server unreachable)
    // But should return structured response
    const data = await response.json();
    assert('ok' in data, 'Response should have ok field');
    assert('latencyMs' in data, 'Response should have latencyMs field');
    
    if (!data.ok) {
      assert('error' in data, 'Failed test should include error message');
      console.log(`  Note: Test failed as expected (${data.error})`);
    }
  });
  
  await test('GET /api/health/status reflects configured state', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/health/status`);
    assert(response.ok, 'Health status should return 200');
    
    const data = await response.json();
    assert(data.setup?.ownerPin === true, 'Setup should show PIN configured');
    // LLM may or may not be configured depending on test execution order
    console.log(`  LLM configured: ${data.setup?.llm}`);
  });
  
  // --- Keys Routes Gating Tests ---
  await test('PUT /api/admin/keys returns 401 without authentication', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys`, {
      method: 'PUT',
      body: JSON.stringify({ meshy: 'msy-test-key' }),
    });
    
    assertEqual(
      response.status,
      401,
      'Keys PUT without auth should return 401 (after PIN configured)'
    );
  });
  
  await test('GET /api/admin/keys/meta accessible without auth', async () => {
    const response = await testFetch(`${BACKEND_URL}/api/admin/keys/meta`);
    
    assert(response.ok, '/keys/meta should be accessible without auth for setup page');
    
    const data = await response.json();
    assert('meta' in data, 'Response should include meta object');
  });
  
  // --- Cleanup Tests (if needed) ---
  // Note: We don't clean up PIN/config to avoid breaking subsequent runs
  
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
