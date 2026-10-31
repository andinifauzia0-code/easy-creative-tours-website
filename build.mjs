import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectEnv } from './env.mjs';
import { services, destinations, products } from './catalog-data.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(root, 'dist');
const isProduction = process.env.VERCEL_ENV === 'production';
const deploymentHost = isProduction ? 'easycreative.co.id' : (process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL);
if (process.env.VERCEL && !deploymentHost && !process.env.PUBLIC_SITE_URL) {
  throw new Error('Vercel build has no production URL. Enable Vercel System Environment Variables or set PUBLIC_SITE_URL.');
}
const siteOrigin = (process.env.PUBLIC_SITE_URL || (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000')).replace(/\/$/, '');
const localEnv = await readProjectEnv();

const pageMetadata = [
  { path: '/', title: 'Easy Creative Tours — Partner Perjalanan & Event 360°', description: 'Partner 360° perjalanan dan event untuk perusahaan, komunitas, keluarga, dan grup. Make it easy. Make it happy.' },
  { path: '/about', title: 'Tentang Easy Creative Tours — Partner Perjalanan & Event', description: 'Kenali Easy Creative Tours, partner perjalanan dan event dengan perencanaan kreatif, solusi terintegrasi, dan koordinasi profesional.' },
  { path: '/services', title: 'Layanan Perjalanan & Event — Easy Creative Tours', description: 'Layanan corporate gathering, team building, corporate travel, meeting, akomodasi, transportasi, dan koordinasi acara.' },
  ...services.map(item => ({ path: `/services/${item.slug}`, title: `${item.title} — Easy Creative Tours`, description: item.desc })),
  { path: '/destinations', title: 'Destinasi Perjalanan — Easy Creative Tours', description: 'Jelajahi inspirasi destinasi domestik dan internasional untuk perjalanan grup, gathering, dan acara perusahaan.' },
  ...destinations.map(item => ({ path: `/destinations/${item.slug}`, title: `${item.title} — Destinasi Easy Creative Tours`, description: item.desc })),
  { path: '/packages', title: 'Paket Wisata & Program Perjalanan — Easy Creative Tours', description: 'Katalog program perjalanan, gathering, team building, meeting, dan incentive trip yang dapat disesuaikan.' },
  ...products.map(item => ({ path: `/packages/${item.slug}`, title: `${item.title} — Easy Creative Tours`, description: item.desc })),
  { path: '/portfolio', title: 'Inspirasi Program — Portofolio Easy Creative Tours', description: 'Lihat contoh konsep gathering, team building, family gathering, corporate travel, meeting, dan private trip.' },
  { path: '/contact', title: 'Hubungi Easy Creative Tours — Konsultasi Perjalanan & Event', description: 'Ceritakan rencana perjalanan atau event Anda. Hubungi Easy Creative Tours untuk konsultasi dan penawaran.' },
  { path: '/search', title: 'Cari Program — Easy Creative Tours', description: 'Cari layanan, destinasi, dan program perjalanan Easy Creative Tours.' },
];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const renderPage = (template, page) => {
  const canonical = `${siteOrigin}${page.path === '/' ? '/' : page.path}`;
  const image = `${siteOrigin}/assets/brand/easy-creative-tours-logo.png`;
  return template
    .replaceAll('__SITE_ORIGIN__', siteOrigin)
    .replaceAll('__PAGE_TITLE__', escapeHtml(page.title))
    .replaceAll('__PAGE_DESCRIPTION__', escapeHtml(page.description))
    .replaceAll('__CANONICAL_URL__', escapeHtml(canonical))
    .replaceAll('__OG_IMAGE__', escapeHtml(image));
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['src.js', 'catalog-data.js', 'public-content.js', 'admin.js', 'admin.css', 'styles.css', 'robots.txt', 'sitemap.xml']) {
  const contents = await readFile(resolve(root, file), 'utf8');
  await writeFile(resolve(output, file), contents.replaceAll('__SITE_ORIGIN__', siteOrigin));
}
const htmlTemplate = await readFile(resolve(root, 'index.html'), 'utf8');
for (const page of pageMetadata) {
  const pageFile = page.path === '/' ? resolve(output, 'index.html') : resolve(output, page.path.slice(1), 'index.html');
  await mkdir(dirname(pageFile), { recursive: true });
  await writeFile(pageFile, renderPage(htmlTemplate, page));
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
