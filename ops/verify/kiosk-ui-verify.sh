#!/usr/bin/env bash
# ops/verify/kiosk-ui-verify.sh
# Verifies kiosk service, processes, logs, and recent journal output.

set -euo pipefail

section() {
  echo ""
  echo "=== $1 ==="
}

LOG_FILE="/home/akior-kiosk/.local/share/jarvis-kiosk/kiosk.log"

section "systemd status"
systemctl status akior-kiosk.service --no-pager -l || true

section "processes"
pgrep -a Xorg || true
pgrep -a openbox || true
pgrep -a chromium || true
pgrep -a chromium-browser || true

section "kiosk log tail"
if [ -f "$LOG_FILE" ]; then
  tail -n 120 "$LOG_FILE" || true
else
  echo "(missing $LOG_FILE)"
fi

section "journal tail"
journalctl -u akior-kiosk.service -n 100 --no-pager || true
