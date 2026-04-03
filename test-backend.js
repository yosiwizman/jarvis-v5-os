const https = require("https");

// Bypass self-signed certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const endpoints = [
  "/config",
  "/settings",
  "/api/conversations",
  "/api/conversations/stats",
  "/api/actions",
  "/api/actions/stats",
  "/api/notifications/history",
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: 1234,
      path: endpoint,
      method: "GET",
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          endpoint,
          status: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          dataLength: data.length,
        });
      });
    });

    req.on("error", (error) => {
      resolve({
        endpoint,
        status: "ERROR",
        success: false,
        error: error.message,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        endpoint,
        status: "TIMEOUT",
        success: false,
        error: "Request timeout",
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log("🔍 Testing AKIOR Backend APIs...\n");

  const results = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);

    const icon = result.success ? "✅" : "❌";
    const status = result.status;
    const extra = result.error
      ? ` - ${result.error}`
      : result.dataLength
        ? ` (${result.dataLength} bytes)`
        : "";

    console.log(`${icon} ${endpoint.padEnd(35)} [${status}]${extra}`);
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} tests`,
  );

  if (passed === results.length) {
    console.log("✅ All backend tests passed!");
  } else if (passed > 0) {
    console.log(
      "⚠️  Some backend tests passed, but manual verification recommended",
    );
  } else {
    console.log("❌ All backend tests failed - check if server is running");
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite error:", err);
  process.exit(1);
});
