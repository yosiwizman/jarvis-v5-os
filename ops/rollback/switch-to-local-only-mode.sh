#!/usr/bin/env bash
# ops/rollback/switch-to-local-only-mode.sh
# Idempotent rollback to LAN-only mode (no public DNS/TLS/Tailscale)
#
# Usage:
#   bash ops/rollback/switch-to-local-only-mode.sh
#   bash ops/rollback/switch-to-local-only-mode.sh --dry-run
#   bash ops/rollback/switch-to-local-only-mode.sh --no-kiosk-restart
#
# Exit codes:
#   0 = success (LAN-only mode confirmed)
#   1 = failure (verification failed or critical error)
#   2 = dry-run mode (no changes made)

set -euo pipefail

# === Configuration ===
REPO_ROOT="${REPO_ROOT:-/opt/jarvis/JARVIS-V5-OS}"
COMPOSE_FILE="${REPO_ROOT}/deploy/compose.jarvis.yml"
LOG_DIR="${REPO_ROOT}/ops/rollback/_logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${LOG_DIR}/rollback_${TIMESTAMP}.log"

# === Flags ===
DRY_RUN=0
NO_KIOSK_RESTART=0

# === Colors ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# === Logging ===
log() {
  local msg="[$(date -Iseconds)] $*"
  echo -e "${CYAN}➜${NC} $msg" | tee -a "$LOG_FILE"
}

pass() {
  local msg="[$(date -Iseconds)] ✓ $*"
  echo -e "${GREEN}$msg${NC}" | tee -a "$LOG_FILE"
}

warn() {
  local msg="[$(date -Iseconds)] ⚠ $*"
  echo -e "${YELLOW}$msg${NC}" | tee -a "$LOG_FILE"
}

fail() {
  local msg="[$(date -Iseconds)] ✗ $*"
  echo -e "${RED}$msg${NC}" | tee -a "$LOG_FILE"
  exit 1
}

run_cmd() {
  local cmd="$*"
  log "EXEC: $cmd"
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "DRY-RUN: would execute: $cmd"
    return 0
  fi
  
  # Execute and capture output
  if ! eval "$cmd" 2>&1 | tee -a "$LOG_FILE"; then
    fail "Command failed: $cmd"
  fi
}

# === Parse arguments ===
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-kiosk-restart)
      NO_KIOSK_RESTART=1
      shift
      ;;
    --help|-h)
      cat <<EOF
Usage: $0 [OPTIONS]

Rollback AKIOR to LAN-only mode (no public DNS/TLS/Tailscale).

Options:
  --dry-run            Print actions without executing
  --no-kiosk-restart   Skip kiosk service restart (for testing)
  --help               Show this help message

This script is idempotent and safe to run multiple times.
EOF
      exit 0
      ;;
    *)
      fail "Unknown argument: $arg (use --help for usage)"
      ;;
  esac
done

# === Setup ===
mkdir -p "$LOG_DIR"

echo "=== AKIOR LAN-Only Rollback ===" | tee "$LOG_FILE"
echo "Started: $(date -Iseconds)" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
[[ $DRY_RUN -eq 1 ]] && warn "DRY-RUN MODE: No changes will be made"
echo "" | tee -a "$LOG_FILE"

# === Preflight checks ===
log "Preflight checks"

if [[ ! -d "$REPO_ROOT" ]]; then
  fail "Repository not found at: $REPO_ROOT"
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  fail "Compose file not found: $COMPOSE_FILE"
fi

if ! command -v docker &>/dev/null; then
  fail "Docker not found - is it installed?"
fi

if ! command -v systemctl &>/dev/null; then
  warn "systemctl not found - kiosk restart will be skipped"
  NO_KIOSK_RESTART=1
fi

pass "Preflight checks complete"
echo "" | tee -a "$LOG_FILE"

# === Step 1: Stop remote-access profile (if present) ===
log "Step 1: Ensuring remote-access profile is stopped"

cd "$REPO_ROOT"
if docker compose -f "$COMPOSE_FILE" --profile remote-access ps 2>/dev/null | grep -q "remote-access"; then
  warn "Remote-access containers detected"
  run_cmd "docker compose -f '$COMPOSE_FILE' --profile remote-access down"
  pass "Remote-access profile stopped"
else
  pass "No remote-access containers running (already LAN-only)"
fi

echo "" | tee -a "$LOG_FILE"

# === Step 2: Verify Caddy is using internal TLS ===
log "Step 2: Verifying Caddy TLS configuration"

