#!/usr/bin/env bash
# ops/verify/sha-check.sh
# Verifies that deployed AKIOR is running the expected git SHA
# Usage: ./sha-check.sh [host] [expected-sha]
# Exit codes: 0 = match, 1 = mismatch or error

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# Default to akior.local if no host provided
HOST="${1:-https://akior.local}"
EXPECTED_SHA="${2:-}"

echo "=== AKIOR SHA Verification ==="
echo "Target: $HOST"
echo ""

# Fetch health endpoint
echo "1. Fetching /api/health..."
HEALTH_RESPONSE=$(curl -sk --max-time 10 "$HOST/api/health" 2>/dev/null || echo '{"error":"fetch failed"}')

if echo "$HEALTH_RESPONSE" | grep -q '"error"'; then
    fail "Failed to reach health endpoint: $HEALTH_RESPONSE"
fi

# Extract SHA from response
DEPLOYED_SHA=$(echo "$HEALTH_RESPONSE" | grep -o '"gitSha":"[^"]*"' | cut -d'"' -f4)
BUILD_TIME=$(echo "$HEALTH_RESPONSE" | grep -o '"buildTime":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$DEPLOYED_SHA" || "$DEPLOYED_SHA" == "unknown" ]]; then
    warn "Could not determine deployed SHA (build info not available)"
    echo "Full response: $HEALTH_RESPONSE"
    exit 1
fi

echo ""
echo "2. Build Info:"
echo "   Deployed SHA: $DEPLOYED_SHA"
echo "   Build Time:   $BUILD_TIME"

# Get current git SHA from local repo (if available)
LOCAL_SHA=""
if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
    LOCAL_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    echo "   Local SHA:    ${LOCAL_SHA:-'(not in git repo)'}"
fi

echo ""

# Compare with expected SHA if provided
if [[ -n "$EXPECTED_SHA" ]]; then
    echo "3. Comparing with expected SHA: $EXPECTED_SHA"
    if [[ "$DEPLOYED_SHA" == "$EXPECTED_SHA" ]]; then
        pass "Deployed SHA matches expected!"
    else
        fail "SHA mismatch! Deployed: $DEPLOYED_SHA, Expected: $EXPECTED_SHA"
    fi
elif [[ -n "$LOCAL_SHA" ]]; then
    echo "3. Comparing with local HEAD: $LOCAL_SHA"
    if [[ "$DEPLOYED_SHA" == "$LOCAL_SHA" ]]; then
        pass "Deployed SHA matches local HEAD!"
    else
        warn "Deployed SHA differs from local HEAD"
        echo "   This may be expected if you haven't redeployed after commits"
    fi
else
    echo "3. No expected SHA provided and not in git repo - showing info only"
fi

echo ""
echo "=== Summary ==="
echo "Deployed build: $DEPLOYED_SHA ($BUILD_TIME)"
