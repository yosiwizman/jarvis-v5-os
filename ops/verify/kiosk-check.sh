#!/usr/bin/env bash
# ops/verify/kiosk-check.sh
# Verifies AKIOR kiosk service, processes, and key endpoints.
# Exit codes: 0 = all checks pass, 1 = failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "=== AKIOR Kiosk Verification ==="
echo ""

BASE_URL="${BASE_URL:-https://akior.local}"
CURL_OPTS="-sk --max-time 10"

echo "1) systemd service state..."
if systemctl is-active --quiet akior-kiosk.service; then
  pass "akior-kiosk.service is active"
else
  fail "akior-kiosk.service is not active"
fi

echo ""
echo "2) Processes (Xorg/openbox/chromium)..."
if ps aux | egrep "Xorg|openbox|chromium" | grep -v egrep > /dev/null; then
  pass "Processes present (see below)"
  ps aux | egrep "Xorg|openbox|chromium" | grep -v egrep
else
  fail "No Xorg/openbox/chromium processes found"
fi

echo ""
echo "3) Kiosk URL check (${BASE_URL}/menu)..."
HTTP_CODE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "${BASE_URL}/menu" || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
  pass "Menu reachable (HTTP $HTTP_CODE)"
else
  fail "Menu not reachable (HTTP $HTTP_CODE)"
fi

echo ""
echo "4) API /api/health/build ..."
HTTP_CODE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health/build" || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
  pass "/api/health/build reachable (HTTP $HTTP_CODE)"
else
  warn "/api/health/build returned HTTP $HTTP_CODE"
fi

echo ""
echo "5) API /api/ops/drift ..."
HTTP_CODE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "${BASE_URL}/api/ops/drift" || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
  pass "/api/ops/drift reachable (HTTP $HTTP_CODE)"
else
  warn "/api/ops/drift returned HTTP $HTTP_CODE"
fi

echo ""
pass "Kiosk verification completed (VT7 should show AKIOR menu; Ctrl+Alt+F7)"
