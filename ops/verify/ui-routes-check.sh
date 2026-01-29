#!/usr/bin/env bash
# ops/verify/ui-routes-check.sh
# Verifies key AKIOR UI routes are accessible
# Exit codes: 0 = all checks pass, 1 = failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# Default to localhost if no host provided
HOST="${1:-http://127.0.0.1}"

echo "=== AKIOR UI Routes Check ==="
echo "Target: $HOST"
echo ""

# 1. Check root redirects to login
echo "1. Checking root redirect to /login..."
RESPONSE=$(curl -sI --max-time 5 "$HOST/" 2>/dev/null | head -20)
if echo "$RESPONSE" | grep -qE 'HTTP/1.[01] (307|302|301)'; then
    if echo "$RESPONSE" | grep -qi 'location.*login'; then
        pass "Root redirects to /login"
    else
        warn "Root redirects but not to /login"
        echo "$RESPONSE" | grep -i location || true
    fi
else
    fail "Root does not redirect (expected 307)"
fi

# 2. Check login page loads
echo ""
echo "2. Checking /login page..."
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "$HOST/login" 2>/dev/null)
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "/login returns HTTP $HTTP_CODE"
else
    fail "/login returns HTTP $HTTP_CODE (expected 200)"
fi

# 3. Check menu/dashboard page loads
echo ""
echo "3. Checking /menu page..."
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "$HOST/menu" 2>/dev/null)
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "/menu returns HTTP $HTTP_CODE"
else
    fail "/menu returns HTTP $HTTP_CODE (expected 200)"
fi

# 4. Check settings page loads
echo ""
echo "4. Checking /settings page..."
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "$HOST/settings" 2>/dev/null)
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "/settings returns HTTP $HTTP_CODE"
else
    fail "/settings returns HTTP $HTTP_CODE (expected 200)"
fi

# 5. Check camera page loads
echo ""
echo "5. Checking /camera page..."
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "$HOST/camera" 2>/dev/null)
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "/camera returns HTTP $HTTP_CODE"
else
    fail "/camera returns HTTP $HTTP_CODE (expected 200)"
fi

# 6. Check jarvis/voice assistant page loads
echo ""
echo "6. Checking /jarvis page..."
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "$HOST/jarvis" 2>/dev/null)
if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
    pass "/jarvis returns HTTP $HTTP_CODE"
else
    fail "/jarvis returns HTTP $HTTP_CODE (expected 200)"
fi

# Summary
echo ""
echo "=== Summary ==="
echo -e "${GREEN}All UI routes accessible${NC}"
echo ""
echo "LAN URLs to test in browser:"
echo "  - $HOST/login (landing page)"
echo "  - $HOST/menu (dashboard)"
echo "  - $HOST/settings"
echo "  - $HOST/camera"
echo "  - $HOST/jarvis"
