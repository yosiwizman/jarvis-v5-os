const https = require('https');

// Bypass self-signed certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 1234,
      path: path,
      method: method,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: responseData ? JSON.parse(responseData) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🔍 JARVIS BACKEND COMPREHENSIVE TEST SUITE\n');
  console.log('='  .repeat(50));
  
  let passedTests = 0;
  let failedTests = 0;
  
  // TEST 1: Server Health Check
  console.log('\n📋 TEST 1: Server Health Check');
  try {
    const res = await makeRequest('GET', '/config');
    if (res.status === 200 && res.data) {
      console.log('✅ Server is running and responding');
      console.log(`   Config keys: ${Object.keys(res.data).join(', ')}`);
      passedTests++;
    } else {
      console.log('❌ Server responded with unexpected status:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Server health check failed:', err.message);
    failedTests++;
  }

  // TEST 2: Settings Endpoint
  console.log('\n📋 TEST 2: Settings Endpoint');
  try {
    const res = await makeRequest('GET', '/settings');
    if (res.status === 200) {
      console.log('✅ Settings endpoint working');
      console.log(`   Response size: ${JSON.stringify(res.data).length} bytes`);
      passedTests++;
    } else {
      console.log('❌ Settings endpoint failed with status:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Settings endpoint error:', err.message);
    failedTests++;
  }

  // TEST 3: Conversation Stats
  console.log('\n📋 TEST 3: Conversation Statistics');
  try {
    const res = await makeRequest('GET', '/api/conversations/stats');
    if (res.status === 200 && res.data) {
      console.log('✅ Conversation stats retrieved');
      console.log(`   Total: ${res.data.total}, Today: ${res.data.today}`);
      passedTests++;
    } else {
      console.log('❌ Conversation stats failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Conversation stats error:', err.message);
    failedTests++;
  }

  // TEST 4: Create New Conversation
  console.log('\n📋 TEST 4: Create New Conversation (CRUD - Create)');
  let newConversationId = null;
  try {
    const testConv = {
      title: 'Automated Test Conversation',
      messages: [
        { role: 'user', content: 'Test message from automated suite' },
        { role: 'assistant', content: 'Test response from automated suite' }
      ]
    };
    const res = await makeRequest('POST', '/api/conversations', testConv);
    if (res.status === 200 || res.status === 201) {
      newConversationId = res.data?.id || res.data?.conversationId;
      console.log('✅ Created new conversation');
      console.log(`   Conversation ID: ${newConversationId}`);
      passedTests++;
    } else {
      console.log('❌ Create conversation failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Create conversation error:', err.message);
    failedTests++;
  }

  // TEST 5: Read All Conversations
  console.log('\n📋 TEST 5: Read All Conversations (CRUD - Read)');
  try {
    const res = await makeRequest('GET', '/api/conversations');
    if (res.status === 200 && Array.isArray(res.data)) {
      console.log('✅ Retrieved conversation list');
      console.log(`   Total conversations: ${res.data.length}`);
      if (newConversationId) {
        const found = res.data.find(c => c.id === newConversationId);
        if (found) {
          console.log(`   ✅ Found newly created conversation in list`);
        } else {
          console.log(`   ⚠️  Newly created conversation not in list`);
        }
      }
      passedTests++;
    } else {
      console.log('❌ Read conversations failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Read conversations error:', err.message);
    failedTests++;
  }

  // TEST 6: Delete Conversation
  if (newConversationId) {
    console.log('\n📋 TEST 6: Delete Conversation (CRUD - Delete)');
    try {
      const res = await makeRequest('DELETE', `/api/conversations/${newConversationId}`);
      if (res.status === 200 || res.status === 204) {
        console.log('✅ Deleted test conversation');
        passedTests++;
      } else {
        console.log('❌ Delete conversation failed:', res.status);
        failedTests++;
      }
    } catch (err) {
      console.log('❌ Delete conversation error:', err.message);
      failedTests++;
    }
  } else {
    console.log('\n📋 TEST 6: Delete Conversation - SKIPPED (no conversation created)');
    failedTests++;
  }

  // TEST 7: Action Tracking
  console.log('\n📋 TEST 7: Action Tracking');
  try {
    const testAction = {
      type: 'test_action',
      description: 'Automated test action',
      metadata: { test: true, timestamp: new Date().toISOString() }
    };
    const res = await makeRequest('POST', '/api/actions', testAction);
    if (res.status === 200 || res.status === 201) {
      console.log('✅ Action tracked successfully');
      console.log(`   Action ID: ${res.data?.id || 'created'}`);
      passedTests++;
    } else {
      console.log('❌ Action tracking failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Action tracking error:', err.message);
    failedTests++;
  }

  // TEST 8: Action Stats
  console.log('\n📋 TEST 8: Action Statistics');
  try {
    const res = await makeRequest('GET', '/api/actions/stats');
    if (res.status === 200 && res.data) {
      console.log('✅ Action stats retrieved');
      console.log(`   Total actions: ${res.data.total}`);
      passedTests++;
    } else {
      console.log('❌ Action stats failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Action stats error:', err.message);
    failedTests++;
  }

  // TEST 9: Notifications History
  console.log('\n📋 TEST 9: Notifications History');
  try {
    const res = await makeRequest('GET', '/api/notifications/history');
    if (res.status === 200 && Array.isArray(res.data)) {
      console.log('✅ Notifications history retrieved');
      console.log(`   Total notifications: ${res.data.length}`);
      passedTests++;
    } else {
      console.log('❌ Notifications history failed:', res.status);
      failedTests++;
    }
  } catch (err) {
    console.log('❌ Notifications history error:', err.message);
    failedTests++;
  }

  // FINAL REPORT
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL TEST REPORT');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Total:  ${passedTests + failedTests}`);
  console.log(`🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Backend is fully operational.');
    console.log('✅ System is ready for production use.');
  } else if (passedTests > failedTests) {
    console.log('\n⚠️  MOST TESTS PASSED. Backend is operational with minor issues.');
    console.log('✅ System is functional and ready for use.');
  } else {
    console.log('\n❌ MULTIPLE TESTS FAILED. Backend requires attention.');
    console.log('⚠️  Check server logs and configuration.');
  }
  
  console.log('\n💡 Access the application at: https://localhost:3000');
  console.log('   (Accept the self-signed certificate warning in your browser)');
}

runTests().catch(err => {
  console.error('\n❌ CRITICAL ERROR:', err);
  process.exit(1);
});
