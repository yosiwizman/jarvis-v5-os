import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

function getPrimaryIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const entry of interfaces[name] || []) {
        if (entry.family === 'IPv4' && !entry.internal) {
          return entry.address;
        }
      }
    }
  } catch (error) {
    console.warn('Could not detect network interfaces, using localhost only');
  }
  return '127.0.0.1';
}

const ip = process.env.DEV_IP || getPrimaryIp();
const dir = path.resolve('apps/web/certs');
const certPath = path.join(dir, 'dev-host.pem');
const keyPath = path.join(dir, 'dev-host-key.pem');

fs.mkdirSync(dir, { recursive: true });

try {
  // Skip mkcert -install if it fails (needs sudo for system trust store)
  try {
    execSync('mkcert -install', { stdio: 'inherit' });
  } catch {
    console.warn('mkcert -install failed (needs sudo) — skipping CA install, certs will be untrusted but functional for dev');
  }
  execSync(`mkcert -cert-file "${certPath}" -key-file "${keyPath}" ${ip} localhost 127.0.0.1 ::1`, {
    stdio: 'inherit'
  });
  console.log(`Generated dev cert for IP ${ip}: ${certPath}`);
} catch (error) {
  console.error('mkcert failed. Install via: brew install mkcert nss');
  process.exit(1);
}
