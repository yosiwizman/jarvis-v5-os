#!/usr/bin/env bash
# ops/remote-access/tailscale-down.sh
# Stops and removes the Tailscale remote-access container
# Exit codes: 0 = success, 1 = failure

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

Stops and removes the Tailscale container (remote-access profile).

Example:
  bash ops/remote-access/tailscale-down.sh

Exit codes:
  0 - Success
  1 - Failure
EOF
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

echo "=== Tailscale Remote Access — Bringing Down ==="
echo ""

# Navigate to deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"

cd "$DEPLOY_DIR"

# 1. Check if container exists
echo "1. Checking Tailscale container status..."
if docker ps -a --format '{{.Names}}' | grep -q '^jarvis-tailscale$'; then
  pass "Found jarvis-tailscale container"
else
  warn "jarvis-tailscale container not found (may already be down)"
  echo ""
  info "Nothing to do"
  exit 0
fi

# 2. Stop and remove Tailscale container
echo ""
echo "2. Stopping and removing Tailscale container..."
if docker compose --profile remote-access down tailscale; then
  pass "Tailscale container stopped and removed"
else
  # Try alternative approach
  if docker stop jarvis-tailscale 2>/dev/null && docker rm jarvis-tailscale 2>/dev/null; then
    pass "Tailscale container stopped and removed (via docker CLI)"
  else
    fail "Failed to stop Tailscale container"
    exit 1
  fi
fi

echo ""
echo "=== Tailscale Remote Access Disabled ==="
echo ""
info "To re-enable: bash ops/remote-access/tailscale-up.sh"
echo ""
