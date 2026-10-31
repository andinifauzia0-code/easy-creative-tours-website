import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectEnv } from './env.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(root, 'dist');
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (process.env.VERCEL && !vercelHost && !process.env.PUBLIC_SITE_URL) {
  throw new Error('Vercel build has no production URL. Enable Vercel System Environment Variables or set PUBLIC_SITE_URL.');
}
const siteOrigin = (process.env.PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')).replace(/\/$/, '');
const localEnv = await readProjectEnv();

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'src.js', 'catalog-data.js', 'public-content.js', 'admin.js', 'admin.css', 'styles.css', 'robots.txt', 'sitemap.xml']) {
  const contents = await readFile(resolve(root, file), 'utf8');
  await writeFile(resolve(output, file), contents.replaceAll('__SITE_ORIGIN__', siteOrigin));
}
const cmsConfig = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || localEnv.SUPABASE_PUBLISHABLE_KEY || localEnv.SUPABASE_ANON_KEY || '',
};
if (Boolean(cmsConfig.supabaseUrl) !== Boolean(cmsConfig.supabasePublishableKey)) {
  throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or leave both empty until Supabase is configured.');
}
await writeFile(resolve(output, 'cms-config.js'), `window.ECT_CMS_CONFIG = Object.freeze(${JSON.stringify(cmsConfig)});\n`);
await cp(resolve(root, 'public/assets'), resolve(output, 'assets'), { recursive: true });
console.log(`Built static site in dist/ for ${siteOrigin}`);
