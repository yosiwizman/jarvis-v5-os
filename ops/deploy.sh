#!/bin/bash
# AKIOR Deterministic Deployment Script (Linux)
# 
# Deploys AKIOR with guaranteed web/server sync.
# - Always rebuilds both jarvis-web and jarvis-server images
# - Passes git SHA to both containers at build time
# - Verifies deployment after completion

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$REPO_ROOT/deploy/compose.jarvis.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] $1${NC}"
}

function log_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

function log_error() {
    echo -e "${RED}[FAIL] $1${NC}"
}

function log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

function get_git_sha() {
    git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

function get_build_time() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

function deploy() {
    local GIT_SHA=$(get_git_sha)
    local BUILD_TIME=$(get_build_time)
    
    log_info "Deploying AKIOR..."
    log_info "Git SHA: $GIT_SHA"
    log_info "Build Time: $BUILD_TIME"
    
    # Pull latest code
    log_info "Pulling latest code from origin/main..."
    git -C "$REPO_ROOT" pull origin main
    
    # Update GIT_SHA after pull
    GIT_SHA=$(get_git_sha)
    log_info "Updated SHA: $GIT_SHA"
    
    # Build and deploy
    log_info "Building and deploying containers..."
    export GIT_SHA
    export BUILD_TIME
    
    docker compose -f "$COMPOSE_FILE" up -d --build --force-recreate caddy web server
    
    if [ $? -ne 0 ]; then
        log_error "Docker deployment failed"
        exit 1
    fi
    
    log_success "Containers deployed"
    
    # Wait for health
    log_info "Waiting for containers to become healthy..."
    sleep 15
    
    # Verify deployment
    verify_deployment "$GIT_SHA"
}

function verify_deployment() {
    local EXPECTED_SHA=$1
    local TARGET_URL="https://akior.local"
    
    log_info "Verifying deployment..."
    log_info "Expected SHA: $EXPECTED_SHA"
    
    # Verify web build
    log_info "Checking /web-build..."
    local WEB_SHA=$(curl -sk "$TARGET_URL/web-build" | grep -o '"git_sha":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$WEB_SHA" = "$EXPECTED_SHA" ]; then
        log_success "Web SHA matches: $WEB_SHA"
    else
        log_error "Web SHA mismatch: got $WEB_SHA, expected $EXPECTED_SHA"
    fi
    
    # Verify server build
    log_info "Checking /api/health/build..."
    local SERVER_SHA=$(curl -sk "$TARGET_URL/api/health/build" | grep -o '"git_sha":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$SERVER_SHA" = "$EXPECTED_SHA" ]; then
        log_success "Server SHA matches: $SERVER_SHA"
    else
        log_error "Server SHA mismatch: got $SERVER_SHA, expected $EXPECTED_SHA"
    fi
    
    # Check diagnostics
    log_info "Checking /diagnostics..."
    local DIAG_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$TARGET_URL/diagnostics")
    
    if [ "$DIAG_STATUS" = "200" ]; then
        log_success "/diagnostics returns 200 OK"
    else
        log_error "/diagnostics returned $DIAG_STATUS"
    fi
    
    log_success "Deployment verification complete!"
    log_info "Access at: $TARGET_URL"
}

# Main execution
log_info "AKIOR Deployment Script"
log_info "Repository: $REPO_ROOT"
deploy
