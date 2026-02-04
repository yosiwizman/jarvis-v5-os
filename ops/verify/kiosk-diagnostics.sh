#!/usr/bin/env bash
# ops/verify/kiosk-diagnostics.sh
# Collects bounded diagnostics for AKIOR kiosk failures (systemd, Xorg, GPU driver).

set -euo pipefail

section() {
  echo ""
  echo "===== $1 ====="
}

section "Time / host"
date || true
hostname || true
uname -a || true

section "Installed unit key lines (/etc/systemd/system/akior-kiosk.service)"
if [ -f /etc/systemd/system/akior-kiosk.service ]; then
  egrep -n '^(\[Unit\]|\[Service\]|\[Install\]|User=|WorkingDirectory=|Environment=|ExecStartPre=|ExecStart=|ExecStartPost=|Restart=|RestartSec=|TimeoutStartSec=|TimeoutStopSec=|KillMode=|StartLimit)' /etc/systemd/system/akior-kiosk.service || true
else
  echo "(missing /etc/systemd/system/akior-kiosk.service)"
fi

section "systemctl status (akior-kiosk.service)"
systemctl status akior-kiosk.service --no-pager || true

section "journalctl last 120 (akior-kiosk.service)"
journalctl -u akior-kiosk.service -n 120 --no-pager || true

section "Processes (Xorg/startx/xinit/openbox/chromium)"
ps aux | egrep 'Xorg|startx|xinit|openbox|chromium' | grep -v egrep || true

section "Stale X locks"
ls -la /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true

section "VT info"
fgconsole 2>/dev/null || true
ls -l /dev/tty7 2>/dev/null || true
id akior-kiosk 2>/dev/null || true

section "Binary locations"
command -v startx || true
command -v Xorg || true
command -v openbox-session || true
command -v chromium-browser || true
command -v chromium || true
command -v /snap/bin/chromium || true

section "GPU (lspci -nnk graphics)"
lspci -nnk | egrep -A3 'VGA|3D|Display' || true

section "Kernel modules (nouveau/nvidia)"
lsmod | egrep 'nvidia|nouveau' || true

section "nvidia-smi"
nvidia-smi || true

section "ubuntu-drivers devices"
ubuntu-drivers devices || true

section "Xorg log tail (akior-kiosk user)"
tail -n 160 /home/akior-kiosk/.local/share/xorg/Xorg.0.log 2>/dev/null || true

section "Xorg log tail (/var/log/Xorg.0.log)"
tail -n 160 /var/log/Xorg.0.log 2>/dev/null || true

section "DRI devices (/dev/dri)"
ls -la /dev/dri 2>/dev/null || true
ls -la /dev/dri/card* /dev/dri/renderD* 2>/dev/null || true

echo ""
echo "OK"
