const config = window.ECT_CMS_CONFIG || {};
const base = String(config.supabaseUrl || '').replace(/\/$/, '');
const key = String(config.supabasePublishableKey || config.supabaseAnonKey || '');

async function readPublished(table, select = '*') {
  if (!base || !key) return null;
  const params = new URLSearchParams({ select, is_published: 'eq.true' });
  if (table !== 'seo_metadata') params.set('order', 'sort_order.asc');
  const response = await fetch(`${base}/rest/v1/${table}?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`CMS ${table} request failed (${response.status})`);
  return response.json();
}

async function readSettings() {
  if (!base || !key) return {};
  const params = new URLSearchParams({ select: 'key,value', is_published: 'eq.true', key: 'in.(homepage,about,contact)' });
  const response = await fetch(`${base}/rest/v1/site_settings?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`CMS settings request failed (${response.status})`);
  return Object.fromEntries((await response.json()).map(row => [row.key, row.value || {}]));
}

export async function loadPublishedContent() {
  if (!base || !key) return null;
  const [serviceRows, destinationRows, productRows, portfolioRows, portfolioImageRows, settings, sectionRows, seoRows] = await Promise.all([
    readPublished('services'), readPublished('destinations'), readPublished('products'),
    readPublished('portfolio_projects'), readPublished('portfolio_images'), readSettings(), readPublished('homepage_sections'),
    readPublished('seo_metadata', '*'),
  ]);
  const galleries = new Map();
  for (const image of portfolioImageRows || []) {
    const current = galleries.get(image.project_id) || [];
    current.push(image.image_url);
    galleries.set(image.project_id, current);
  }
  return {
    services: serviceRows?.map(row => ({
      slug: row.slug, title: row.title, icon: row.icon, image: row.image_url, desc: row.description,
      includes: row.inclusions || [], suitable: row.suitable, activities: row.activities,
    })) ?? null,
    destinations: destinationRows?.map(row => ({
      slug: row.slug, title: row.title, category: row.category, image: row.image_url, desc: row.description,
      activities: row.activities, duration: row.recommended_duration, gallery_urls: row.gallery_urls || [],
    })) ?? null,
    products: productRows?.map(row => ({
      slug: row.slug, title: row.title, category: row.category, duration: row.duration, desc: row.description,
      image: row.image_url, categories: row.categories || [row.category], destinationNames: row.destination_names || [],
      price_amount: row.price_amount, price_label: row.price_label || 'Harga melalui penawaran',
      inclusions: row.inclusions || [], exclusions: row.exclusions || [],
    })) ?? null,
    portfolio: portfolioRows?.map(row => ({
      id: row.id, slug: row.slug, title: row.title, category: row.category, desc: row.description,
      image: row.cover_image_url, isConcept: row.is_concept, project_date: row.project_date,
      date_verified: row.date_verified, gallery_urls: galleries.get(row.id) || [],
    })) ?? null,
    settings,
    sections: sectionRows || [],
    seo: Object.fromEntries((seoRows || []).map(row => [row.page_path, row])),
  };
}
