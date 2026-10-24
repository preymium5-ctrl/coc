import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const token = process.env.COC_API_TOKEN;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.json':'application/json' };
const cache = new Map();
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(data)); };

http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, {error:'Method not allowed.'});
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/status') return json(res, 200, {connected:!!token});
    if (url.pathname.startsWith('/api/players/')) {
      if (!token) return json(res, 503, {error:'Player lookup is not connected. Configure COC_API_TOKEN on the server.'});
      const tag = decodeURIComponent(url.pathname.slice('/api/players/'.length)).toUpperCase();
      if (!/^#[0289PYLQGRJCUV]{3,15}$/.test(tag)) return json(res, 400, {error:'Invalid player tag.'});
      const cached = cache.get(tag);
      if (cached && cached.expires > Date.now()) return json(res, 200, cached.data);
      const upstream = await fetch(`https://api.clashofclans.com/v1/players/${encodeURIComponent(tag)}`, {headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
      if (!upstream.ok) {
        const messages = {403:'Supercell rejected the server key or its allowed IP address.',404:'That player was not found. Check the player tag.',429:'Supercell is limiting requests. Try again shortly.',503:'Clash of Clans is undergoing maintenance. Try again later.'};
        return json(res, upstream.status, {error:messages[upstream.status] || 'The profile service is temporarily unavailable.'});
      }
      const data = await upstream.json();
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(tag, {data,expires:Date.now()+60000});
      return json(res, 200, data);
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, {error:'API route not found.'});
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filename = path.resolve(root, relative);
    if (filename !== root && !filename.startsWith(root + path.sep)) return json(res, 403, {error:'Forbidden.'});
    const info = await stat(filename);
    if (!info.isFile()) return json(res, 404, {error:'Not found.'});
    res.writeHead(200, {'Content-Type':mime[path.extname(filename)] || 'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(filename);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) return res.destroy();
    if (error.code === 'ENOENT') return json(res, 404, {error:'Not found.'});
    if (error instanceof URIError) return json(res, 400, {error:'Invalid URL.'});
    if (error.name === 'TimeoutError') return json(res, 504, {error:'The profile service timed out. Try again.'});
    return json(res, 500, {error:'Something went wrong. Try again.'});
  }
}).listen(port, '127.0.0.1', () => console.log(`Raidroom ready at http://127.0.0.1:${port}`));
