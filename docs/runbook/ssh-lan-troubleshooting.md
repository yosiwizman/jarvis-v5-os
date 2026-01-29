# SSH LAN Troubleshooting Runbook

This runbook helps diagnose and fix SSH key-only access issues when connecting from Windows to the `aifactory-lan` Ubuntu host.

## Goal

Achieve reliable key-only SSH access so that:

```powershell
ssh -o BatchMode=yes aifactory-lan "hostname && uptime"
```

Succeeds without password prompts. This is required for automation scripts to work without hanging.

## Symptoms & Quick Fixes

### Symptom: BatchMode hangs or times out

**Cause:** SSH is falling back to password auth, but BatchMode=yes disables interactive prompts.

**Fix:** Install your Windows public key on the host (see [Key Installation](#key-installation)).

### Symptom: "Permission denied (publickey,password)"

**Cause:** The key SSH is offering does not match any key in `~/.ssh/authorized_keys` on the host.

**Diagnostics:**
```powershell
# Windows: Check which key is offered
ssh -vvv -o BatchMode=yes aifactory-lan "true" 2>&1 | Select-String "Offering"

# Windows: Get local key fingerprint
ssh-keygen -lf $env:USERPROFILE\.ssh\id_ed25519.pub

# Host: List authorized key fingerprints
ssh aifactory-lan "ssh-keygen -lf ~/.ssh/authorized_keys"
```

**Fix:** If fingerprints don't match, install the correct key (see [Key Installation](#key-installation)).

### Symptom: "Host key verification failed"

**Cause:** Stale entry in `known_hosts` (host IP or key changed).

**Fix:**
```powershell
ssh-keygen -R aifactory-lan
ssh-keygen -R <HOST_IP>
# Then reconnect (will prompt to accept new host key)
ssh -o StrictHostKeyChecking=accept-new aifactory-lan "hostname"
```

### Symptom: "Connection refused" or "Connection timed out"

**Cause:** Host is offline, sshd not running, firewall blocking port 22, or wrong IP.

**Fix:**
```powershell
# Verify IP is reachable
ping <HOST_IP>

# On host: Check sshd status
sudo systemctl status ssh
sudo ss -tlnp | grep :22
```

### Symptom: "banner exchange: Connection to ... port 22: Software caused connection abort"

**Cause:** Network instability, MTU issues, or sshd crashing on connect.

**Fix:**
```bash
# On host: Check sshd logs
sudo journalctl -u ssh -n 50 --no-pager

# On host: Test sshd config syntax
sudo sshd -t
```

## Key Installation

### One-liner (from Windows PowerShell)

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -o StrictHostKeyChecking=accept-new yosi@aifactory-lan "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; sort -u -o ~/.ssh/authorized_keys ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

This will prompt for the host password once.

### Using the setup script

```powershell
# From repo root
.\ops\windows\ssh-setup.ps1
```

The script validates config, installs the key if needed, and verifies BatchMode works.

## Expected Windows SSH Config

Location: `C:\Users\<USERNAME>\.ssh\config`

```
Host aifactory-lan
  HostName <HOST_IP>
  User yosi
  IdentityFile C:\Users\<USERNAME>\.ssh\id_ed25519
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

**Required directives:**
- `HostName` — IP address of the host
- `User` — SSH username
- `IdentityFile` — Path to your ed25519 private key
- `IdentitiesOnly yes` — Prevents SSH agent from offering other keys

## Host-Side Checks

### Verify permissions (must be exact)

```bash
ls -ld ~/.ssh ~/.ssh/authorized_keys
# Expected:
# drwx------ (700) for ~/.ssh
# -rw------- (600) for ~/.ssh/authorized_keys
# Owner must be your user, not root
```

Fix if wrong:
```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chown -R $(whoami):$(whoami) ~/.ssh
```

### Verify sshd accepts pubkey auth

```bash
sudo sshd -T | egrep 'pubkeyauthentication|authorizedkeysfile'
# Expected:
# pubkeyauthentication yes
# authorizedkeysfile .ssh/authorized_keys
```

### Check for CRLF line endings

Windows can introduce CRLF (`\r\n`) into `authorized_keys`, which breaks SSH.

```bash
# Check for CRLF
cat -A ~/.ssh/authorized_keys | head -2
# If you see ^M at end of lines, fix with:
dos2unix ~/.ssh/authorized_keys
# Or:
sed -i 's/\r$//' ~/.ssh/authorized_keys
```

### View sshd logs for auth failures

```bash
sudo journalctl -u ssh -n 80 --no-pager | tail -40
```

Look for lines like:
- `Authentication refused: bad ownership or modes for file`
- `User yosi from x.x.x.x not allowed because not listed in AllowUsers`
- `error: key_read: ... invalid format`

## Verification Commands

### Final verification (must pass)

```powershell
ssh -o BatchMode=yes aifactory-lan "echo BATCHMODE_OK && whoami && hostname && uptime"
```

Expected output:
```
BATCHMODE_OK
yosi
aifactory
 12:34:56 up 1 day,  2:03,  1 user,  load average: 0.00, 0.00, 0.00
```

### Verbose diagnostics

```powershell
ssh -vvv -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -o IdentitiesOnly=yes -o BatchMode=yes aifactory-lan "true" 2>&1 | Select-String -Pattern "Offering|Authentications|Permission denied|identity"
```

## Common Root Causes Summary

| Issue | Symptom | Fix |
|-------|---------|-----|
| Wrong key | Permission denied | Install correct key |
| Key not installed | BatchMode hangs | Run key install one-liner |
| Bad permissions | Permission denied | chmod 700/600, chown user |
| CRLF in authorized_keys | Key rejected | dos2unix |
| sshd AuthorizedKeysFile mismatch | Key not found | Check sshd -T output |
| Stale known_hosts | Host key verification failed | ssh-keygen -R |
| Host offline / sshd down | Connection refused | Check systemctl status ssh |

## Automation Best Practices

When using SSH in scripts:

```powershell
# Always use BatchMode and timeouts
ssh -o BatchMode=yes -o ConnectTimeout=5 -o ServerAliveInterval=10 -o ServerAliveCountMax=1 aifactory-lan "command"
```

This ensures:
- No hanging on password prompts
- Fast failure on network issues
- Detection of stale connections
