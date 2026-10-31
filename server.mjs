import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectEnv } from './env.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const localEnv = await readProjectEnv();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relativePath = pathname.startsWith('/assets/') ? join('public', pathname.slice(1)) : pathname;
  let file = normalize(join(root, relativePath));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const content = pathname === '/cms-config.js'
      ? Buffer.from(`window.ECT_CMS_CONFIG = Object.freeze(${JSON.stringify({
          supabaseUrl: process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || '',
          supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || localEnv.SUPABASE_PUBLISHABLE_KEY || localEnv.SUPABASE_ANON_KEY || '',
        })});\n`)
      : await readFile(file);
    const body = ['/robots.txt', '/sitemap.xml'].includes(pathname)
      ? content.toString('utf8').replaceAll('__SITE_ORIGIN__', `http://${req.headers.host || 'localhost:3000'}`)
      : content;
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    if (extname(pathname)) { res.writeHead(404).end('Not found'); return; }
    try { res.writeHead(200, { 'Content-Type': mime['.html'] }).end(await readFile(join(root, 'index.html'))); }
    catch { res.writeHead(500).end('Unable to load the site'); }
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`Easy Creative Tours is running at http://localhost:${port}`));
