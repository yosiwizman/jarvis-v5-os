# AKIOR Kiosk Troubleshooting

This runbook focuses on the two most common failure modes on headless Ubuntu hosts:
- Xorg stuck on a stale display lock (`/tmp/.X0-lock`)
- NVIDIA GPU failing under nouveau (`nvc0_screen_create... Base screen init failed: -19`)

## Quick Diagnostics
From the repo root on the server:
```bash
sudo bash ops/verify/kiosk-diagnostics.sh
```
## Chromium logging / verification
Kiosk session log:
- `/home/akior-kiosk/.local/share/akior-kiosk/kiosk.log`

Tail it:
```bash
sudo tail -n 120 /home/akior-kiosk/.local/share/akior-kiosk/kiosk.log
```
If Chromium exits immediately, check whether `XDG_RUNTIME_DIR` is present in the log (missing runtime dir can break snap chromium sessions).

Expected processes:
```bash
pgrep -a Xorg || true
pgrep -a openbox || true
pgrep -a chromium || true
```

## Remote deploy (tmux + bounded verify)
Prefer tmux so deploys survive SSH disconnects:
```bash
tmux new-session -Ad -s kioskdeploy 'sudo /opt/akior/AKIOR-V5-OS/ops/deploy/deploy-kiosk.sh'
tmux attach -t kioskdeploy
```

The deploy script writes a verification output file under `/tmp/kiosk_verify_<timestamp>.out`.
Tail it:
```bash
ls -t /tmp/kiosk_verify_*.out | head -n 1
tail -n 120 /tmp/kiosk_verify_YYYYMMDDTHHMMSS.out
```

The deploy now **fails hard** if the verify gate fails. For the exact checks and overrides, see `docs/ops/KIOSK_VERIFY.md`.

SSH keepalive (optional):
```bash
ssh -tt -o ServerAliveInterval=30 -o ServerAliveCountMax=4 aifactory-lan
```

## Break a Restart Storm (service flapping)
```bash
sudo systemctl disable --now akior-kiosk.service || true
sudo systemctl reset-failed akior-kiosk.service || true
sudo pkill -9 Xorg || true
sudo pkill -9 startx || true
sudo pkill -9 xinit || true
sudo pkill -9 openbox || true
sudo pkill -9 chromium || true
sudo rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 || true
```
Then reinstall unit + xinitrc from the repo and restart the service.

## Symptom: logind session / VT permission denied
Journal/Xorg excerpt:
- `systemd-logind: failed to get session: PID ... does not belong to any known session`
- `xf86OpenConsole: Cannot open virtual console 7 (Permission denied)`

Rootless Xorg launched by systemd without a login session cannot access the VT.

Fix (service directives under `[Service]`):
- `PAMName=login`
- `StandardInput=tty`
- `TTYPath=/dev/tty7`
- `TTYReset=yes`
- `TTYVHangup=yes`
- `TTYVTDisallocate=yes`

Also remove `-keeptty` from the Xorg args in `ExecStart` to avoid conflicting with systemd-managed TTYs.

## Symptom: "Server is already active for display 0" / stale X locks
Typical journal excerpt:
- `Server is already active for display 0`
- `If this server is no longer running, remove /tmp/.X0-lock`

Fix:
1) Stop service + kill stray processes (see above)
2) Ensure the unit has a preflight cleanup that removes `/tmp/.X0-lock` and `/tmp/.X11-unix/X0`
3) Restart:
```bash
sudo systemctl restart akior-kiosk.service
sudo systemctl status akior-kiosk.service --no-pager
```

## Symptom: nouveau / nvc0 failure (NVIDIA)
Xorg log/journal excerpt:
- `nvc0_screen_create:... Base screen init failed: -19`

This strongly suggests an NVIDIA GPU running under nouveau where Xorg fails to initialize the device.

### Confirm
```bash
lsmod | egrep 'nouveau|nvidia' || true
nvidia-smi || true
ubuntu-drivers devices || true
```
- If `nouveau` is loaded OR `nvidia-smi` fails, proceed to install the proprietary driver.

### Fix (recommended)
1) Stop kiosk (avoid restart storms during driver work):
```bash
sudo systemctl stop akior-kiosk.service || true
```
2) Install recommended driver:
```bash
sudo apt-get update -y
sudo ubuntu-drivers autoinstall -y
```
3) Blacklist nouveau and rebuild initramfs:
```bash
sudo tee /etc/modprobe.d/blacklist-nouveau.conf >/dev/null <<'EOF'
blacklist nouveau
options nouveau modeset=0
EOF
sudo update-initramfs -u
```
4) Reboot:
```bash
sudo reboot
```

### Post-reboot verify
```bash
nvidia-smi
lsmod | egrep 'nouveau|nvidia'
```
- Expect `nvidia` modules loaded, and `nouveau` absent.

### Bring kiosk back
```bash
sudo systemctl enable --now akior-kiosk.service
sudo systemctl status akior-kiosk.service --no-pager
journalctl -u akior-kiosk.service -n 120 --no-pager
ps aux | egrep 'Xorg|openbox|chromium|startx|xinit' | grep -v egrep
```

## Symptom: chvt fails "Operation not permitted"
If VT switching fails, ensure the unit runs `chvt` as root and never fails the service.
Example:
- `ExecStartPost=+/bin/sh -lc '/usr/bin/chvt 7 || true'`
