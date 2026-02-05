#!/usr/bin/env bash
# ops/remote-access/tailscale-up.sh
# Brings up the optional Tailscale remote-access profile
# Exit codes: 0 = success, 1 = failure, 2 = missing dependency

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

Brings up the Tailscale container with remote-access profile (Phase B.1).

Requirements:
  - deploy/secrets/tailscale.env must exist with TS_AUTHKEY set

Example:
  bash ops/remote-access/tailscale-up.sh

Exit codes:
  0 - Success
  1 - Failure (e.g., docker compose failed)
  2 - Missing dependency (TS_AUTHKEY not configured)
EOF
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

echo "=== Tailscale Remote Access — Bringing Up ==="
echo ""

# Navigate to deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"

cd "$DEPLOY_DIR"

# 1. Verify secrets file exists
ENV_FILE="secrets/tailscale.env"
echo "1. Checking for $ENV_FILE..."
if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing $ENV_FILE (copy from secrets/tailscale.env.example)"
  echo ""
  info "To fix:"
  echo "  cp deploy/secrets/tailscale.env.example deploy/secrets/tailscale.env"
  echo "  # Edit deploy/secrets/tailscale.env and set your TS_AUTHKEY"
  exit 2
fi
pass "$ENV_FILE exists"

# 2. Verify TS_AUTHKEY is set (without printing the key)
echo ""
echo "2. Validating TS_AUTHKEY..."
if grep -q "^TS_AUTHKEY=YOUR_TAILSCALE_AUTH_KEY_HERE" "$ENV_FILE" 2>/dev/null; then
  fail "TS_AUTHKEY is still set to placeholder value"
  echo ""
  info "Generate an auth key at: https://login.tailscale.com/admin/settings/keys"
  info "Update deploy/secrets/tailscale.env with your actual key"
  exit 2
fi

if ! grep -q "^TS_AUTHKEY=.\\+" "$ENV_FILE" 2>/dev/null; then
  fail "TS_AUTHKEY not set in $ENV_FILE"
  exit 2
fi
pass "TS_AUTHKEY is configured (not shown)"

# 3. Bring up Tailscale with remote-access profile
echo ""
echo "3. Starting Tailscale container (profile: remote-access)..."
if docker compose --profile remote-access up -d tailscale; then
  pass "Tailscale container started"
else
  fail "Failed to start Tailscale container"
  exit 1
fi

# 4. Wait for Tailscale to authenticate
echo ""
echo "4. Waiting for Tailscale to authenticate (may take 10-30s)..."
sleep 5

MAX_WAIT=30
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if docker compose exec -T tailscale tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
    pass "Tailscale authenticated successfully"
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  warn "Tailscale may still be authenticating (check logs if needed)"
fi

# 5. Show status
echo ""
echo "5. Current Tailscale status:"
if docker compose exec -T tailscale tailscale status 2>/dev/null; then
  pass "Tailscale status retrieved"
else
  warn "Could not retrieve status (container may still be starting)"
fi

echo ""
echo "=== Tailscale Remote Access Enabled ==="
echo ""
info "Next steps:"
echo "  - Verify: bash ops/verify/tailscale-check.sh"
echo "  - Get hostname: docker compose exec tailscale tailscale status"
echo "  - Disable: bash ops/remote-access/tailscale-down.sh"
echo ""
