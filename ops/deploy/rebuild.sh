#!/usr/bin/env bash
#
# ops/deploy/rebuild.sh - AKIOR Deterministic Deployment Script (Linux)
#
# Deploys AKIOR with guaranteed web/server sync by stamping both containers
# with identical git SHA and build timestamp.
#
# Usage:
#   bash ops/deploy/rebuild.sh              # Standard rebuild + deploy
#   bash ops/deploy/rebuild.sh --verify-only # Verify existing deployment only
#   bash ops/deploy/rebuild.sh --no-cache   # Rebuild without Docker cache
#
# Requirements:
#   - git (for SHA extraction)
#   - docker (with compose plugin)
#   - curl (for post-deploy verification)
#   - jq (for JSON parsing)
#
# Exit codes:
#   0 - Success
#   1 - Build/deploy failed
#   2 - Verification failed (containers running but SHA mismatch)
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/deploy/compose.jarvis.yml"
VERIFY_SCRIPT="$REPO_ROOT/ops/verify/build-sync-check.sh"
TARGET_URL="${AKIOR_TARGET_URL:-https://akior.local}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
VERIFY_ONLY=false
NO_CACHE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--verify-only] [--no-cache]"
      echo ""
      echo "Deploys AKIOR with guaranteed web/server build sync."
      echo ""
      echo "Options:"
      echo "  --verify-only   Skip rebuild, only verify existing deployment"
      echo "  --no-cache      Build without Docker cache (slower but guaranteed fresh)"
      echo "  --help          Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}" >&2
      exit 1
      ;;
  esac
done

# Helper functions
log_status() { echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check dependencies
check_deps() {
  local missing=()
  command -v git >/dev/null 2>&1 || missing+=("git")
  command -v docker >/dev/null 2>&1 || missing+=("docker")
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v jq >/dev/null 2>&1 || missing+=("jq")
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_fail "Missing required dependencies: ${missing[*]}"
    echo "Install with: sudo apt-get install ${missing[*]}"
    exit 2
  fi
}

# Get git SHA from repository
get_git_sha() {
  if [[ ! -d "$REPO_ROOT/.git" ]]; then
    echo "unknown"
    return
  fi
  
  cd "$REPO_ROOT"
  git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Get current build timestamp
get_build_time() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Build containers with SHA and timestamp
build_containers() {
  local git_sha="$1"
  local build_time="$2"
  
  log_status "Building images with SHA: $git_sha, Time: $build_time"
  
  local build_args=(
    "compose" "-f" "$COMPOSE_FILE"
    "build"
  )
  
  if [[ "$NO_CACHE" == "true" ]]; then
    build_args+=("--no-cache")
    log_warn "Building without cache (this will take longer)"
  fi
  
  build_args+=("web" "server")
  
  export GIT_SHA="$git_sha"
  export BUILD_TIME="$build_time"
  
  log_status "Running: docker ${build_args[*]}"
  
  if ! docker "${build_args[@]}"; then
    log_fail "Docker build failed"
    return 1
  fi
  
  log_success "Build completed"
}

# Deploy containers with force-recreate
deploy_containers() {
  log_status "Deploying containers with force-recreate..."
  
  local deploy_args=(
    "compose" "-f" "$COMPOSE_FILE"
    "up" "-d" "--force-recreate"
    "caddy" "web" "server"
  )
  
  log_status "Running: docker ${deploy_args[*]}"
  
  if ! docker "${deploy_args[@]}"; then
    log_fail "Docker deploy failed"
    return 1
  fi
  
  log_success "Containers started"
  
  # Wait for containers to become healthy
  log_status "Waiting for containers to become healthy..."
  sleep 10
}

# Run verification
verify_deployment() {
  log_status "Verifying deployment..."
  
  if [[ -x "$VERIFY_SCRIPT" ]]; then
    if bash "$VERIFY_SCRIPT" "$TARGET_URL"; then
      log_success "Deployment verification passed"
      return 0
    else
      log_fail "Deployment verification failed"
      return 1
    fi
  else
    log_warn "Verification script not found or not executable: $VERIFY_SCRIPT"
    log_warn "Skipping automated verification"
    return 0
  fi
}

# Show container status
show_status() {
  log_status "Container status:"
  docker ps --filter "name=jarvis" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
}

# Main execution
main() {
  echo ""
  echo "========================================="
  echo "  AKIOR Deterministic Deploy (Linux)    "
  echo "========================================="
  echo ""
  
  check_deps
  
  local git_sha
  git_sha=$(get_git_sha)
  local build_time
  build_time=$(get_build_time)
  
  log_status "Repository: $REPO_ROOT"
  log_status "Compose file: $COMPOSE_FILE"
  log_status "Git SHA: $git_sha"
  log_status "Build time: $build_time"
  log_status "Target URL: $TARGET_URL"
  echo ""
  
  if [[ "$VERIFY_ONLY" == "true" ]]; then
    log_status "Verification-only mode"
    if verify_deployment; then
      echo ""
      log_success "Deployment verified successfully!"
      exit 0
    else
      echo ""
      log_fail "Deployment verification failed!"
      exit 2
    fi
  fi
  
  # Build containers
  if ! build_containers "$git_sha" "$build_time"; then
    exit 1
  fi
  echo ""
  
  # Deploy containers
  if ! deploy_containers; then
    exit 1
  fi
  echo ""
  
  # Show status
  show_status
  echo ""
  
  # Verify deployment
  if verify_deployment; then
    echo ""
    log_success "Deployment completed and verified successfully!"
    echo ""
    echo "Access AKIOR at: $TARGET_URL"
    echo "Diagnostics: $TARGET_URL/diagnostics"
    exit 0
  else
    echo ""
    log_warn "Deployment completed but verification failed"
    log_warn "Containers are running but may have drift"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check container logs: docker compose -f $COMPOSE_FILE logs"
    echo "  2. Verify health endpoints manually:"
    echo "     curl -sk $TARGET_URL/web-build | jq"
    echo "     curl -sk $TARGET_URL/api/health/build | jq"
    exit 2
  fi
}

main "$@"
