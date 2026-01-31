#!/usr/bin/env npx tsx
/**
 * SSE Notifications Contract Tests
 * 
 * Tests the Server-Sent Events (SSE) endpoint for notifications:
 * - Validates required SSE headers
 * - Confirms connection message on connect
 * - Verifies heartbeat is sent within expected interval
 * - Tests health endpoint
 * 
 * Run: npm run test:notifications
 * 
 * Requires server running on BACKEND_URL (default: http://localhost:1234)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1234';
const SSE_TIMEOUT_MS = 25000; // 25 seconds (heartbeat is 15s)

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual: string | null | undefined, expected: string, message: string) {
  if (!actual || !actual.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${message}: expected to include "${expected}", got "${actual}"`);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

async function runTests() {
console.log('\n📡 SSE Notifications Contract Tests\n');
console.log(`   Target: ${BACKEND_URL}\n`);

// ----------------------------------------------------------------------------
// Suite 1: SSE Headers Validation
// ----------------------------------------------------------------------------

console.log('1️⃣  SSE Headers Validation');

await test('SSE endpoint returns correct Content-Type header', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    const contentType = response.headers.get('content-type');
    assertIncludes(contentType, 'text/event-stream', 'Content-Type');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

await test('SSE endpoint returns Cache-Control: no-cache', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    const cacheControl = response.headers.get('cache-control');
    assertIncludes(cacheControl, 'no-cache', 'Cache-Control');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

await test('SSE endpoint returns X-Accel-Buffering: no', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    const xAccelBuffering = response.headers.get('x-accel-buffering');
    assertEqual(xAccelBuffering?.toLowerCase(), 'no', 'X-Accel-Buffering');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

await test('SSE endpoint returns HTTP 200', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    assertEqual(response.status, 200, 'HTTP status');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

// ----------------------------------------------------------------------------
// Suite 2: Connection Message
// ----------------------------------------------------------------------------

console.log('\n2️⃣  Connection Message');

await test('SSE sends connection message on connect', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    assert(response.body !== null, 'Response body should not be null');
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let connectionReceived = false;
    
    // Read until we get connection message or timeout
    while (!connectionReceived) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE messages
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'connection') {
              connectionReceived = true;
              assert(parsed.payload?.status === 'connected', 'Connection payload should have status=connected');
              break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    
    assert(connectionReceived, 'Should receive connection message');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

// ----------------------------------------------------------------------------
// Suite 3: Heartbeat
// ----------------------------------------------------------------------------

console.log('\n3️⃣  Heartbeat');

await test('SSE sends heartbeat within 20 seconds', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SSE_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/stream`, {
      signal: controller.signal
    });
    
    assert(response.body !== null, 'Response body should not be null');
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let heartbeatReceived = false;
    const startTime = Date.now();
    
    // Read until we get heartbeat or timeout
    while (!heartbeatReceived && (Date.now() - startTime) < SSE_TIMEOUT_MS - 1000) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'heartbeat') {
              heartbeatReceived = true;
              const elapsed = Date.now() - startTime;
              console.log(`      Heartbeat received after ${elapsed}ms`);
              assert(parsed.payload?.timestamp, 'Heartbeat should have timestamp');
              break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    
    assert(heartbeatReceived, 'Should receive heartbeat within timeout');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
});

// ----------------------------------------------------------------------------
// Suite 4: Health Endpoint
// ----------------------------------------------------------------------------

console.log('\n4️⃣  Health Endpoint');

await test('Health endpoint returns ok:true', async () => {
  const response = await fetch(`${BACKEND_URL}/api/health/notifications`);
  assertEqual(response.status, 200, 'HTTP status');
  
  const data = await response.json();
  assertEqual(data.ok, true, 'ok field');
});

await test('Health endpoint returns SSE config', async () => {
  const response = await fetch(`${BACKEND_URL}/api/health/notifications`);
  const data = await response.json();
  
  assert(data.sse !== undefined, 'Should have sse field');
  assertEqual(data.sse.enabled, true, 'sse.enabled');
  assertEqual(data.sse.heartbeat_interval_sec, 15, 'sse.heartbeat_interval_sec');
});

await test('Health endpoint returns timestamp', async () => {
  const response = await fetch(`${BACKEND_URL}/api/health/notifications`);
  const data = await response.json();
  
  assert(data.time !== undefined, 'Should have time field');
  
  // Validate it's a valid ISO timestamp
  const timestamp = new Date(data.time);
  assert(!isNaN(timestamp.getTime()), 'time should be valid ISO timestamp');
});

// ----------------------------------------------------------------------------
// Results Summary
// ----------------------------------------------------------------------------

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
}

// Run the tests
runTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
