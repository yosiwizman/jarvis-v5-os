#!/usr/bin/env bash
#
# ops/verify/build-sync-check.sh - AKIOR Build Sync Verification
#
# Verifies that web and server containers are running identical git SHAs
# and that both match the current repository HEAD (if in a git repo).
#
# Usage:
#   bash ops/verify/build-sync-check.sh [target-url]
#
# Arguments:
#   target-url    Optional. Target AKIOR URL (default: https://akior.local)
#
# Exit codes:
#   0 - All SHAs match (no drift)
#   1 - SHA mismatch detected (drift)
#   2 - Error (missing dependencies, unreachable endpoints, etc.)
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TARGET_URL="${1:-https://akior.local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Helper functions
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
info() { echo -e "${CYAN}i${NC} $1"; }

# Check dependencies
check_deps() {
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v jq >/dev/null 2>&1 || missing+=("jq")
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    fail "Missing required dependencies: ${missing[*]}"
    echo "Install with: sudo apt-get install ${missing[*]}"
    exit 2
  fi
}

# Fetch JSON from endpoint
fetch_json() {
  local url="$1"
  local response
  
  # Use -k to skip certificate verification for self-signed certs
  # Use --max-time to prevent hanging
  response=$(curl -kfsS --max-time 10 "$url" 2>/dev/null) || {
    echo "{\"error\": \"fetch_failed\"}"
    return 1
  }
  
  echo "$response"
}

# Extract git_sha from JSON response
extract_sha() {
  local json="$1"
  local sha
  
  # Try to extract git_sha field
  sha=$(echo "$json" | jq -r '.git_sha // empty' 2>/dev/null)
  
  if [[ -z "$sha" ]]; then
    echo "unknown"
  else
    echo "$sha"
  fi
}

# Get repository HEAD SHA
get_repo_sha() {
  if [[ ! -d "$REPO_ROOT/.git" ]]; then
    echo "not_in_repo"
    return
  fi
  
  cd "$REPO_ROOT"
  git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Main verification
main() {
  echo ""
  echo "=== AKIOR Build Sync Verification ==="
  echo "Target: $TARGET_URL"
  echo ""
  
  check_deps
  
  local exit_code=0
  local drift_detected=false
  
  # Fetch web build info
  info "Fetching web build info from /web-build..."
  local web_response
  web_response=$(fetch_json "$TARGET_URL/web-build")
  
  if echo "$web_response" | jq -e '.error' >/dev/null 2>&1; then
    fail "Failed to reach web build endpoint"
    echo "  URL: $TARGET_URL/web-build"
    echo "  Error: Endpoint unreachable or returned error"
    exit 2
  fi
  
  local web_sha
  web_sha=$(extract_sha "$web_response")
  local web_build_time
  web_build_time=$(echo "$web_response" | jq -r '.build_time // "unknown"')
  
  # Fetch server build info
  info "Fetching server build info from /api/health/build..."
  local server_response
  server_response=$(fetch_json "$TARGET_URL/api/health/build")
  
  if echo "$server_response" | jq -e '.error' >/dev/null 2>&1; then
    fail "Failed to reach server build endpoint"
    echo "  URL: $TARGET_URL/api/health/build"
    echo "  Error: Endpoint unreachable or returned error"
    exit 2
  fi
  
  local server_sha
  server_sha=$(extract_sha "$server_response")
  local server_build_time
  server_build_time=$(echo "$server_response" | jq -r '.build_time // "unknown"')
  
  # Get repository HEAD SHA (if available)
  local repo_sha
  repo_sha=$(get_repo_sha)
  
  echo ""
  echo "Build Information:"
  echo "  Web SHA:        $web_sha"
  echo "  Server SHA:     $server_sha"
  if [[ "$repo_sha" != "not_in_repo" ]]; then
    echo "  Repository SHA: $repo_sha"
  fi
  echo ""
  echo "  Web build time:    $web_build_time"
  echo "  Server build time: $server_build_time"
  echo ""
  
  # Check for unknown SHAs
  if [[ "$web_sha" == "unknown" ]]; then
    fail "Web SHA is unknown (build metadata not set)"
    drift_detected=true
  fi
  
  if [[ "$server_sha" == "unknown" ]]; then
    fail "Server SHA is unknown (build metadata not set)"
    drift_detected=true
  fi
  
  # Compare web and server SHAs
  if [[ "$web_sha" != "unknown" && "$server_sha" != "unknown" ]]; then
    if [[ "$web_sha" == "$server_sha" ]]; then
      pass "Web and Server SHAs match: $web_sha"
    else
      fail "Web/Server SHA mismatch!"
      echo "  Web SHA:    $web_sha"
      echo "  Server SHA: $server_sha"
      drift_detected=true
    fi
  fi
  
  # Compare with repository HEAD (if available)
  if [[ "$repo_sha" != "not_in_repo" && "$repo_sha" != "unknown" ]]; then
    if [[ "$web_sha" == "$repo_sha" && "$server_sha" == "$repo_sha" ]]; then
      pass "Deployed SHAs match repository HEAD: $repo_sha"
    else
      warn "Deployed SHAs differ from repository HEAD"
      echo "  This may be expected if you haven't redeployed after recent commits"
      echo "  Repository HEAD: $repo_sha"
      echo "  Deployed SHA:    $web_sha"
    fi
  fi
  
  echo ""
  echo "=== Verification Summary ==="
  
  if [[ "$drift_detected" == "true" ]]; then
    echo ""
    fail "BUILD DRIFT DETECTED"
    echo ""
    echo "Web and Server containers are running different builds."
    echo ""
    echo "Remediation:"
    echo "  1. Rebuild both containers with identical build metadata:"
    echo "     cd $REPO_ROOT"
    echo "     bash ops/deploy/rebuild.sh"
    echo ""
    echo "  2. Verify the fix:"
    echo "     bash ops/verify/build-sync-check.sh"
    echo ""
    exit_code=1
  else
    echo ""
    pass "No drift detected - web and server are in sync"
    echo ""
    exit_code=0
  fi
  
  exit $exit_code
}

main "$@"
