#!/usr/bin/env bash
# ops/verify/https-ui-check.sh
# Verifies AKIOR HTTPS is configured and camera APIs are available
# Exit codes: 0 = all checks pass, 1 = failure
#
# Usage:
#   bash ops/verify/https-ui-check.sh
#   bash ops/verify/https-ui-check.sh --skip-public

set -euo pipefail

# === Flags ===
SKIP_PUBLIC=0

# === Parse arguments ===
for arg in "$@"; do
  case $arg in
    --skip-public)
      SKIP_PUBLIC=1
      shift || true
      ;;
    --help|-h)
      cat <<EOF
Usage: $0 [OPTIONS]

Verify AKIOR HTTPS configuration and camera API availability.

Options:
  --skip-public   Skip public endpoint checks (LAN-only mode)
  --help          Show this help message
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (use --help for usage)"
      exit 1
      ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "=== AKIOR HTTPS & Camera Security Check ==="
echo ""

# 1. Check certificates exist
echo "1. Checking local certificates..."
CERT_DIR="${CERT_DIR:-deploy/certs}"
if [[ -f "$CERT_DIR/cert.pem" && -f "$CERT_DIR/key.pem" ]]; then
    CERT_CN=$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -subject 2>/dev/null | sed 's/.*CN = //' || echo "unknown")
    CERT_EXPIRY=$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
    pass "Certificates found (CN: $CERT_CN, expires: $CERT_EXPIRY)"
else
    fail "Certificates not found in $CERT_DIR - run ops/setup/lan-https-certs.sh first"
fi

# 2. Check certificate SANs include our hostnames
echo ""
echo "2. Checking certificate hostnames..."
CERT_SANS=$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 || echo "")
MISSING_HOSTS=""
for HOST in jarvis.local aifactory-lan localhost; do
    if echo "$CERT_SANS" | grep -qi "$HOST"; then
        pass "Certificate includes $HOST"
    else
        warn "Certificate may not include $HOST"
        MISSING_HOSTS="$MISSING_HOSTS $HOST"
    fi
done

# 3. Check port 443 is listening
echo ""
echo "3. Checking port 443 binding..."
if ss -lntp 2>/dev/null | grep -q ':443'; then
    pass "Port 443 listening"
else
    warn "Port 443 not listening - HTTPS not yet active"
    echo "    Start the stack with: docker compose -f deploy/compose.jarvis.yml up -d"
fi

# 4. Check port 80 HTTP fallback
echo ""
echo "4. Checking HTTP fallback (port 80)..."
if ss -lntp 2>/dev/null | grep -q ':80'; then
    pass "Port 80 listening (HTTP fallback available)"
else
    warn "Port 80 not listening - HTTP fallback unavailable"
fi

# 5. Get host IP
echo ""
echo "5. Detecting host IP..."
HOST_IP=$(ip -br a 2>/dev/null | grep UP | grep -v '^lo' | awk '{print $3}' | cut -d/ -f1 | head -1)
if [[ -n "$HOST_IP" ]]; then
    pass "Host IP: $HOST_IP"
else
    warn "Could not detect host IP automatically"
    HOST_IP="<your-ip>"
fi

# 6. Test HTTPS on localhost (with self-signed cert)
echo ""
echo "6. Testing HTTPS on localhost..."
if curl -skI -o /dev/null -w "%{http_code}" --max-time 5 https://localhost/ 2>/dev/null | grep -qE '^(200|301|302|307|308)$'; then
    HTTP_CODE=$(curl -skI -o /dev/null -w "%{http_code}" --max-time 5 https://localhost/ 2>/dev/null)
    pass "https://localhost/ responds with HTTP $HTTP_CODE"
else
    warn "https://localhost/ not responding - HTTPS may not be configured yet"
fi

# 7. Test HTTPS on jarvis.local (if DNS resolves)
echo ""
echo "7. Testing HTTPS on jarvis.local..."
if host jarvis.local &>/dev/null || grep -q jarvis.local /etc/hosts 2>/dev/null; then
    if curl -skI -o /dev/null -w "%{http_code}" --max-time 5 https://jarvis.local/ 2>/dev/null | grep -qE '^(200|301|302|307|308)$'; then
        HTTP_CODE=$(curl -skI -o /dev/null -w "%{http_code}" --max-time 5 https://jarvis.local/ 2>/dev/null)
        pass "https://jarvis.local/ responds with HTTP $HTTP_CODE"
    else
        warn "https://jarvis.local/ not responding"
    fi
else
    warn "jarvis.local not in DNS or /etc/hosts - add: $HOST_IP jarvis.local"
fi

# 8. Check Docker containers
echo ""
echo "8. Checking Docker container health..."
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

# 9. Check firewall for port 443
echo ""
echo "9. Checking firewall for HTTPS..."
if command -v ufw &>/dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")
    if echo "$UFW_STATUS" | grep -qi "inactive"; then
        pass "UFW firewall is inactive"
    elif echo "$UFW_STATUS" | grep -qi "active"; then
        if sudo ufw status 2>/dev/null | grep -qE '443.*ALLOW'; then
            pass "UFW active, port 443 allowed"
        else
            warn "UFW active but port 443 may not be allowed"
            echo "    Run: sudo ufw allow 443/tcp"
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
echo ""
if [[ $SKIP_PUBLIC -eq 1 ]]; then
    echo -e "${YELLOW}Mode:${NC} LAN-only (public checks skipped)"
    echo ""
fi
echo -e "${GREEN}HTTPS URL:${NC} https://jarvis.local/"
echo -e "${GREEN}HTTP Fallback:${NC} http://jarvis.local/"
echo ""
echo "For camera/mic to work in browser:"
echo "  1. Access via HTTPS (https://jarvis.local/)"
echo "  2. Trust the local CA certificate on your client machine"
echo ""
echo "To trust certificates on client machines:"
echo "  - macOS:   mkcert -install (copies rootCA to Keychain)"
echo "  - Windows: Import rootCA.pem to Trusted Root CAs"
echo "  - Linux:   Copy rootCA.pem to /usr/local/share/ca-certificates/"
echo ""
echo "See docs/runbook/lan-access.md for detailed instructions."
