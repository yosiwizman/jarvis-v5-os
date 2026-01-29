#!/bin/bash
# JARVIS Deployment Smoke Test
# 
# Validates that all services are running and healthy.
# Run from the host where Docker is running, or via SSH.
#
# Usage:
#   ./ops/verify/deploy-smoke.sh                    # Run locally on host
#   ssh aifactory-lan 'bash -s' < ops/verify/deploy-smoke.sh  # Run via SSH
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more checks failed

set -euo pipefail

# Configuration
COMPOSE_FILE="${JARVIS_COMPOSE_FILE:-/opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml}"
EDGE_URL="${JARVIS_EDGE_URL:-http://127.0.0.1:3000}"
SERVER_URL="${JARVIS_SERVER_URL:-http://127.0.0.1:1234}"

# Colors (optional, for TTY output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

log_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

log_info() {
    echo -e "  $1"
}

# -----------------------------------------------------------------------------
# Check 1: Docker Compose services running
# -----------------------------------------------------------------------------
echo "=== Docker Compose Status ==="

if ! command -v docker &> /dev/null; then
    log_fail "Docker not found in PATH"
else
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_fail "Compose file not found: $COMPOSE_FILE"
    else
        # Get service status
        SERVICES=$(docker compose -f "$COMPOSE_FILE" ps --format "{{.Name}}:{{.Status}}" 2>/dev/null || echo "")
        
        if [[ -z "$SERVICES" ]]; then
            log_fail "No services found or compose failed"
        else
            # Check each expected service
            for svc in jarvis-caddy jarvis-server jarvis-web; do
                status=$(echo "$SERVICES" | grep "^$svc:" | cut -d: -f2 || echo "")
                if [[ "$status" == *"(healthy)"* ]]; then
                    log_pass "$svc is healthy"
                elif [[ "$status" == *"Up"* ]]; then
                    log_warn "$svc is running but not yet healthy"
                    log_info "Status: $status"
                elif [[ -z "$status" ]]; then
                    log_fail "$svc not found"
                else
                    log_fail "$svc is not healthy: $status"
                fi
            done
        fi
    fi
fi

# -----------------------------------------------------------------------------
# Check 2: Health endpoints via internal URLs
# -----------------------------------------------------------------------------
echo ""
echo "=== Health Endpoints (Internal) ==="

if command -v curl &> /dev/null; then
    # Server health endpoint (direct)
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$SERVER_URL/health" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        log_pass "Server /health returned 200"
    else
        log_fail "Server /health returned $HTTP_CODE (expected 200)"
    fi
else
    log_warn "curl not found, skipping endpoint checks"
fi

# -----------------------------------------------------------------------------
# Check 3: Health endpoints via Caddy (edge)
# -----------------------------------------------------------------------------
echo ""
echo "=== Health Endpoints (Edge/Caddy) ==="

if command -v curl &> /dev/null; then
    # API health through Caddy
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$EDGE_URL/api/health" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        log_pass "Edge /api/health returned 200"
    else
        log_fail "Edge /api/health returned $HTTP_CODE (expected 200)"
    fi
    
    # Web frontend through Caddy (expect 200 or 307 redirect)
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$EDGE_URL/" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "307" ]]; then
        log_pass "Edge / returned $HTTP_CODE (OK)"
    else
        log_fail "Edge / returned $HTTP_CODE (expected 200 or 307)"
    fi
fi

# -----------------------------------------------------------------------------
# Check 4: Container resource usage (informational)
# -----------------------------------------------------------------------------
echo ""
echo "=== Resource Usage (Info) ==="

if command -v docker &> /dev/null; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        jarvis-caddy jarvis-server jarvis-web 2>/dev/null || log_warn "Could not get container stats"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    log_fail "Smoke test FAILED with $FAIL error(s)"
    exit 1
else
    echo ""
    log_pass "Smoke test PASSED"
    exit 0
fi
