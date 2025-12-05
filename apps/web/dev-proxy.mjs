import fs from 'node:fs';
import https from 'node:https';
import httpProxy from 'http-proxy';
import { parse } from 'node:url';

const key = fs.readFileSync('./certs/dev-host-key.pem');
const cert = fs.readFileSync('./certs/dev-host.pem');

const NEXT_TARGET = 'http://localhost:3001';
const API_TARGET = 'https://localhost:1234'; // Backend runs HTTPS

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: false // Accept self-signed certs from backend
});

function pickTarget(req) {
  const pathname = parse(req.url).pathname || '/';
  // Socket.IO always goes to backend
  if (pathname.startsWith('/socket.io')) {
    return API_TARGET;
  }
  // Static files served by backend
  if (pathname.startsWith('/files/') || pathname.startsWith('/static/')) {
    return API_TARGET;
  }
  // Special Next.js API route
  if (pathname.startsWith('/api/proxy-model')) {
    return NEXT_TARGET;
  }
  // All other /api routes go to backend
  if (pathname.startsWith('/api')) {
    return API_TARGET;
  }
  // Everything else goes to Next.js
  return NEXT_TARGET;
}

// Handle proxy errors to prevent crashes
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    try {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway: ' + err.message);
    } catch (e) {
      // Response already ended
    }
  }
});

// Handle WebSocket proxy errors
proxy.on('proxyReqWs', (proxyReq, req, socket) => {
  socket.on('error', (err) => {
    console.error('WebSocket connection error:', err.message);
  });
});

// Add global error handler for unhandled errors
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    console.error('Connection error (non-fatal):', err.message);
  } else {
    console.error('Uncaught exception:', err);
    process.exit(1);
  }
});

const server = https.createServer({ key, cert }, (req, res) => {
  const target = pickTarget(req);
  
  // Strip /api prefix when forwarding to backend
  if (target === API_TARGET && req.url && req.url.startsWith('/api')) {
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
      if (!req.url.startsWith('/')) {
        req.url = '/' + req.url;
      }
    }
  }
  
  proxy.web(req, res, { target }, (err) => {
    if (err) {
      console.error('Failed to proxy request:', req.url, err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Bad Gateway');
      }
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const target = pickTarget(req);
  
  // Handle socket errors to prevent crashes
  socket.on('error', (err) => {
    console.error('WebSocket socket error:', err.message);
  });
  
  proxy.ws(req, socket, head, { target }, (err) => {
    if (err) {
      console.error('Failed to proxy WebSocket:', req.url, err.message);
      try {
        socket.destroy();
      } catch (e) {
        // Socket already destroyed
      }
    }
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Dev TLS proxy on https://<host-or-ip>:3000 → Next(:3001) & API(:1234)');
});
