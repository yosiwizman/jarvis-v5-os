#!/usr/bin/env bash
# ops/verify/tailscale-check.sh
# Verifies Tailscale remote-access profile status
# Exit codes: 0 = checks pass, 1 = failure, 2 = profile not enabled or TS_AUTHKEY not set

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

show_help() {
  cat <<EOF
Usage: $(basename "$0")

Verifies the Tailscale remote-access profile status (Phase B.1).

Exit codes:
  0 - All checks pass (Tailscale running and authenticated)
  1 - Failure (Tailscale not working properly)
  2 - Profile not enabled or TS_AUTHKEY not configured

Example:
  bash ops/verify/tailscale-check.sh
EOF
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

echo "=== Tailscale Remote Access Verification ==="
echo ""

# Navigate to deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"

cd "$DEPLOY_DIR"

# 1. Check if secrets file exists
ENV_FILE="secrets/tailscale.env"
echo "1. Checking for $ENV_FILE..."
if [[ ! -f "$ENV_FILE" ]]; then
  warn "Tailscale profile not configured ($ENV_FILE missing)"
  echo ""
  info "To enable remote access:"
  echo "  cp deploy/secrets/tailscale.env.example deploy/secrets/tailscale.env"
  echo "  # Edit and set your TS_AUTHKEY"
  echo "  bash ops/remote-access/tailscale-up.sh"
  exit 2
fi
pass "$ENV_FILE exists"

# 2. Check if TS_AUTHKEY is configured
echo ""
echo "2. Validating TS_AUTHKEY configuration..."
if grep -q "^TS_AUTHKEY=YOUR_TAILSCALE_AUTH_KEY_HERE" "$ENV_FILE" 2>/dev/null; then
  warn "TS_AUTHKEY is still set to placeholder value"
  echo ""
  info "Generate an auth key at: https://login.tailscale.com/admin/settings/keys"
  info "Update deploy/secrets/tailscale.env with your actual key"
  exit 2
fi

if ! grep -q "^TS_AUTHKEY=.\\+" "$ENV_FILE" 2>/dev/null; then
  warn "TS_AUTHKEY not set in $ENV_FILE"
  exit 2
fi
pass "TS_AUTHKEY is configured"

# 3. Check if Tailscale container is running
echo ""
echo "3. Checking Tailscale container status..."
if docker ps --format '{{.Names}}' | grep -q '^jarvis-tailscale$'; then
  pass "jarvis-tailscale container is running"
else
  warn "jarvis-tailscale container not running"
  echo ""
  info "To start: bash ops/remote-access/tailscale-up.sh"
  exit 2
fi

# 4. Check container health
echo ""
echo "4. Checking container health..."
CONTAINER_STATUS=$(docker inspect jarvis-tailscale --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
if [[ "$CONTAINER_STATUS" == "running" ]]; then
  pass "Container status: running"
else
  fail "Container status: $CONTAINER_STATUS"
fi

# 5. Check Tailscale daemon status
echo ""
echo "5. Checking Tailscale daemon status..."
if docker compose exec -T tailscale tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
  pass "Tailscale daemon is running and authenticated"
else
  warn "Tailscale daemon may not be fully authenticated yet"
  echo ""
  info "Check logs: docker logs jarvis-tailscale"
  exit 1
fi

# 6. Get and display Tailscale status
echo ""
echo "6. Current Tailscale status:"
if TS_STATUS=$(docker compose exec -T tailscale tailscale status 2>/dev/null); then
  echo "$TS_STATUS"
  pass "Status retrieved successfully"
  
  # Extract hostname if possible
  if echo "$TS_STATUS" | grep -q '100\.'; then
    HOSTNAME=$(echo "$TS_STATUS" | grep '100\.' | awk '{print $2}' | head -1)
    if [[ -n "$HOSTNAME" ]]; then
      echo ""
      info "Tailscale hostname: $HOSTNAME"
      info "Access JARVIS at: https://$HOSTNAME/ (or use MagicDNS name)"
    fi
  fi
else
  fail "Could not retrieve Tailscale status"
fi

echo ""
pass "Tailscale remote access verification completed"
echo ""
info "To disable: bash ops/remote-access/tailscale-down.sh"
echo ""
