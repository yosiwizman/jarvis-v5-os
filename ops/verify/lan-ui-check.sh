#!/usr/bin/env bash
# ops/verify/lan-ui-check.sh
# Verifies JARVIS is accessible from LAN
# Exit codes: 0 = all checks pass, 1 = failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "=== JARVIS LAN UI Access Check ==="
echo ""

# 1. Check port 80 is listening on all interfaces
echo "1. Checking port 80 binding..."
if ss -lntp 2>/dev/null | grep -q '0.0.0.0:80\|:::80\|\*:80'; then
    pass "Port 80 listening on all interfaces"
elif ss -lntp 2>/dev/null | grep -q ':80'; then
    warn "Port 80 listening but may be restricted to localhost"
    ss -lntp 2>/dev/null | grep ':80' | head -3
else
    fail "Port 80 is NOT listening - Caddy may not be running"
fi

# 2. Check port 3000 (Tailscale Serve compatibility)
echo ""
echo "2. Checking port 3000 binding..."
if ss -lntp 2>/dev/null | grep -q ':3000'; then
    pass "Port 3000 listening (Tailscale Serve compatible)"
else
    warn "Port 3000 not listening - Tailscale Serve won't work"
fi

# 3. Get host IP
echo ""
echo "3. Detecting host IP..."
HOST_IP=$(ip -br a 2>/dev/null | grep UP | grep -v '^lo' | awk '{print $3}' | cut -d/ -f1 | head -1)
if [[ -n "$HOST_IP" ]]; then
    pass "Host IP: $HOST_IP"
else
    warn "Could not detect host IP automatically"
    HOST_IP="127.0.0.1"
fi

# 4. Test HTTP on localhost
echo ""
echo "4. Testing HTTP on localhost..."
if curl -sI -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1/ 2>/dev/null | grep -qE '^(200|301|302|307|308)$'; then
    HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1/ 2>/dev/null)
    pass "localhost:80 responds with HTTP $HTTP_CODE"
else
    fail "localhost:80 not responding"
fi

# 5. Test HTTP on host IP
echo ""
echo "5. Testing HTTP on host IP ($HOST_IP)..."
if curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "http://${HOST_IP}/" 2>/dev/null | grep -qE '^(200|301|302|307|308)$'; then
    HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 "http://${HOST_IP}/" 2>/dev/null)
    pass "http://${HOST_IP}/ responds with HTTP $HTTP_CODE"
else
    fail "http://${HOST_IP}/ not responding - LAN access may be blocked"
fi

# 6. Check Docker containers
echo ""
echo "6. Checking Docker container health..."
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.jarvis.yml}"
if [[ -f "$COMPOSE_FILE" ]]; then
    UNHEALTHY=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | grep -c '"unhealthy"' || true)
    RUNNING=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | grep -c '"running"' || true)
    if [[ "$UNHEALTHY" -gt 0 ]]; then
        warn "$UNHEALTHY container(s) unhealthy"
        docker compose -f "$COMPOSE_FILE" ps
    elif [[ "$RUNNING" -ge 3 ]]; then
        pass "All $RUNNING containers running"
    else
        warn "Only $RUNNING container(s) running"
    fi
else
    warn "Compose file not found at $COMPOSE_FILE"
fi

# 7. Check firewall
echo ""
echo "7. Checking firewall..."
if command -v ufw &>/dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")
    if echo "$UFW_STATUS" | grep -qi "inactive"; then
        pass "UFW firewall is inactive"
    elif echo "$UFW_STATUS" | grep -qi "active"; then
        if sudo ufw status 2>/dev/null | grep -qE '80.*ALLOW'; then
            pass "UFW active, port 80 allowed"
        else
            warn "UFW active but port 80 may not be allowed"
            echo "    Run: sudo ufw allow 80/tcp"
        fi
    else
        warn "Could not determine UFW status"
    fi
else
    pass "UFW not installed (no firewall blocking)"
fi

# Summary
echo ""
echo "=== Summary ==="
echo -e "${GREEN}LAN Access URL:${NC} http://${HOST_IP}/"
echo ""
echo "To set up hostname on client machines, add to hosts file:"
echo "    ${HOST_IP}    jarvis.local aifactory-lan"
echo ""
echo "See docs/runbook/lan-access.md for details."
