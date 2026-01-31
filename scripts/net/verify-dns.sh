#!/usr/bin/env bash
#
# verify-dns.sh - Verify AKIOR LAN DNS resolution and deployment
#
# Usage:
#   ./verify-dns.sh                                    # Basic verification
#   ./verify-dns.sh -i 192.168.1.100                   # With expected IP
#   ./verify-dns.sh -i 192.168.1.100 -s 626dcdf        # With expected IP and SHA
#   AKIOR_EXPECTED_IP=192.168.1.100 ./verify-dns.sh    # Via env vars
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Defaults
EXPECTED_IP="${AKIOR_EXPECTED_IP:-}"
EXPECTED_SHA="${AKIOR_EXPECTED_SHA:-}"
BASE_URL="${AKIOR_BASE_URL:-https://akior.local}"
HOSTNAME="akior.local"

# Parse args
while getopts "i:s:u:h" opt; do
    case $opt in
        i) EXPECTED_IP="$OPTARG" ;;
        s) EXPECTED_SHA="$OPTARG" ;;
        u) BASE_URL="$OPTARG" ;;
        h)
            echo "Usage: $0 [-i expected_ip] [-s expected_sha] [-u base_url]"
            echo ""
            echo "Options:"
            echo "  -i  Expected IP address for akior.local"
            echo "  -s  Expected git SHA for the deployment"
            echo "  -u  Base URL (default: https://akior.local)"
            echo ""
            echo "Environment variables:"
            echo "  AKIOR_EXPECTED_IP   Same as -i"
            echo "  AKIOR_EXPECTED_SHA  Same as -s"
            echo "  AKIOR_BASE_URL      Same as -u"
            exit 0
            ;;
        \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
    esac
done

# Functions
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ALL_PASSED=false; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

ALL_PASSED=true
RESOLVED_IP=""
SERVER_SHA=""

echo -e "\n${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  AKIOR LAN DNS Verification${NC}"
echo -e "${MAGENTA}========================================${NC}\n"

# ==============================================
# TEST 1: DNS Resolution
# ==============================================
echo -e "Test 1: DNS Resolution"
echo "---------------------------------------"

if command -v getent &>/dev/null; then
    # Linux
    RESOLVED_IP=$(getent hosts "$HOSTNAME" 2>/dev/null | awk '{print $1}' | head -1) || true
elif command -v dscacheutil &>/dev/null; then
    # macOS
    RESOLVED_IP=$(dscacheutil -q host -a name "$HOSTNAME" 2>/dev/null | grep "ip_address" | awk '{print $2}' | head -1) || true
else
    # Fallback to ping
    RESOLVED_IP=$(ping -c 1 "$HOSTNAME" 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1) || true
fi

if [[ -z "$RESOLVED_IP" ]]; then
    fail "DNS resolution failed for $HOSTNAME"
else
    info "akior.local resolves to: $RESOLVED_IP"
    
    if [[ -z "$EXPECTED_IP" ]]; then
        warn "No expected IP provided (-i or AKIOR_EXPECTED_IP)"
    elif [[ "$RESOLVED_IP" == "$EXPECTED_IP" ]]; then
        pass "DNS resolves to expected IP: $RESOLVED_IP"
    else
        fail "DNS mismatch! Expected: $EXPECTED_IP, Got: $RESOLVED_IP"
        echo -e "       ${YELLOW}This means akior.local points to the WRONG host.${NC}"
        echo -e "       ${YELLOW}Fix: Update router DNS or hosts file. See docs/ops/dns-setup.md${NC}"
    fi
fi

echo ""

# ==============================================
# TEST 2: /api/health/build Endpoint
# ==============================================
echo -e "Test 2: Build Endpoint (/api/health/build)"
echo "---------------------------------------"

BUILD_ENDPOINT="$BASE_URL/api/health/build"

