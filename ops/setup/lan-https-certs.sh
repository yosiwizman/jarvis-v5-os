#!/usr/bin/env bash
# ops/setup/lan-https-certs.sh
# Generate locally trusted HTTPS certificates for AKIOR LAN access
#
# Prerequisites: mkcert must be installed on the host
#   Ubuntu:  sudo apt install mkcert
#   macOS:   brew install mkcert
#   Windows: choco install mkcert OR scoop install mkcert
#
# Usage:
#   ./ops/setup/lan-https-certs.sh
#
# This script:
#   1. Installs mkcert CA into system trust store (requires sudo)
#   2. Generates certificates for jarvis.local and aifactory-lan
#   3. Places them in deploy/certs/ for Caddy to use

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}ℹ${NC} $1"; }
pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Determine script directory (where repo is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CERTS_DIR="$REPO_ROOT/deploy/certs"

# Hostnames to generate certificates for
HOSTNAMES="jarvis.local aifactory-lan localhost 127.0.0.1"

echo "=== AKIOR LAN HTTPS Certificate Setup ==="
echo ""

# 1. Check if mkcert is installed
info "Checking for mkcert..."
if ! command -v mkcert &>/dev/null; then
    fail "mkcert is not installed. Install it first:
    Ubuntu/Debian: sudo apt install mkcert libnss3-tools
    macOS:         brew install mkcert
    Windows:       choco install mkcert
    
    Then run this script again."
fi
pass "mkcert found: $(mkcert --version 2>&1 | head -1)"

# 2. Create certs directory
info "Creating certificates directory..."
mkdir -p "$CERTS_DIR"
pass "Directory: $CERTS_DIR"

# 3. Install mkcert CA (one-time setup)
echo ""
info "Installing mkcert CA to system trust store..."
info "This may require sudo password."

if mkcert -install 2>&1 | grep -qi "already"; then
    pass "mkcert CA already installed"
else
    mkcert -install
    pass "mkcert CA installed to system trust store"
fi

# 4. Generate certificates
echo ""
info "Generating certificates for: $HOSTNAMES"

cd "$CERTS_DIR"
mkcert -cert-file cert.pem -key-file key.pem $HOSTNAMES

pass "Certificates generated:"
echo "    - $CERTS_DIR/cert.pem"
echo "    - $CERTS_DIR/key.pem"

# 5. Set permissions (important for Docker)
chmod 644 "$CERTS_DIR/cert.pem"
chmod 600 "$CERTS_DIR/key.pem"
pass "Permissions set"

# 6. Show CA location for client trust
echo ""
echo "=== Certificate Trust Setup ==="
CAROOT=$(mkcert -CAROOT)
echo ""
info "The mkcert CA root is at: $CAROOT"
echo ""
echo "To trust these certificates on OTHER machines (e.g., your Windows PC):"
echo ""
echo "1. Copy the CA certificate from:"
echo "   ${CYAN}$CAROOT/rootCA.pem${NC}"
echo ""
echo "2. Trust it on the client machine:"
echo ""
echo "   ${YELLOW}Windows:${NC}"
echo "   - Double-click rootCA.pem"
echo "   - Click 'Install Certificate...'"
echo "   - Choose 'Local Machine' → 'Trusted Root Certification Authorities'"
echo ""
echo "   ${YELLOW}macOS:${NC}"
echo "   - Double-click rootCA.pem to add to Keychain"
echo "   - In Keychain Access, find 'mkcert', double-click, expand Trust"
echo "   - Set 'When using this certificate' to 'Always Trust'"
echo ""
echo "   ${YELLOW}Linux (Chrome/Firefox):${NC}"
echo "   - Chrome: Settings → Privacy → Security → Manage certificates → Authorities → Import"
echo "   - Firefox: Settings → Privacy → View Certificates → Authorities → Import"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Restart Docker containers to pick up new certs:"
echo "   ${CYAN}docker compose -f deploy/compose.jarvis.yml up -d --force-recreate caddy${NC}"
echo ""
echo "2. Access AKIOR via HTTPS:"
echo "   ${GREEN}https://jarvis.local/${NC}"
echo "   ${GREEN}https://aifactory-lan/${NC}"
echo ""
echo "3. Verify secure context in browser (🔒 icon in address bar)"
echo ""
