// ORBYTE — local server (npm start). On Vercel you don't need this file:
// Vercel serves /public and runs the functions in /api automatically.
//   GET  /            → files from ./public
//   GET  /api/health  → { ok } when the assistant is configured
//   GET  /api/markets → live prices (?vs=usd|idr), cached 60 s
//   POST /api/chat    → streams ORBYTE AI's answer
// Zero dependencies. Requires Node.js 18 or newer.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* ---------- load .env (simple KEY=VALUE lines) before the shared modules read it ---------- */
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env file — use real environment variables */ }

const { GET: health } = await import('./api/health.js');
const { GET: markets } = await import('./api/markets.js');
const { handleChat } = await import('./lib/chat.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(ROOT, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // e.g. https://www.orbyte.app if the page is hosted elsewhere
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' };

/* ---------- bridge Node req/res ↔ Web Request/Response ---------- */
function toRequest(req) {
  const ac = new AbortController(); req.on('close', () => { if (!req.complete) ac.abort(); });
  const init = { method: req.method, headers: req.headers, signal: ac.signal };
  if (req.method !== 'GET' && req.method !== 'HEAD') { init.body = Readable.toWeb(req); init.duplex = 'half'; }
  return { request: new Request(`http://localhost${req.url}`, init), abort: () => ac.abort() };
}
async function send(res, response, abort) {
  const headers = Object.fromEntries(response.headers);
  res.writeHead(response.status, headers);
  if (!response.body) return res.end();
  res.on('close', () => { abort(); });
  try { for await (const chunk of response.body) res.write(chunk); } catch {}
  res.end();
}

/* ---------- static files ---------- */
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- router ---------- */
http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname.startsWith('/api/')) {
      if (ALLOWED_ORIGIN && req.headers.origin === ALLOWED_ORIGIN) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN); res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const { request, abort } = toRequest(req);
      const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'anon';
      if (pathname === '/api/health' && req.method === 'GET') return send(res, await health(request), abort);
      if (pathname === '/api/markets' && req.method === 'GET') return send(res, await markets(request), abort);
      if (pathname === '/api/chat' && req.method === 'POST') return send(res, await handleChat(request, ip), abort);
      res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not_found"}');
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error('[server]', e);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"server_error"}'); }
  }
}).listen(PORT, () => {
  console.log(`ORBYTE running at http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? `Assistant: on (model ${process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'})` : 'Assistant: OFF — set ANTHROPIC_API_KEY in .env to turn it on');
});
