# Kiosk Verify Gate

This is the deterministic bring-up gate invoked by `ops/deploy/deploy-kiosk.sh`.
The deploy **fails** if any check does not pass.

## What it checks
1. `akior-kiosk` systemd service is active.
2. Xorg is up on `:0` (process match or `/tmp/.X0-lock` / `/tmp/.X11-unix/X0`).
3. Chromium process exists (`chromium` or `chromium-browser`).
4. Port for the verify URL is listening (via `ss` or `netstat`).
5. HTTP **200** with a **non-empty body** from the kiosk UI endpoint, and prints the first ~5 lines.

## How to run manually (on the host)
```bash
sudo bash ops/verify/kiosk-ui-verify.sh
```

## Override the endpoint
By default it uses the `KIOSK_URL` from the systemd unit (falls back to `https://akior.local/menu`).
You can override:
```bash
# Override full URL (example: local HTTP on 32137)
KIOSK_VERIFY_URL=http://localhost:32137/ sudo bash ops/verify/kiosk-ui-verify.sh

# Override the port check explicitly
KIOSK_VERIFY_PORT=32137 sudo bash ops/verify/kiosk-ui-verify.sh
```

## Deploy output
The deploy writes verification output to:
```
/tmp/kiosk_verify_<timestamp>.out
```
