#!/usr/bin/env bash
# ops/verify/kiosk-ui-verify.sh
# Deterministic kiosk bring-up verification for AKIOR console UI.
# Fails the deploy if kiosk is not actually up.

set -euo pipefail

log() {
  echo "[$(date -Is)] $*"
}

fail() {
  log "FAIL: $*"
  exit 1
}

log "kiosk-ui-verify start host=$(hostname)"

if systemctl is-active --quiet akior-kiosk; then
  log "systemd: akior-kiosk is active"
else
  systemctl status akior-kiosk.service --no-pager -l || true
  fail "akior-kiosk.service is not active"
fi

X_OK=0
if pgrep -a Xorg | grep -q " :0"; then
  X_OK=1
fi
if [ "$X_OK" -eq 0 ]; then
  if [ -S /tmp/.X11-unix/X0 ] || [ -f /tmp/.X0-lock ]; then
    X_OK=1
  fi
fi
if [ "$X_OK" -eq 1 ]; then
  log "Xorg :0 detected"
else
  pgrep -a Xorg || true
  ls -la /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true
  fail "No indication Xorg is running for :0"
fi

if pgrep -af chromium >/dev/null 2>&1 || pgrep -af chromium-browser >/dev/null 2>&1; then
  pgrep -af chromium || true
  pgrep -af chromium-browser || true
  log "Chromium process detected"
else
  pgrep -af chromium || true
  pgrep -af chromium-browser || true
  fail "Chromium process not found"
fi

KIOSK_URL=""
if [ -f /etc/systemd/system/akior-kiosk.service ]; then
  KIOSK_URL="$(grep -E '^Environment=KIOSK_URL=' /etc/systemd/system/akior-kiosk.service | head -n 1 | sed 's/^Environment=KIOSK_URL=//')"
fi
KIOSK_URL="${KIOSK_URL:-https://akior.local/menu}"

VERIFY_URL="${KIOSK_VERIFY_URL:-$KIOSK_URL}"
VERIFY_PORT="${KIOSK_VERIFY_PORT:-}"
if [ -z "$VERIFY_PORT" ]; then
  if [[ "$VERIFY_URL" =~ :([0-9]+)(/|$) ]]; then
    VERIFY_PORT="${BASH_REMATCH[1]}"
  elif [[ "$VERIFY_URL" == https://* ]]; then
    VERIFY_PORT="443"
  else
    VERIFY_PORT="80"
  fi
fi

log "verify url: ${VERIFY_URL}"
log "verify port: ${VERIFY_PORT}"

LISTEN_OK=0
if command -v ss >/dev/null 2>&1; then
  if ss -ltnp | grep -q ":${VERIFY_PORT}"; then
    LISTEN_OK=1
  fi
elif command -v netstat >/dev/null 2>&1; then
  if netstat -ltnp 2>/dev/null | grep -q ":${VERIFY_PORT}"; then
    LISTEN_OK=1
  fi
fi

if [ "$LISTEN_OK" -eq 1 ]; then
  log "Listener :${VERIFY_PORT} present"
else
  log "Listener :${VERIFY_PORT} missing"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltnp || true
  else
    log "Neither ss nor netstat available"
  fi
  fail "Port ${VERIFY_PORT} is not listening"
fi

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required for HTTP verification"
fi

BODY_FILE="$(mktemp /tmp/kiosk_verify_body.XXXXXX)"
trap 'rm -f "$BODY_FILE"' EXIT

CURL_ARGS=(-sS --max-time 10)
if [[ "$VERIFY_URL" == https://* ]]; then
  CURL_ARGS+=(-k)
fi

HTTP_CODE="$(curl "${CURL_ARGS[@]}" -o "$BODY_FILE" -w '%{http_code}' "$VERIFY_URL" || true)"
if [ "$HTTP_CODE" != "200" ]; then
  log "HTTP $HTTP_CODE from $VERIFY_URL"
  if [ -s "$BODY_FILE" ]; then
    log "Body (first 5 lines):"
    head -n 5 "$BODY_FILE" || true
  fi
  fail "Non-200 response from $VERIFY_URL"
fi

if [ ! -s "$BODY_FILE" ]; then
  fail "Empty response body from $VERIFY_URL"
fi

log "HTTP 200 from $VERIFY_URL"
log "Body (first 5 lines):"
head -n 5 "$BODY_FILE" || true

log "Additional health checks"
HEALTH_32137="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://*********:32137/health || echo 000)"
HEALTH_443="$(curl -ksS --max-time 5 -o /dev/null -w '%{http_code}' https://*********:443/health || echo 000)"
log "HTTP 32137 /health: $HEALTH_32137"
log "HTTPS 443 /health: $HEALTH_443"

if [ "$HEALTH_32137" != "200" ] && [ "$HEALTH_443" != "200" ]; then
  log "WARNING: No /health endpoint returned HTTP 200 (32137=$HEALTH_32137, 443=$HEALTH_443)"
fi

log "Kiosk UI verification PASSED"
