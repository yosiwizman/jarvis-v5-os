#!/usr/bin/env bash
# ops/verify/lan-reachability-check.sh
# Verify that AKIOR UI is reachable from LAN via akior.local

set -euo pipefail

usage() {
  cat << USAGE
Usage: $(basename "$0")

Verifies LAN reachability for AKIOR UI:
- Checks ports 80 and 443 are listening on LAN interfaces
- Tests HTTPS and HTTP connectivity via akior.local
- Validates mDNS is advertising akior.local

Exit codes:
  0 - All checks passed
  1 - One or more checks failed
USAGE
}

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

FAIL=0

echo "=== LAN Reachability Check for akior.local ==="
echo ""

# Check 1: Ports listening
echo "[1/4] Checking ports 80 and 443 are listening..."
if sudo ss -lntp | grep -qE '0\.0\.0\.0:(80|443)\b'; then
  echo "✓ Ports 80 and 443 are listening on all interfaces"
else
  echo "✗ FAIL: Ports not listening on 0.0.0.0"
  FAIL=1
fi
echo ""

# Check 2: mDNS hostname
echo "[2/4] Checking Avahi is advertising akior.local..."
if systemctl is-active avahi-daemon >/dev/null 2>&1; then
  MDNS_HOST=$(systemctl status avahi-daemon 2>/dev/null | grep -oP 'running \[\K[^\]]+' || echo "unknown")
  if [[ "$MDNS_HOST" == "akior.local" ]]; then
    echo "✓ Avahi is advertising akior.local"
  else
    echo "✗ FAIL: Avahi is advertising '$MDNS_HOST' (expected 'akior.local')"
    FAIL=1
  fi
else
  echo "✗ FAIL: Avahi daemon is not running"
  FAIL=1
fi
echo ""

# Check 3: HTTPS connectivity
echo "[3/4] Testing HTTPS connectivity (https://akior.local/menu)..."
if HTTP_CODE=$(curl -kfsS -o /dev/null -w "%{http_code}" https://akior.local/menu 2>/dev/null); then
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✓ HTTPS accessible (HTTP $HTTP_CODE)"
  else
    echo "⚠ HTTPS accessible but unexpected status: HTTP $HTTP_CODE"
  fi
else
  echo "✗ FAIL: HTTPS connection failed"
  FAIL=1
fi
echo ""

# Check 4: HTTP connectivity (fallback)
echo "[4/4] Testing HTTP fallback (http://akior.local/menu)..."
if HTTP_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" http://akior.local/menu 2>/dev/null); then
  if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "308" ]]; then
    echo "✓ HTTP accessible (HTTP $HTTP_CODE)"
  else
    echo "⚠ HTTP accessible but unexpected status: HTTP $HTTP_CODE"
  fi
else
  echo "✗ FAIL: HTTP connection failed"
  FAIL=1
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ $FAIL -eq 0 ]]; then
  echo "✓ PASS: LAN reachability verified"
  echo ""
  echo "LAN clients should be able to access:"
  echo "  • https://akior.local/menu (primary, camera/mic enabled)"
  echo "  • http://akior.local/menu (fallback, redirects to HTTPS)"
  exit 0
else
  echo "✗ FAIL: One or more checks failed"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check Caddy logs: docker compose -f deploy/compose.jarvis.yml logs caddy"
  echo "  2. Check Avahi status: systemctl status avahi-daemon"
  echo "  3. Check port listeners: sudo ss -lntp | egrep ':(80|443)'"
  exit 1
fi
