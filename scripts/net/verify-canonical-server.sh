#!/usr/bin/env bash
# =============================================================================
# verify-canonical-server.sh
# =============================================================================
# Verifies the canonical AKIOR server is deployed correctly and healthy.
# Run this BEFORE updating DNS to point to a new server.
#
# Usage:
#   ./scripts/net/verify-canonical-server.sh [OPTIONS]
#
# Options:
#   -s, --server IP    Canonical server IP (default: 192.168.1.64)
#   -p, --port PORT    HTTP port (default: 80)
#   --https            Use HTTPS instead of HTTP
#   -h, --help         Show this help
#
# Exit codes:
#   0 - All checks passed, safe to update DNS
#   1 - One or more checks failed, do NOT update DNS
# =============================================================================

set -euo pipefail

# Default configuration
SERVER="${SERVER:-192.168.1.64}"
PORT="${PORT:-80}"
USE_HTTPS=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            SERVER="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        --https)
            USE_HTTPS=true
            shift
            ;;
        -h|--help)
            head -25 "$0" | tail -20
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build base URL
if [ "$USE_HTTPS" = true ]; then
    PROTOCOL="https"
    CURL_OPTS="-k" # Skip cert validation for self-signed
else
    PROTOCOL="http"
    CURL_OPTS=""
fi
BASE_URL="${PROTOCOL}://${SERVER}:${PORT}"

echo ""
echo "======================================="
echo "  Canonical Server Verification"
echo "======================================="
echo ""
echo "Target: ${BASE_URL}"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Build Endpoint
# -----------------------------------------------------------------------------
echo -n "[TEST 1] Build endpoint (/api/health/build) ... "

BUILD_RESPONSE=$(curl -s $CURL_OPTS --connect-timeout 10 "${BASE_URL}/api/health/build" 2>/dev/null || echo "CURL_FAILED")

if [[ "$BUILD_RESPONSE" == "CURL_FAILED" ]]; then
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach build endpoint"
    ((FAILED++))
elif echo "$BUILD_RESPONSE" | grep -q '"ok":true'; then
    SHA=$(echo "$BUILD_RESPONSE" | grep -o '"git_sha":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}[PASS]${NC} SHA: ${SHA}"
    ((PASSED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         Response missing ok or git_sha"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 2: Settings Contract
# -----------------------------------------------------------------------------
echo -n "[TEST 2] Settings contract (/api/settings) ... "

SETTINGS_RESPONSE=$(curl -s $CURL_OPTS --connect-timeout 10 "${BASE_URL}/api/settings" 2>/dev/null || echo "CURL_FAILED")

if [[ "$SETTINGS_RESPONSE" == "CURL_FAILED" ]]; then
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach settings endpoint"
    ((FAILED++))
elif echo "$SETTINGS_RESPONSE" | grep -q '"weather"'; then
    WEATHER_ENABLED=$(echo "$SETTINGS_RESPONSE" | grep -o '"weather":{[^}]*"enabled":[^,}]*' | grep -o 'enabled":[^,}]*' | cut -d':' -f2)
    echo -e "${GREEN}[PASS]${NC} (integrations.weather present, enabled=${WEATHER_ENABLED})"
    ((PASSED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         integrations.weather is missing! Settings contract violated."
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 3: Notifications Stream (SSE)
# -----------------------------------------------------------------------------
echo -n "[TEST 3] Notifications stream (/api/notifications/stream) ... "

# Check if endpoint responds with correct content-type
STREAM_HEADERS=$(curl -s $CURL_OPTS -I --connect-timeout 5 -m 5 "${BASE_URL}/api/notifications/stream" 2>/dev/null || echo "CURL_FAILED")

if [[ "$STREAM_HEADERS" == "CURL_FAILED" ]]; then
    echo -e "${YELLOW}[WARN]${NC}"
    echo "         SSE check inconclusive (connection issue)"
    ((WARNINGS++))
elif echo "$STREAM_HEADERS" | grep -qi "text/event-stream"; then
    echo -e "${GREEN}[PASS]${NC} (Content-Type: text/event-stream)"
    ((PASSED++))
elif echo "$STREAM_HEADERS" | grep -q "404"; then
    echo -e "${RED}[FAIL]${NC}"
    echo "         404 Not Found - route mismatch (check Caddy/server prefix)"
    ((FAILED++))
else
    echo -e "${YELLOW}[WARN]${NC}"
    echo "         SSE responded but Content-Type unclear"
    ((WARNINGS++))
fi

# -----------------------------------------------------------------------------
# Test 4: Settings Page (HTML)
# -----------------------------------------------------------------------------
echo -n "[TEST 4] Settings page (/settings) ... "

SETTINGS_PAGE=$(curl -s $CURL_OPTS -w "%{http_code}" -o /dev/null --connect-timeout 10 "${BASE_URL}/settings" 2>/dev/null || echo "000")

if [[ "$SETTINGS_PAGE" == "200" ]]; then
    echo -e "${GREEN}[PASS]${NC}"
    ((PASSED++))
elif [[ "$SETTINGS_PAGE" == "000" ]]; then
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach settings page"
    ((FAILED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         Status: ${SETTINGS_PAGE}"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 5: Health Endpoint
# -----------------------------------------------------------------------------
echo -n "[TEST 5] Health endpoint (/api/health) ... "

HEALTH_RESPONSE=$(curl -s $CURL_OPTS --connect-timeout 10 "${BASE_URL}/api/health" 2>/dev/null || echo "CURL_FAILED")

if [[ "$HEALTH_RESPONSE" == "CURL_FAILED" ]]; then
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach health endpoint"
    ((FAILED++))
elif echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    UPTIME=$(echo "$HEALTH_RESPONSE" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)
    UPTIME_MIN=$(echo "scale=1; $UPTIME / 60" | bc 2>/dev/null || echo "$UPTIME")
    echo -e "${GREEN}[PASS]${NC} (uptime: ${UPTIME_MIN} min)"
    ((PASSED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         Health check returned ok=false"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "======================================="
TOTAL=$((PASSED + FAILED + WARNINGS))
echo "  Results: ${PASSED}/${TOTAL} passed"

if [[ ${WARNINGS} -gt 0 ]]; then
    echo -e "  Warnings: ${YELLOW}${WARNINGS}${NC}"
fi

if [[ ${FAILED} -eq 0 && ${WARNINGS} -eq 0 ]]; then
    echo -e "  Status: ${GREEN}HEALTHY${NC}"
    echo "======================================="
    echo ""
    echo -e "${GREEN}Canonical server is healthy.${NC}"
    echo "  Safe to update DNS: akior.local -> ${SERVER}"
    echo ""
    exit 0
elif [[ ${FAILED} -eq 0 ]]; then
    echo -e "  Status: ${YELLOW}HEALTHY WITH WARNINGS${NC}"
    echo "======================================="
    echo ""
    echo -e "${YELLOW}Review warnings before updating DNS.${NC}"
    echo ""
    exit 0
else
    echo -e "  Status: ${RED}UNHEALTHY${NC}"
    echo "======================================="
    echo ""
    echo -e "${RED}DO NOT update DNS until issues are fixed.${NC}"
    echo "  Fix the failed checks, then re-run this script."
    echo ""
    exit 1
fi
