#!/usr/bin/env bash
# ops/verify/remote-https-check.sh
# Verifies AKIOR public HTTPS access (Phase B - Remote Access)
#
# Usage:
#   bash ops/verify/remote-https-check.sh --host akior.example.com
#
# Exit codes:
#   0 = success (public HTTPS working with valid cert)
#   1 = failure (endpoint unreachable or cert invalid)
#   2 = not enabled (Phase B not implemented or placeholder host)

set -euo pipefail

# === Colors ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# === Flags ===
HOST=""

# === Parse arguments ===
for arg in "$@"; do
  case $arg in
    --host)
      shift || true
      HOST="${1:-}"
      shift || true
      ;;
    --host=*)
      HOST="${arg#*=}"
      shift || true
      ;;
    --help|-h)
      cat <<EOF
Usage: $0 --host <FQDN>

Verify AKIOR public HTTPS access with valid Let's Encrypt certificate.

Options:
  --host <FQDN>   Public FQDN to check (e.g., akior.yourdomain.com)
  --help          Show this help message

This script requires Phase B (Remote Access & Public TLS) to be implemented.
EOF
      exit 0
      ;;
    *)
      echo -e "${RED}✗${NC} Unknown argument: $arg (use --help for usage)"
      exit 1
      ;;
  esac
done

# === Validation ===
if [[ -z "$HOST" ]]; then
  echo -e "${RED}✗${NC} Error: --host argument is required"
  echo ""
  echo "Usage: $0 --host akior.yourdomain.com"
  exit 1
fi

# === Phase B Check ===
echo "=== AKIOR Remote HTTPS Check ==="
echo ""
echo -e "${CYAN}➜${NC} Target host: $HOST"
echo ""

# Check if this is a placeholder domain
if [[ "$HOST" == *"example.com"* ]] || [[ "$HOST" == "localhost"* ]] || [[ "$HOST" == *".local"* ]]; then
  echo -e "${YELLOW}⚠${NC} Placeholder or LAN hostname detected: $HOST"
  echo ""
  echo "This script is for Phase B (Remote Access & Public TLS)."
  echo "Phase B is not yet implemented."
  echo ""
  echo "Current status:"
  echo "  • Phase A: LAN hardening ✓ (complete)"
  echo "  • Phase B: Remote access (not started)"
  echo ""
  echo "To enable remote access, implement:"
  echo "  1. Tailscale container stack"
  echo "  2. Cloudflare DNS challenge for Let's Encrypt"
  echo "  3. Public FQDN configuration"
  echo ""
  echo "See docs/ops/remote-access.md for details."
  echo ""
  exit 2
fi

# === Future Phase B Implementation ===
echo -e "${YELLOW}⚠${NC} Phase B not implemented yet"
echo ""
echo "This script will perform the following checks once Phase B is complete:"
echo ""
echo "  1. DNS resolution for $HOST"
echo "  2. HTTPS connection to https://$HOST/"
echo "  3. Certificate validation (Let's Encrypt issuer)"
echo "  4. Certificate expiry check (>30 days remaining)"
echo "  5. HTTP 200 response from /api/health/build"
echo ""
echo "For now, this is a stub to prevent CI failures."
echo ""
exit 2
