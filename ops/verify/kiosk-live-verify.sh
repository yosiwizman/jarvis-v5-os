#!/usr/bin/env bash
# ops/verify/kiosk-live-verify.sh
# Live verification for AKIOR kiosk (service, processes, chromium log, URL).

set -euo pipefail

section() {
  echo ""
  echo "=== $1 ==="
}

KIOSK_URL="${KIOSK_URL:-}"
if [ -z "$KIOSK_URL" ] && [ -f /etc/systemd/system/akior-kiosk.service ]; then
  KIOSK_URL="$(grep -E '^Environment=KIOSK_URL=' /etc/systemd/system/akior-kiosk.service | head -n 1 | sed 's/^Environment=KIOSK_URL=//')"
fi
KIOSK_URL="${KIOSK_URL:-https://akior.local/menu}"

LOG_FILE="/home/akior-kiosk/.local/share/jarvis-kiosk/kiosk.log"

section "systemd status"
systemctl status akior-kiosk.service --no-pager -l || true

section "systemd show"
systemctl show akior-kiosk.service -p ActiveState -p SubState -p Result -p MainPID -p NRestarts || true

section "processes"
pgrep -a Xorg || true
pgrep -a openbox || true
pgrep -a chromium || true
pgrep -a chromium-browser || true

section "chromium log tail"
if [ -f "$LOG_FILE" ]; then
  tail -n 120 "$LOG_FILE" || true
else
  echo "(missing $LOG_FILE)"
fi

section "kiosk url"
if command -v curl >/dev/null 2>&1; then
  curl -kIs --max-time 10 "$KIOSK_URL" | head -n 1 || true
else
  echo "(curl not installed)"
fi