# curl with insecure flag for self-signed certs
if BUILD_RESPONSE=$(curl -sk --connect-timeout 10 "$BUILD_ENDPOINT" 2>/dev/null); then
    # Parse JSON (requires jq or fallback to grep)
    if command -v jq &>/dev/null; then
        OK_STATUS=$(echo "$BUILD_RESPONSE" | jq -r '.ok // empty')
        SERVER_SHA=$(echo "$BUILD_RESPONSE" | jq -r '.git_sha // empty')
        BUILD_TIME=$(echo "$BUILD_RESPONSE" | jq -r '.build_time // empty')
    else
        # Fallback: simple grep parsing
        OK_STATUS=$(echo "$BUILD_RESPONSE" | grep -o '"ok":true' && echo "true" || echo "")
        SERVER_SHA=$(echo "$BUILD_RESPONSE" | grep -oE '"git_sha":"[^"]+"' | cut -d'"' -f4)
        BUILD_TIME=$(echo "$BUILD_RESPONSE" | grep -oE '"build_time":"[^"]+"' | cut -d'"' -f4)
    fi
    
    if [[ "$OK_STATUS" == "true" ]]; then
        pass "/api/health/build returns ok=true"
        info "Server SHA: $SERVER_SHA"
        info "Build Time: $BUILD_TIME"
        
        if [[ -z "$EXPECTED_SHA" ]]; then
            warn "No expected SHA provided (-s or AKIOR_EXPECTED_SHA)"
        elif [[ "$SERVER_SHA" == "$EXPECTED_SHA" ]]; then
            pass "SHA matches expected: $SERVER_SHA"
        else
            fail "SHA mismatch! Expected: $EXPECTED_SHA, Got: $SERVER_SHA"
            echo -e "       ${YELLOW}The server is running a DIFFERENT build than expected.${NC}"
            echo -e "       ${YELLOW}Fix: Redeploy using deploy/local/redeploy.ps1${NC}"
        fi
    else
        fail "/api/health/build did not return ok=true"
    fi
else
    fail "Build endpoint request failed"
    echo -e "       ${YELLOW}This could mean:${NC}"
    echo -e "       ${YELLOW}- akior.local points to wrong/unreachable host${NC}"
    echo -e "       ${YELLOW}- Server is down or not responding${NC}"
    echo -e "       ${YELLOW}- SSL/TLS certificate issue${NC}"
fi

echo ""

# ==============================================
# TEST 3: /settings Page Loads
# ==============================================
echo -e "Test 3: Settings Page (/settings)"
echo "---------------------------------------"

SETTINGS_URL="$BASE_URL/settings"

if SETTINGS_RESPONSE=$(curl -sk --connect-timeout 15 "$SETTINGS_URL" 2>/dev/null); then
    if echo "$SETTINGS_RESPONSE" | grep -q "Cannot read properties of undefined"; then
        fail "Settings page crashed with 'Cannot read properties of undefined'"
    elif echo "$SETTINGS_RESPONSE" | grep -q "Application error"; then
        fail "Settings page shows 'Application error'"
    else
        pass "Settings page loads successfully"
        
        if echo "$SETTINGS_RESPONSE" | grep -qE "server-build-sha|Build:"; then
            info "Page contains build info display"
        fi
    fi
else
    fail "Settings page request failed"
fi

echo ""

# ==============================================
# TEST 4: Network Connectivity
# ==============================================
echo -e "Test 4: Network Connectivity"
echo "---------------------------------------"

if [[ -n "$RESOLVED_IP" ]]; then
    if ping -c 1 -W 2 "$RESOLVED_IP" &>/dev/null; then
        LATENCY=$(ping -c 1 "$RESOLVED_IP" 2>/dev/null | grep -oE 'time=[0-9.]+' | cut -d= -f2 || echo "?")
        pass "Host $RESOLVED_IP is reachable (${LATENCY}ms)"
    else
        fail "Host $RESOLVED_IP is not reachable"
    fi
else
    warn "Skipping connectivity test (no resolved IP)"
fi

# ==============================================
# Summary
# ==============================================
echo -e "\n${MAGENTA}========================================${NC}"
if $ALL_PASSED; then
    echo -e "${GREEN}  All Tests Passed!${NC}"
    echo -e "${MAGENTA}========================================${NC}"
    echo ""
    echo "  akior.local is correctly configured."
    echo "  Resolved IP: $RESOLVED_IP"
    [[ -n "$SERVER_SHA" ]] && echo "  Server SHA:  $SERVER_SHA"
    exit 0
else
    echo -e "${RED}  Some Tests Failed!${NC}"
    echo -e "${MAGENTA}========================================${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Check docs/ops/dns-setup.md for DNS configuration"
    echo "  2. Check docs/runbooks/deploy-drift.md for deployment issues"
    echo "  3. Run deploy/local/redeploy.ps1 if SHA mismatch"
    exit 1
fi