CADDYFILE="${REPO_ROOT}/deploy/Caddyfile"
if [[ ! -f "$CADDYFILE" ]]; then
  fail "Caddyfile not found: $CADDYFILE"
fi

if grep -q "tls internal" "$CADDYFILE"; then
  pass "Caddyfile already uses 'tls internal' (LAN-only)"
elif grep -q "dns cloudflare" "$CADDYFILE"; then
  warn "Caddyfile contains Cloudflare DNS challenge - reverting to internal TLS"
  # In Phase A, we don't actually modify Caddyfile - it should already be internal-only
  # This is a safety check for future Phase B
  fail "Caddyfile contains public TLS config - manual intervention required (Phase B not implemented yet)"
else
  warn "Caddyfile TLS config unknown - proceeding with caution"
fi

echo "" | tee -a "$LOG_FILE"

# === Step 3: Remove any Cloudflare cron jobs ===
log "Step 3: Removing Cloudflare DNS sync cron jobs (if any)"

CRON_FILE="/etc/cron.d/jarvis-cloudflare-sync"
if [[ -f "$CRON_FILE" ]]; then
  warn "Found Cloudflare cron job: $CRON_FILE"
  run_cmd "sudo rm -f '$CRON_FILE'"
  pass "Cloudflare cron job removed"
else
  pass "No Cloudflare cron jobs found"
fi

echo "" | tee -a "$LOG_FILE"

# === Step 4: Restart core Docker stack ===
log "Step 4: Restarting core Docker stack"

run_cmd "cd '$REPO_ROOT' && docker compose -f '$COMPOSE_FILE' pull --quiet"
run_cmd "cd '$REPO_ROOT' && GIT_SHA=\$(git rev-parse --short HEAD 2>/dev/null || echo unknown) docker compose -f '$COMPOSE_FILE' up -d --force-recreate"

# Wait for containers to stabilize
if [[ $DRY_RUN -eq 0 ]]; then
  log "Waiting for containers to stabilize (10 seconds)"
  sleep 10
  
  # Show container status
  log "Container status:"
  docker compose -f "$COMPOSE_FILE" ps 2>&1 | tee -a "$LOG_FILE"
fi

pass "Docker stack restarted"
echo "" | tee -a "$LOG_FILE"

# === Step 5: Restart kiosk service ===
if [[ $NO_KIOSK_RESTART -eq 1 ]]; then
  warn "Skipping kiosk restart (--no-kiosk-restart flag)"
else
  log "Step 5: Restarting kiosk service"
  
  if systemctl is-active --quiet akior-kiosk.service 2>/dev/null; then
    run_cmd "sudo systemctl restart akior-kiosk.service"
    pass "Kiosk service restarted"
    
    # Wait for kiosk to stabilize
    if [[ $DRY_RUN -eq 0 ]]; then
      log "Waiting for kiosk to stabilize (5 seconds)"
      sleep 5
    fi
  else
    warn "akior-kiosk.service not active - skipping restart"
  fi
fi

echo "" | tee -a "$LOG_FILE"

# === Step 6: Run LAN verification ===
log "Step 6: Running LAN verification"

VERIFY_SCRIPT="${REPO_ROOT}/ops/verify/kiosk-ui-verify.sh"
if [[ ! -f "$VERIFY_SCRIPT" ]]; then
  warn "Verification script not found: $VERIFY_SCRIPT"
  warn "Skipping verification (but rollback actions completed)"
else
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "DRY-RUN: Would run verification: $VERIFY_SCRIPT"
  else
    log "Running: $VERIFY_SCRIPT"
    if bash "$VERIFY_SCRIPT" 2>&1 | tee -a "$LOG_FILE"; then
      pass "LAN verification PASSED"
    else
      fail "LAN verification FAILED - check logs at $LOG_FILE"
    fi
  fi
fi

echo "" | tee -a "$LOG_FILE"

# === Summary ===
echo "=== Rollback Summary ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
pass "Rollback to LAN-only mode completed successfully"
echo "" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [[ $DRY_RUN -eq 1 ]]; then
  warn "DRY-RUN MODE: No actual changes were made"
  echo "" | tee -a "$LOG_FILE"
  exit 2
fi

echo -e "${GREEN}✓ AKIOR is now in LAN-only mode${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Access AKIOR via:" | tee -a "$LOG_FILE"
echo "  • https://akior.local/" | tee -a "$LOG_FILE"
echo "  • https://akior.home.arpa/" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

exit 0
