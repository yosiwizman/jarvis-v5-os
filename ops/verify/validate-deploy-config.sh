#!/bin/bash
# JARVIS Deploy Configuration Validator
#
# Validates deployment configuration files without requiring remote access.
# Suitable for CI pipelines.
#
# Usage:
#   ./ops/verify/validate-deploy-config.sh
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more checks failed

set -euo pipefail

# Find repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

log_pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
log_warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "=== Validating Deployment Configuration ==="
echo "Repo root: $REPO_ROOT"
echo ""

# -----------------------------------------------------------------------------
# Check 1: Required files exist
# -----------------------------------------------------------------------------
echo "--- Required Files ---"

REQUIRED_FILES=(
    "deploy/compose.jarvis.yml"
    "deploy/Caddyfile"
    "deploy/Dockerfile.web"
    "deploy/jarvis.env.example"
    "apps/server/Dockerfile"
)

for f in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$REPO_ROOT/$f" ]]; then
        log_pass "$f exists"
    else
        log_fail "$f missing"
    fi
done

# -----------------------------------------------------------------------------
# Check 2: Compose file validation
# -----------------------------------------------------------------------------
echo ""
echo "--- Compose File Validation ---"

COMPOSE_FILE="$REPO_ROOT/deploy/compose.jarvis.yml"

if [[ -f "$COMPOSE_FILE" ]]; then
    # Check for required services
    for svc in caddy web server; do
        if grep -q "^\s*${svc}:" "$COMPOSE_FILE" 2>/dev/null; then
            log_pass "Service '$svc' defined"
        else
            log_fail "Service '$svc' not found in compose"
        fi
    done
    
    # Check for healthcheck on each service
    for svc in caddy web server; do
        # Use awk to find healthcheck within service block
        if awk "/^\s*${svc}:/,/^\s*[a-z]+:/" "$COMPOSE_FILE" | grep -q "healthcheck:" 2>/dev/null; then
            log_pass "Service '$svc' has healthcheck"
        else
            log_fail "Service '$svc' missing healthcheck"
        fi
    done
    
    # Check for restart policy
    if grep -q "restart: unless-stopped" "$COMPOSE_FILE" 2>/dev/null; then
        log_pass "restart: unless-stopped found"
    else
        log_fail "Missing restart: unless-stopped policy"
    fi
    
    # Check healthcheck uses 127.0.0.1 (not localhost)
    if grep -q 'http://127\.0\.0\.1' "$COMPOSE_FILE" 2>/dev/null; then
        log_pass "Healthchecks use 127.0.0.1"
    elif grep -q 'http://localhost' "$COMPOSE_FILE" 2>/dev/null; then
        log_fail "Healthchecks use localhost (should be 127.0.0.1 for alpine)"
    else
        log_warn "Could not verify healthcheck URLs"
    fi
fi

# -----------------------------------------------------------------------------
# Check 3: Dockerfile validation
# -----------------------------------------------------------------------------
echo ""
echo "--- Dockerfile Validation ---"

SERVER_DOCKERFILE="$REPO_ROOT/apps/server/Dockerfile"
WEB_DOCKERFILE="$REPO_ROOT/deploy/Dockerfile.web"

# Server Dockerfile
if [[ -f "$SERVER_DOCKERFILE" ]]; then
    if grep -q "FROM node:" "$SERVER_DOCKERFILE" 2>/dev/null; then
        log_pass "Server Dockerfile uses node base image"
    else
        log_fail "Server Dockerfile missing node base image"
    fi
    
    if grep -q "HEALTHCHECK" "$SERVER_DOCKERFILE" 2>/dev/null || grep -q "healthcheck" "$COMPOSE_FILE" 2>/dev/null; then
        log_pass "Server has healthcheck (compose or Dockerfile)"
    else
        log_warn "Server healthcheck not found"
    fi
fi

# Web Dockerfile
if [[ -f "$WEB_DOCKERFILE" ]]; then
    if grep -q "FROM node:" "$WEB_DOCKERFILE" 2>/dev/null; then
        log_pass "Web Dockerfile uses node base image"
    else
        log_fail "Web Dockerfile missing node base image"
    fi
    
    # Check for --chown for proper permissions
    if grep -q "\-\-chown=" "$WEB_DOCKERFILE" 2>/dev/null; then
        log_pass "Web Dockerfile uses --chown for file ownership"
    else
        log_warn "Web Dockerfile may have permission issues (no --chown)"
    fi
    
    # Check for non-root user
    if grep -q "USER " "$WEB_DOCKERFILE" 2>/dev/null; then
        log_pass "Web Dockerfile runs as non-root user"
    else
        log_warn "Web Dockerfile may run as root"
    fi
fi

# -----------------------------------------------------------------------------
# Check 4: Environment example
# -----------------------------------------------------------------------------
echo ""
echo "--- Environment Config ---"

ENV_EXAMPLE="$REPO_ROOT/deploy/jarvis.env.example"

if [[ -f "$ENV_EXAMPLE" ]]; then
    # Check for common required vars
    for var in OPENAI_API_KEY; do
        if grep -q "^${var}=" "$ENV_EXAMPLE" 2>/dev/null || grep -q "^#.*${var}" "$ENV_EXAMPLE" 2>/dev/null; then
            log_pass "Env example documents $var"
        else
            log_warn "Env example missing $var"
        fi
    done
fi

# -----------------------------------------------------------------------------
# Check 5: TypeScript config (ESM compatibility)
# -----------------------------------------------------------------------------
echo ""
echo "--- TypeScript/ESM Config ---"

SHARED_TSCONFIG="$REPO_ROOT/packages/shared/tsconfig.json"

if [[ -f "$SHARED_TSCONFIG" ]]; then
    if grep -q '"moduleResolution".*"NodeNext"' "$SHARED_TSCONFIG" 2>/dev/null || \
       grep -q '"moduleResolution".*"nodenext"' "$SHARED_TSCONFIG" 2>/dev/null; then
        log_pass "Shared package uses NodeNext module resolution"
    else
        log_fail "Shared package should use NodeNext moduleResolution for ESM"
    fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    log_fail "Config validation FAILED"
    exit 1
else
    echo ""
    log_pass "Config validation PASSED"
    exit 0
fi
