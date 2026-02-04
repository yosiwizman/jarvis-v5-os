#!/bin/sh
# AKIOR kiosk session launcher (runs under akior-kiosk user)
set -u

export DISPLAY="${DISPLAY:-:0}"
export PATH="$PATH:/snap/bin"
export HOME="/home/akior-kiosk"

KIOSK_URL="${KIOSK_URL:-https://akior.local/menu}"
LOG_DIR="$HOME/.local/share/jarvis-kiosk"
LOG_FILE="$LOG_DIR/kiosk.log"
PROFILE_DIR="$HOME/.chromium-kiosk"

mkdir -p "$LOG_DIR" "$PROFILE_DIR"
touch "$LOG_FILE"

log() {
  ts="$(date -Is)"
  echo "$ts $*"
  echo "$ts $*" >> "$LOG_FILE"
}

log "[akior-kiosk] session start"
log "[akior-kiosk] KIOSK_URL=$KIOSK_URL"

USER_ID="$(id -u)"
export XDG_RUNTIME_DIR="/run/user/${USER_ID}"
if [ -d "$XDG_RUNTIME_DIR" ]; then
  export DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
  log "[akior-kiosk] XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
else
  log "[akior-kiosk] XDG_RUNTIME_DIR missing: $XDG_RUNTIME_DIR"
fi

# Keep display awake
xset -dpms || true
xset s off || true
xset s noblank || true

# Start minimal window manager
openbox-session &
sleep 1

CHROME_BIN="$(command -v chromium-browser || command -v chromium || command -v /snap/bin/chromium || true)"
if [ -z "$CHROME_BIN" ]; then
  log "[akior-kiosk] chromium not found (expected chromium-browser/chromium)"
  exit 1
fi
log "[akior-kiosk] chromium bin=$CHROME_BIN"

USE_DBUS=0
if command -v dbus-run-session >/dev/null 2>&1 && [ "$CHROME_BIN" = "/snap/bin/chromium" ]; then
  USE_DBUS=1
fi

wait_for_chromium() {
  i=0
  while [ $i -lt 20 ]; do
    if pgrep -x chromium >/dev/null 2>&1 || pgrep -x chromium-browser >/dev/null 2>&1; then
      log "[akior-kiosk] chromium process detected"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  log "[akior-kiosk] chromium not detected after 20s"
  return 1
}

check_url() {
  if command -v curl >/dev/null 2>&1; then
    status="$(curl -kIs --max-time 5 "$KIOSK_URL" | head -n 1 || true)"
    log "[akior-kiosk] url status: ${status:-unknown}"
  fi
}

MODE="normal"
while :; do
  if [ "$MODE" = "fallback" ]; then
    GPU_FLAGS="--disable-gpu --disable-software-rasterizer"
    log "[akior-kiosk] launching chromium (gpu disabled)"
  else
    GPU_FLAGS=""
    log "[akior-kiosk] launching chromium"
  fi

  start_ts="$(date +%s)"
  if [ "$USE_DBUS" -eq 1 ]; then
    dbus-run-session -- "$CHROME_BIN" \
      --kiosk \
      --start-fullscreen \
      --no-first-run \
      --password-store=basic \
      --no-default-browser-check \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-restore-session-state \
      --disable-features=TranslateUI \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --ignore-certificate-errors \
      --disable-background-networking \
      --autoplay-policy=no-user-gesture-required \
      --user-data-dir="$PROFILE_DIR" \
      $GPU_FLAGS \
      "$KIOSK_URL" &
  else
    "$CHROME_BIN" \
      --kiosk \
      --start-fullscreen \
      --no-first-run \
      --password-store=basic \
      --no-default-browser-check \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-restore-session-state \
      --disable-features=TranslateUI \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --ignore-certificate-errors \
      --disable-background-networking \
      --autoplay-policy=no-user-gesture-required \
      --user-data-dir="$PROFILE_DIR" \
      $GPU_FLAGS \
      "$KIOSK_URL" &
  fi

  CHROME_PID=$!
  wait_for_chromium || true
  check_url || true

  wait "$CHROME_PID"
  rc=$?
  end_ts="$(date +%s)"
  runtime=$((end_ts - start_ts))
  log "[akior-kiosk] chromium exited rc=$rc runtime=${runtime}s"

  if [ "$MODE" = "normal" ] && [ "$runtime" -lt 10 ]; then
    MODE="fallback"
    log "[akior-kiosk] chromium exited quickly; next launch will disable GPU"
  else
    MODE="normal"
  fi

  sleep 2
done
