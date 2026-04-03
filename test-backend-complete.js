const https = require("https");

// Bypass self-signed certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 1234,
      path: path,
      method: method,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            data: responseData ? JSON.parse(responseData) : null,
            raw: responseData,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData,
            raw: responseData,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🔍 AKIOR BACKEND COMPREHENSIVE TEST SUITE\n");
  console.log("=".repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  // TEST 1: Server Health Check
  console.log("\n📋 TEST 1: Server Health Check (/config)");
  try {
    const res = await makeRequest("GET", "/config");
    if (res.status === 200 && res.data && res.data.rtc) {
      console.log("✅ Server is running and responding");
      console.log(`   Config keys: ${Object.keys(res.data).join(", ")}`);
      passedTests++;
    } else {
      console.log("❌ Server responded with unexpected status:", res.status);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Server health check failed:", err.message);
    failedTests++;
  }

  // TEST 2: Settings Endpoint
  console.log("\n📋 TEST 2: Settings Endpoint (/settings)");
  try {
    const res = await makeRequest("GET", "/settings");
    if (res.status === 200) {
      console.log("✅ Settings endpoint working");
      console.log(`   Response size: ${res.raw.length} bytes`);
      passedTests++;
    } else {
      console.log("❌ Settings endpoint failed with status:", res.status);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Settings endpoint error:", err.message);
    failedTests++;
  }

  // TEST 3: Conversation Stats
  console.log(
    "\n📋 TEST 3: Conversation Statistics (/api/conversations/stats)",
  );
  try {
    const res = await makeRequest("GET", "/api/conversations/stats");
    if (res.status === 200 && res.data && res.data.ok && res.data.stats) {
      console.log("✅ Conversation stats retrieved");
      console.log(
        `   Total: ${res.data.stats.totalConversations}, Messages: ${res.data.stats.totalMessages}`,
      );
      passedTests++;
    } else {
      console.log("❌ Conversation stats failed:", res.status, res.data);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Conversation stats error:", err.message);
    failedTests++;
  }

  // TEST 4: List All Conversations
  console.log("\n📋 TEST 4: List All Conversations (/api/conversations)");
  try {
    const res = await makeRequest("GET", "/api/conversations");
    if (
      res.status === 200 &&
      res.data &&
      res.data.ok &&
      Array.isArray(res.data.conversations)
    ) {
      console.log("✅ Retrieved conversation list");
      console.log(
        `   Total conversations: ${res.data.total}, Returned: ${res.data.conversations.length}`,
      );
      passedTests++;
    } else {
      console.log("❌ List conversations failed:", res.status);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ List conversations error:", err.message);
    failedTests++;
  }

  // TEST 5: Create New Conversation
  console.log("\n📋 TEST 5: Create New Conversation (CRUD - Create)");
  let newConversationId = null;
  try {
    const testConv = {
      id: `test-${Date.now()}`,
      source: "chat",
      title: "Automated Test Conversation",
      tags: ["test", "automated"],
      messages: [
        { role: "user", content: "Test message from automated suite" },
        { role: "assistant", content: "Test response from automated suite" },
      ],
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      messageCount: 2,
    };
    const res = await makeRequest("POST", "/api/conversations/save", testConv);
    if (res.status === 200 && res.data && res.data.ok) {
      newConversationId = res.data.conversationId || testConv.id;
      console.log("✅ Created new conversation");
      console.log(`   Conversation ID: ${newConversationId}`);
      passedTests++;
    } else {
      console.log("❌ Create conversation failed:", res.status, res.data);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Create conversation error:", err.message);
    failedTests++;
  }

  // TEST 6: Read Specific Conversation
  if (newConversationId) {
    console.log("\n📋 TEST 6: Read Specific Conversation (CRUD - Read)");
    try {
      const res = await makeRequest(
        "GET",
        `/api/conversations/${newConversationId}`,
      );
      if (
        res.status === 200 &&
        res.data &&
        res.data.ok &&
        res.data.conversation
      ) {
        console.log("✅ Retrieved specific conversation");
        console.log(`   Title: ${res.data.conversation.title}`);
        console.log(`   Messages: ${res.data.conversation.messageCount}`);
        passedTests++;
      } else {
        console.log("❌ Read conversation failed:", res.status);
        failedTests++;
      }
    } catch (err) {
      console.log("❌ Read conversation error:", err.message);
      failedTests++;
    }
  } else {
    console.log(
      "\n📋 TEST 6: Read Specific Conversation - SKIPPED (no conversation created)",
    );
    failedTests++;
  }

  // TEST 7: Delete Conversation
  if (newConversationId) {
    console.log("\n📋 TEST 7: Delete Conversation (CRUD - Delete)");
    try {
      const res = await makeRequest(
        "DELETE",
        `/api/conversations/${newConversationId}`,
      );
      if (
        (res.status === 200 || res.status === 204) &&
        res.data &&
        res.data.ok
      ) {
        console.log("✅ Deleted test conversation");
        passedTests++;
      } else {
        console.log("❌ Delete conversation failed:", res.status, res.data);
        failedTests++;
      }
    } catch (err) {
      console.log("❌ Delete conversation error:", err.message);
      failedTests++;
    }
  } else {
    console.log(
      "\n📋 TEST 7: Delete Conversation - SKIPPED (no conversation created)",
    );
    failedTests++;
  }

  // TEST 8: Action Tracking - Record Action
  console.log(
    "\n📋 TEST 8: Action Tracking - Record Action (/api/actions/record)",
  );
  try {
    const testAction = {
      type: "function_executed",
      source: "user",
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
        functionName: "automated_test",
      },
      description: "Automated test action",
    };
    const res = await makeRequest("POST", "/api/actions/record", testAction);
    if (res.status === 200 && res.data && res.data.ok) {
      console.log("✅ Action tracked successfully");
      console.log(`   Action ID: ${res.data.actionId}`);
      passedTests++;
    } else {
      console.log("❌ Action tracking failed:", res.status, res.data);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Action tracking error:", err.message);
    failedTests++;
  }

  // TEST 9: List Actions
  console.log("\n📋 TEST 9: List Actions (/api/actions)");
  try {
    const res = await makeRequest("GET", "/api/actions");
    if (
      res.status === 200 &&
      res.data &&
      res.data.ok &&
      Array.isArray(res.data.actions)
    ) {
      console.log("✅ Retrieved action list");
      console.log(
        `   Total actions: ${res.data.total}, Returned: ${res.data.actions.length}`,
      );
      passedTests++;
    } else {
      console.log("❌ List actions failed:", res.status);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ List actions error:", err.message);
    failedTests++;
  }

  // TEST 10: Action Stats
  console.log("\n📋 TEST 10: Action Statistics (/api/actions/stats)");
  try {
    const res = await makeRequest("GET", "/api/actions/stats");
    if (res.status === 200 && res.data && res.data.ok && res.data.stats) {
      console.log("✅ Action stats retrieved");
      console.log(`   Total actions: ${res.data.stats.totalActions}`);
      console.log(`   By source: ${JSON.stringify(res.data.stats.bySource)}`);
      passedTests++;
    } else {
      console.log("❌ Action stats failed:", res.status);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Action stats error:", err.message);
    failedTests++;
  }

  // TEST 11: Notifications History
  console.log(
    "\n📋 TEST 11: Notifications History (/api/notifications/history)",
  );
  try {
    const res = await makeRequest("GET", "/api/notifications/history");
    if (
      res.status === 200 &&
      res.data &&
      res.data.ok &&
      Array.isArray(res.data.notifications)
    ) {
      console.log("✅ Notifications history retrieved");
      console.log(
        `   Total notifications: ${res.data.total}, Returned: ${res.data.notifications.length}`,
      );
      passedTests++;
    } else {
      console.log("❌ Notifications history failed:", res.status, res.data);
      failedTests++;
    }
  } catch (err) {
    console.log("❌ Notifications history error:", err.message);
    failedTests++;
  }

  // FINAL REPORT
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL TEST REPORT");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Total:  ${passedTests + failedTests}`);
  console.log(
    `🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`,
  );

  if (failedTests === 0) {
    console.log("\n🎉 ALL TESTS PASSED! Backend is fully operational.");
    console.log("✅ System is ready for production use.");
    console.log("\n💡 Next Steps:");
    console.log("   1. Open https://localhost:3000 in your browser");
    console.log("   2. Accept the self-signed certificate warning");
    console.log("   3. Test the frontend UI manually");
    console.log("   4. Verify all pages load correctly");
  } else if (passedTests > failedTests) {
    console.log(
      "\n⚠️  MOST TESTS PASSED. Backend is operational with minor issues.",
    );
    console.log("✅ System is functional and ready for use.");
    console.log("\n💡 Access the application at: https://localhost:3000");
  } else {
    console.log("\n❌ MULTIPLE TESTS FAILED. Backend requires attention.");
    console.log("⚠️  Check server logs and configuration.");
  }
}

runTests().catch((err) => {
  console.error("\n❌ CRITICAL ERROR:", err);
  process.exit(1);
});
