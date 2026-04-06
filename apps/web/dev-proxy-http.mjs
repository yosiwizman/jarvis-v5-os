import http from 'node:http';
import httpProxy from 'http-proxy';
import { parse } from 'node:url';

const NEXT_TARGET = 'http://localhost:3001';
const API_TARGET = 'http://localhost:3002';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
});

function pickTarget(req) {
  const pathname = parse(req.url).pathname || '/';
  if (pathname.startsWith('/socket.io')) return API_TARGET;
  if (pathname.startsWith('/files/') || pathname.startsWith('/static/')) return API_TARGET;
  if (pathname.startsWith('/api/proxy-model')) return NEXT_TARGET;
  if (pathname.startsWith('/api')) return API_TARGET;
  return NEXT_TARGET;
}

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    try { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Bad Gateway'); } catch {}
  }
});

const server = http.createServer((req, res) => {
  const target = pickTarget(req);
  proxy.web(req, res, { target }, (err) => {
    if (err && !res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); }
  });
});

server.on('upgrade', (req, socket, head) => {
  const target = pickTarget(req);
  socket.on('error', () => {});
  proxy.ws(req, socket, head, { target }, (err) => {
    if (err) try { socket.destroy(); } catch {}
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Dev HTTP proxy on http://0.0.0.0:3000 → Next(:3001) & API(:3002)');
});
