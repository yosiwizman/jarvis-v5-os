# AKIOR LAN Onboarding

This runbook explains the **first-run setup** for AKIOR on the LAN. The in-app onboarding page at `/onboard` mirrors these steps.

## Quick start checklist

1. **Use HTTPS**
   - Open `https://akior.local` on every device.
   - If you see a warning banner, switch from HTTP/IP to the canonical host.

2. **Verify health**
   - `https://akior.local/api/health`
   - `https://akior.local/api/health/build`

3. **Add API keys**
   - Go to `/settings#provider-keys`
   - Configure OpenAI and Meshy keys (stored server-side).

4. **Test voice**
   - Go to `/akior` and confirm microphone access + audio playback.

5. **Optional: Trust LAN certificate**
   - Follow `docs/ops/lan-tls-trust.md` to install the LAN root CA on the device.

## What “good” looks like

- Browser shows **Secure** at `https://akior.local`
- `/api/health` returns `{ "ok": true }`
- `/api/health/build` returns the current git SHA
- Voice assistant connects without errors
- Settings page loads without crashes

## Troubleshooting

- **HTTP/IP access**: Use the canonical host `https://akior.local` for secure context.
- **TLS warnings**: Install the LAN root CA using `docs/ops/lan-tls-trust.md`.
- **Build mismatch**: Redeploy and verify with the operator scripts.
