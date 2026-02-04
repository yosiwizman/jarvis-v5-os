#!/usr/bin/env bash
# ops/deploy/deploy-kiosk.sh
# Idempotent kiosk deploy + verify

set -euo pipefail

log() {
  echo "[$(date -Is)] $*"
}

REPO_DIR="/opt/jarvis/JARVIS-V5-OS"
KIOSK_USER="akior-kiosk"
KIOSK_HOME="/home/${KIOSK_USER}"
KEY_PATH="/root/.ssh/jarvis_github_deploy_ed25519"

log "Deploying kiosk from ${REPO_DIR}"

if [ -d "$REPO_DIR" ]; then
  cd "$REPO_DIR"
else
  log "Repo directory missing: $REPO_DIR"
  exit 1
fi

if [ -f "$KEY_PATH" ]; then
  export GIT_SSH_COMMAND="ssh -i $KEY_PATH -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

log "Fetch origin/main"
GIT_TERMINAL_PROMPT=0 git fetch origin

log "Reset to origin/main"
git reset --hard origin/main
git clean -fd

log "Install unit + kiosk files"
cp deploy/systemd/akior-kiosk.service /etc/systemd/system/akior-kiosk.service
cp deploy/kiosk/xinitrc "$KIOSK_HOME/.xinitrc"
cp deploy/kiosk/kiosk-session.sh "$KIOSK_HOME/kiosk-session.sh"

chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.xinitrc" "$KIOSK_HOME/kiosk-session.sh"
chmod 755 "$KIOSK_HOME/.xinitrc" "$KIOSK_HOME/kiosk-session.sh"
mkdir -p "$KIOSK_HOME/.local/share/jarvis-kiosk"
chown -R "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.local/share/jarvis-kiosk"

systemctl daemon-reload
systemctl enable akior-kiosk.service

log "Restart kiosk"
systemctl restart akior-kiosk.service

log "Verify kiosk"
VERIFY_OUT="/tmp/kiosk_verify_$(date +%Y%m%dT%H%M%S).out"
if [ -x ops/verify/kiosk-ui-verify.sh ]; then
  bash ops/verify/kiosk-ui-verify.sh > "$VERIFY_OUT" 2>&1 || true
else
  echo "(missing ops/verify/kiosk-ui-verify.sh)" > "$VERIFY_OUT"
fi

log "Verification output: $VERIFY_OUT"
tail -n 120 "$VERIFY_OUT" || true
