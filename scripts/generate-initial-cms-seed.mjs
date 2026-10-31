import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { services as sourceServices, destinations as sourceDestinations, products as sourceProducts, portfolio as sourcePortfolio } from '../catalog-data.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const content = { services: sourceServices, destinations: sourceDestinations, products: sourceProducts, portfolio: sourcePortfolio };

const q = value => value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const qa = values => `array[${(values || []).map(q).join(',')}]::text[]`;
const insert = (table, columns, rows, conflict) => {
  if (!rows.length) return '';
  return `insert into public.${table} (${columns.join(', ')}) values\n${rows.map(row => `  (${row.join(', ')})`).join(',\n')}\non conflict (${conflict}) do nothing;\n`;
};

const services = content.services.map((item, i) => [
  q(item.slug), q(item.title), q(item.icon), q(item.desc), q(item.image), qa(item.includes),
  q(item.suitable), q(item.activities), i < 6 ? 'true' : 'false', 'true', String((i + 1) * 10),
]);
const destinations = content.destinations.map((item, i) => [
  q(item.slug), q(item.title), q(item.category), q(item.desc), q(item.image), q(item.activities),
  q(item.duration), qa([]), i < 5 ? 'true' : 'false', 'true', String((i + 1) * 10),
]);
const products = content.products.map((item, i) => [
  q(item.slug), q(item.title), q(item.category), q(item.desc), q(item.duration), qa(item.destinationNames),
  qa(item.categories), 'null', q('Harga melalui penawaran'), q(item.image), q(''), qa([]), qa([]),
  i < 3 ? 'true' : 'false', 'true', String((i + 1) * 10),
]);
const portfolio = content.portfolio.map((item, i) => [
  q(item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')),
  q(item.title), q(item.title), q(item.desc), q(item.image), q(''), 'null', 'false', 'true', 'true', String((i + 1) * 10),
]);

const sql = [
  '-- Snapshot migration of the existing public website catalog. Re-running is safe.',
  insert('services', ['slug','title','icon','description','image_url','inclusions','suitable','activities','is_featured','is_published','sort_order'], services, 'slug'),
  insert('destinations', ['slug','title','category','description','image_url','activities','recommended_duration','gallery_urls','is_featured','is_published','sort_order'], destinations, 'slug'),
  insert('products', ['slug','title','category','description','duration','destination_names','categories','price_amount','price_label','image_url','image_path','inclusions','exclusions','is_featured','is_published','sort_order'], products, 'slug'),
  insert('portfolio_projects', ['slug','title','category','description','cover_image_url','cover_image_path','project_date','date_verified','is_concept','is_published','sort_order'], portfolio, 'slug'),
].join('\n');

const migration = resolve(root, 'supabase/migrations/20261031000001_migrate_existing_site_content.sql');
await writeFile(migration, sql);
console.log(`Wrote ${migration}`);
