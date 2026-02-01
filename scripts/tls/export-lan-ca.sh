#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/out/certs"
OUT_FILE="${OUT_DIR}/akior-lan-root-ca.crt"
CONTAINER_NAME="jarvis-caddy"
CADDY_ROOT_PATH="/data/caddy/pki/authorities/local/root.crt"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container '${CONTAINER_NAME}' is not running. Start the stack first." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

docker cp "${CONTAINER_NAME}:${CADDY_ROOT_PATH}" "${OUT_FILE}"

echo ""
echo "✅ Exported LAN root CA to:"
echo "   ${OUT_FILE}"
echo ""
echo "Next (macOS):"
echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${OUT_FILE}"
echo ""
echo "See docs/ops/lan-tls-trust.md for Windows/iOS/Android steps."
