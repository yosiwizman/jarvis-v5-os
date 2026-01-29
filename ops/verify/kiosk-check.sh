#!/usr/bin/env bash
# ops/verify/kiosk-check.sh
# Verifies AKIOR display/kiosk UI is accessible and health endpoints work
# Exit codes: 0 = all checks pass, 1 = failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "=== AKIOR Kiosk/Display Verification ==="
echo ""

# Default to HTTPS, fall back to HTTP
BASE_URL="${BASE_URL:-https://jarvis.local}"
CURL_OPTS="-sk --max-time 10"

# 1. Check display route
echo "1. Checking display route..."
HTTP_CODE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "${BASE_URL}/display" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "Display route accessible (HTTP $HTTP_CODE)"
elif [[ "$HTTP_CODE" == "000" ]]; then
    warn "Could not connect to ${BASE_URL}/display"
    echo "    Trying HTTP fallback..."
    BASE_URL="http://jarvis.local"
    HTTP_CODE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "${BASE_URL}/display" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
        pass "Display route accessible via HTTP (HTTP $HTTP_CODE)"
    else
        fail "Display route not accessible (HTTP $HTTP_CODE)"
    fi
else
    fail "Display route returned HTTP $HTTP_CODE"
fi

# 2. Check health API
echo ""
echo "2. Checking health API..."
HEALTH_RESPONSE=$(curl $CURL_OPTS "${BASE_URL}/api/health" 2>/dev/null || echo '{"ok":false}')
if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    pass "Health API returns ok: true"
    # Extract uptime if present
    UPTIME=$(echo "$HEALTH_RESPONSE" | grep -oP '"uptime":\s*\K[0-9.]+' || echo "")
    if [[ -n "$UPTIME" ]]; then
        UPTIME_FORMATTED=$(printf "%.0f" "$UPTIME" 2>/dev/null || echo "$UPTIME")
        DAYS=$((UPTIME_FORMATTED / 86400))
        HOURS=$(((UPTIME_FORMATTED % 86400) / 3600))
        echo "    Server uptime: ${DAYS}d ${HOURS}h"
    fi
else
    warn "Health API did not return ok: true"
    echo "    Response: $HEALTH_RESPONSE"
fi

# 3. Check system metrics API
echo ""
echo "3. Checking system metrics API..."
METRICS_RESPONSE=$(curl $CURL_OPTS "${BASE_URL}/api/system/metrics" 2>/dev/null || echo '{}')
if echo "$METRICS_RESPONSE" | grep -q '"cpuLoad"'; then
    pass "System metrics API accessible"
    CPU=$(echo "$METRICS_RESPONSE" | grep -oP '"cpuLoad":\s*\K[0-9.]+' || echo "N/A")
    MEM=$(echo "$METRICS_RESPONSE" | grep -oP '"memoryUsedPct":\s*\K[0-9.]+' || echo "N/A")
    echo "    CPU: ${CPU}%, Memory: ${MEM}%"
else
    warn "System metrics not available (optional)"
fi

# 4. Check backend server health directly
echo ""
echo "4. Checking backend server..."
SERVER_URL="${SERVER_URL:-http://localhost:1234}"
SERVER_HEALTH=$(curl -sk --max-time 5 "${SERVER_URL}/health" 2>/dev/null || echo '{"ok":false}')
if echo "$SERVER_HEALTH" | grep -q '"ok":true'; then
    pass "Backend server healthy"
else
    warn "Backend server not responding at ${SERVER_URL}"
fi

# 5. Get host IP for display URL
echo ""
echo "5. Detecting host IP..."
HOST_IP=$(ip -br a 2>/dev/null | grep UP | grep -v '^lo' | awk '{print $3}' | cut -d/ -f1 | head -1 || echo "")
if [[ -n "$HOST_IP" ]]; then
    pass "Host IP: $HOST_IP"
else
    warn "Could not detect host IP"
    HOST_IP="<host-ip>"
fi

# Summary
echo ""
echo "=== Summary ==="
echo ""
echo -e "${GREEN}Display URLs:${NC}"
echo "  HTTPS: https://jarvis.local/display"
echo "  HTTP:  http://jarvis.local/display"
echo "  IP:    http://${HOST_IP}/display"
echo ""
echo "To open on a dedicated monitor/kiosk:"
echo "  1. Open browser on the display machine"
echo "  2. Navigate to https://jarvis.local/display"
echo "  3. Press F11 or click 'Fullscreen' button"
echo "  4. (Optional) Set browser to start on boot"
echo ""
echo "For Chromium kiosk mode:"
echo "  chromium-browser --kiosk --noerrdialogs https://jarvis.local/display"
echo ""
