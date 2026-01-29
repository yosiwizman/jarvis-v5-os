#!/usr/bin/env bash
# ops/verify/lan-ports-check.sh
# Verifies AKIOR LAN ports (80, 443) are listening and HTTPS is working
# Run on the host machine after deployment
# Exit codes: 0 = all checks pass, 1 = failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }

echo "=== AKIOR LAN Ports & HTTPS Check ==="
echo ""

# 1. Check Docker containers
echo "1. Checking Docker containers..."
if docker ps --format '{{.Names}}' | grep -q jarvis-caddy; then
    STATUS=$(docker inspect jarvis-caddy --format '{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
    if [[ "$STATUS" == "healthy" ]]; then
        pass "jarvis-caddy is running and healthy"
    else
        warn "jarvis-caddy is running but status: $STATUS"
    fi
else
    fail "jarvis-caddy container not running"
fi

# 2. Check port 80
echo ""
echo "2. Checking port 80 (HTTP)..."
if ss -lntp 2>/dev/null | grep -q ':80\b'; then
    BINDING=$(ss -lntp 2>/dev/null | grep ':80\b' | awk '{print $4}' | head -1)
    if echo "$BINDING" | grep -qE '^(\*|0\.0\.0\.0):80'; then
        pass "Port 80 listening on all interfaces ($BINDING)"
    else
        warn "Port 80 listening but may be restricted: $BINDING"
    fi
else
    fail "Port 80 NOT listening - HTTP will not work"
fi

# 3. Check port 443
echo ""
echo "3. Checking port 443 (HTTPS)..."
if ss -lntp 2>/dev/null | grep -q ':443\b'; then
    BINDING=$(ss -lntp 2>/dev/null | grep ':443\b' | awk '{print $4}' | head -1)
    if echo "$BINDING" | grep -qE '^(\*|0\.0\.0\.0):443'; then
        pass "Port 443 listening on all interfaces ($BINDING)"
    else
        warn "Port 443 listening but may be restricted: $BINDING"
    fi
else
    fail "Port 443 NOT listening - HTTPS will not work"
    echo ""
    echo "Fix: Pull latest code and restart containers:"
    echo "  git pull origin main"
    echo "  docker compose -f deploy/compose.jarvis.yml down"
    echo "  docker compose -f deploy/compose.jarvis.yml up -d"
fi

# 4. Test HTTP
echo ""
echo "4. Testing HTTP on localhost..."
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 http://localhost/ 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|307|308)$ ]]; then
    pass "HTTP localhost responds (HTTP $HTTP_CODE)"
else
    warn "HTTP localhost returned $HTTP_CODE"
fi

# 5. Test HTTPS
echo ""
echo "5. Testing HTTPS on localhost..."
HTTPS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 https://localhost/ 2>/dev/null || echo "000")
if [[ "$HTTPS_CODE" =~ ^(200|307|308)$ ]]; then
    pass "HTTPS localhost responds (HTTP $HTTPS_CODE)"
else
    warn "HTTPS localhost returned $HTTPS_CODE"
fi

# 6. Get host IP
echo ""
echo "6. Detecting host IP..."
HOST_IP=$(ip -br a 2>/dev/null | grep UP | grep -v '^lo' | awk '{print $3}' | cut -d/ -f1 | head -1 || hostname -I | awk '{print $1}')
if [[ -n "$HOST_IP" ]]; then
    pass "Host IP: $HOST_IP"
else
    warn "Could not detect host IP"
    HOST_IP="<host-ip>"
fi

# 7. Check Caddy internal CA
echo ""
echo "7. Checking Caddy internal CA..."
CA_EXISTS=$(docker exec jarvis-caddy test -f /data/caddy/pki/authorities/local/root.crt && echo "yes" || echo "no")
if [[ "$CA_EXISTS" == "yes" ]]; then
    pass "Caddy internal CA exists"
    info "Export with: docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt"
else
    warn "Caddy internal CA not found yet (may generate on first HTTPS request)"
fi

# Summary
echo ""
echo "=== Summary ==="
echo ""
echo -e "${GREEN}LAN Access URLs:${NC}"
echo "  HTTPS: https://akior.local/"
echo "  HTTPS: https://jarvis.local/"
echo "  HTTP:  http://$HOST_IP/"
echo ""
echo "Key pages:"
echo "  - https://akior.local/display  (Kiosk/wallboard)"
echo "  - https://akior.local/camera   (Camera - requires trusted CA)"
echo "  - https://akior.local/menu     (Main dashboard)"
echo ""
echo "Windows hosts file entry:"
echo "  $HOST_IP    akior.local jarvis.local aifactory-lan"
echo ""
echo "To trust CA on Windows:"
echo "  1. Export: docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt"
echo "  2. Copy to Windows, then run as Admin:"
echo "     .\\ops\\windows\\import-lan-rootca.ps1 -CertPath caddy-root-ca.crt"
echo ""
