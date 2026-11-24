import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL(process.env.DAYMARK_SERVE_DIST === '1' ? '../dist/' : '../', import.meta.url));
const port = Number(process.env.PORT || 4174);
const types = {'.png':'image/png','.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.json':'application/json'};
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root) || pathname.includes('..') || pathname.includes('\\')) { res.writeHead(403); res.end(); return; }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, {'Content-Type':(types[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; script-src 'self' https://apis.google.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    res.end(req.method === 'HEAD' ? undefined : await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Daymark is ready at http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
