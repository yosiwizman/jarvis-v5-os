#!/usr/bin/env bash
# =============================================================================
# check-adguard-ready.sh
# =============================================================================
# Verifies AdGuard Home is fully operational BEFORE disabling router DHCP.
# Run this script to confirm AdGuard can serve DNS and DHCP for the LAN.
#
# Usage:
#   ./scripts/net/check-adguard-ready.sh [OPTIONS]
#
# Options:
#   -s, --server IP    AdGuard server IP (default: 192.168.1.64)
#   -p, --port PORT    AdGuard admin port (default: 3000)
#   -h, --help         Show this help
#
# Exit codes:
#   0 - All checks passed, safe to disable router DHCP
#   1 - One or more checks failed, do NOT disable router DHCP
# =============================================================================

set -euo pipefail

# Default configuration
ADGUARD_IP="${ADGUARD_IP:-192.168.1.64}"
ADGUARD_PORT="${ADGUARD_PORT:-3000}"
DNS_PORT=53
DHCP_PORT=67

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
            ADGUARD_IP="$2"
            shift 2
            ;;
        -p|--port)
            ADGUARD_PORT="$2"
            shift 2
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

echo ""
echo "======================================="
echo "  AdGuard Home Readiness Check"
echo "======================================="
echo ""
echo "Target: ${ADGUARD_IP}:${ADGUARD_PORT}"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Admin UI Reachable
# -----------------------------------------------------------------------------
echo -n "[TEST 1] Admin UI (http://${ADGUARD_IP}:${ADGUARD_PORT}) ... "

if curl -s --connect-timeout 5 "http://${ADGUARD_IP}:${ADGUARD_PORT}/" > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS]${NC}"
    ((PASSED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach AdGuard admin UI"
    echo "         Is the container running? Check: docker ps | grep adguard"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 2: DNS Port Listening
# -----------------------------------------------------------------------------
echo -n "[TEST 2] DNS port (${ADGUARD_IP}:${DNS_PORT}) ... "

if nc -z -w 2 "${ADGUARD_IP}" "${DNS_PORT}" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${NC}"
    ((PASSED++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         DNS port 53 not responding"
    echo "         Check if port 53 is blocked by firewall or systemd-resolved"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 3: DNS Resolution Works
# -----------------------------------------------------------------------------
echo -n "[TEST 3] DNS resolution (akior.local via ${ADGUARD_IP}) ... "

# Try dig first, fall back to nslookup
if command -v dig &> /dev/null; then
    RESOLVED_IP=$(dig +short akior.local @"${ADGUARD_IP}" 2>/dev/null | head -1)
elif command -v nslookup &> /dev/null; then
    RESOLVED_IP=$(nslookup akior.local "${ADGUARD_IP}" 2>/dev/null | grep -A1 "Name:" | grep "Address" | awk '{print $2}' | head -1)
else
    RESOLVED_IP=""
fi

if [[ "${RESOLVED_IP}" == "${ADGUARD_IP}" ]]; then
    echo -e "${GREEN}[PASS]${NC} -> ${RESOLVED_IP}"
    ((PASSED++))
elif [[ -n "${RESOLVED_IP}" ]]; then
    echo -e "${YELLOW}[WARN]${NC} -> ${RESOLVED_IP} (expected ${ADGUARD_IP})"
    echo "         DNS rewrite may not be configured correctly"
    ((WARNINGS++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         akior.local did not resolve"
    echo "         Add DNS rewrite in AdGuard: akior.local -> ${ADGUARD_IP}"
    ((FAILED++))
fi

# -----------------------------------------------------------------------------
# Test 4: DHCP Port Listening (UDP 67)
# -----------------------------------------------------------------------------
echo -n "[TEST 4] DHCP port (${ADGUARD_IP}:${DHCP_PORT}/udp) ... "

# UDP port check is tricky; we'll check if the process is listening locally
# This test is most accurate when run ON the AdGuard server
if nc -zu -w 2 "${ADGUARD_IP}" "${DHCP_PORT}" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${NC}"
    ((PASSED++))
else
    # UDP check often fails from remote; check via API if possible
    DHCP_ENABLED=$(curl -s "http://${ADGUARD_IP}:${ADGUARD_PORT}/control/dhcp/status" 2>/dev/null | grep -o '"enabled":true' || true)
    if [[ -n "${DHCP_ENABLED}" ]]; then
        echo -e "${GREEN}[PASS]${NC} (via API)"
        ((PASSED++))
    else
        echo -e "${YELLOW}[WARN]${NC}"
        echo "         DHCP may not be enabled or port check inconclusive"
        echo "         Verify DHCP is enabled in AdGuard: Settings → DHCP"
        ((WARNINGS++))
    fi
fi

# -----------------------------------------------------------------------------
# Test 5: AdGuard API Health
# -----------------------------------------------------------------------------
echo -n "[TEST 5] AdGuard API status ... "

API_STATUS=$(curl -s --connect-timeout 5 "http://${ADGUARD_IP}:${ADGUARD_PORT}/control/status" 2>/dev/null)

if [[ -n "${API_STATUS}" ]] && echo "${API_STATUS}" | grep -q "running"; then
    VERSION=$(echo "${API_STATUS}" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}[PASS]${NC} (v${VERSION:-unknown})"
    ((PASSED++))
elif [[ -n "${API_STATUS}" ]]; then
    echo -e "${YELLOW}[WARN]${NC} API responded but status unclear"
    ((WARNINGS++))
else
    echo -e "${RED}[FAIL]${NC}"
    echo "         Cannot reach AdGuard API"
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
    echo -e "  Status: ${GREEN}READY${NC}"
    echo "======================================="
    echo ""
    echo -e "${GREEN}✓ Safe to disable router DHCP${NC}"
    echo "  See: docs/ops/adguard-bgw320.md Step 6"
    echo ""
    exit 0
elif [[ ${FAILED} -eq 0 ]]; then
    echo -e "  Status: ${YELLOW}READY WITH WARNINGS${NC}"
    echo "======================================="
    echo ""
    echo -e "${YELLOW}⚠ Review warnings before disabling router DHCP${NC}"
    echo ""
    exit 0
else
    echo -e "  Status: ${RED}NOT READY${NC}"
    echo "======================================="
    echo ""
    echo -e "${RED}✗ DO NOT disable router DHCP yet${NC}"
    echo "  Fix the failed checks first."
    echo ""
    exit 1
fi
