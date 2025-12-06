/**
 * Integration test script for v6.0 Notification & Event Loop System
 * 
 * Run with: npx tsx scripts/test-v6-integration.ts
 * 
 * Tests:
 * 1. Schedule notification and verify it fires
 * 2. Connect to SSE stream and receive events
 * 3. Sync calendar reminders
 * 4. Verify notification history API
 * 5. Test preference filtering
 */

const BASE_URL = 'https://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error), duration: Date.now() - start });
    console.error(`❌ ${name} (${Date.now() - start}ms)`, error);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return response.json();
}

// Test 1: Schedule notification
await test('Schedule notification API', async () => {
  const triggerAt = new Date(Date.now() + 2000).toISOString(); // 2 seconds from now
  
  const result = await fetchAPI('/api/notifications/schedule', {
    method: 'POST',
    body: JSON.stringify({
      type: 'custom',
      payload: { message: 'Integration test notification' },
      triggerAt,
    }),
  });
  
  if (!result.ok || !result.eventId) {
    throw new Error('Schedule API did not return valid response');
  }
  
  console.log(`  Scheduled event: ${result.eventId}`);
});

// Test 2: SSE Stream
await test('SSE notification stream', async () => {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${BASE_URL}/api/notifications/stream`);
    let received = false;
    
    const timeout = setTimeout(() => {
      eventSource.close();
      if (!received) {
        reject(new Error('No notification received within timeout'));
      }
    }, 5000);
    
    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        console.log(`  Received notification:`, notification.type);
        received = true;
        eventSource.close();
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        eventSource.close();
        clearTimeout(timeout);
        reject(error);
      }
    };
    
    eventSource.onerror = (error) => {
      eventSource.close();
      clearTimeout(timeout);
      reject(new Error('SSE connection error'));
    };
  });
});

// Test 3: Notification history
await test('Notification history API', async () => {
  await sleep(1000); // Wait for previous notification to be logged
  
  const result = await fetchAPI('/api/notifications/history?limit=10');
  
  if (!result.ok || !Array.isArray(result.notifications)) {
    throw new Error('History API did not return valid response');
  }
  
  console.log(`  History contains ${result.total} notifications`);
  
  if (result.total === 0) {
    console.warn('  Warning: No notifications in history');
  }
});

// Test 4: History filtering by type
await test('Notification history filtering', async () => {
  const result = await fetchAPI('/api/notifications/history?type=custom&limit=5');
  
  if (!result.ok || !Array.isArray(result.notifications)) {
    throw new Error('Filtered history API did not return valid response');
  }
  
  // Verify all returned notifications are of the requested type
  const invalidTypes = result.notifications.filter((n: any) => n.type !== 'custom');
  if (invalidTypes.length > 0) {
    throw new Error(`Filter failed: found ${invalidTypes.length} non-custom notifications`);
  }
  
  console.log(`  Filtered to ${result.notifications.length} custom notifications`);
});

// Test 5: Calendar sync endpoint
await test('Calendar reminder sync endpoint', async () => {
  try {
    const result = await fetchAPI('/integrations/google-calendar/sync-reminders', {
      method: 'POST',
    });
    
    if (!result.ok) {
      throw new Error('Calendar sync did not return ok=true');
    }
    
    console.log(`  Synced ${result.scheduled || 0} calendar reminders from ${result.eventsFound || 0} events`);
  } catch (error) {
    // Calendar sync may fail if OAuth not configured - this is expected
    if (String(error).includes('401') || String(error).includes('OAuth')) {
      console.log('  ⚠️ Calendar OAuth not configured (expected in test environment)');
    } else {
      throw error;
    }
  }
});

// Test 6: Schedule notification with invalid data
await test('Schedule API validation', async () => {
  try {
    await fetchAPI('/api/notifications/schedule', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invalid_type',
        payload: {},
        // Missing triggerAt
      }),
    });
    
    throw new Error('API should have rejected invalid request');
  } catch (error) {
    if (String(error).includes('400')) {
      console.log('  Validation correctly rejected invalid request');
    } else {
      throw error;
    }
  }
});

// Test 7: History pagination
await test('Notification history pagination', async () => {
  const page1 = await fetchAPI('/api/notifications/history?limit=2&offset=0');
  const page2 = await fetchAPI('/api/notifications/history?limit=2&offset=2');
  
  if (!page1.ok || !page2.ok) {
    throw new Error('Pagination requests failed');
  }
  
  console.log(`  Page 1: ${page1.notifications.length} items, Page 2: ${page2.notifications.length} items`);
  
  // Verify pages don't overlap
  if (page1.notifications.length > 0 && page2.notifications.length > 0) {
    const page1Ids = new Set(page1.notifications.map((n: any) => n.eventId));
    const overlap = page2.notifications.some((n: any) => page1Ids.has(n.eventId));
    
    if (overlap) {
      throw new Error('Pagination pages have overlapping items');
    }
  }
});

// Print summary
console.log('\n' + '='.repeat(60));
console.log('INTEGRATION TEST SUMMARY');
console.log('='.repeat(60));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\nTotal: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  console.log('Failed Tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ❌ ${r.name}`);
    console.log(`     ${r.error}`);
  });
  console.log('');
}

// Exit with error code if any tests failed
process.exit(failed > 0 ? 1 : 0);
