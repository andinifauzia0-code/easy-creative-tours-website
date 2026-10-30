import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const output = resolve(root, 'dist');
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (process.env.VERCEL && !vercelHost && !process.env.PUBLIC_SITE_URL) {
  throw new Error('Vercel build has no production URL. Enable Vercel System Environment Variables or set PUBLIC_SITE_URL.');
}
const siteOrigin = (process.env.PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')).replace(/\/$/, '');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'src.js', 'styles.css', 'robots.txt', 'sitemap.xml']) {
  const contents = await readFile(resolve(root, file), 'utf8');
  await writeFile(resolve(output, file), contents.replaceAll('__SITE_ORIGIN__', siteOrigin));
}
await cp(resolve(root, 'public/assets'), resolve(output, 'assets'), { recursive: true });
console.log(`Built static site in dist/ for ${siteOrigin}`);
