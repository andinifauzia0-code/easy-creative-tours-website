const root = document.querySelector('#app');
const config = window.ECT_CMS_CONFIG || {};
const supabaseUrl = String(config.supabaseUrl || '').replace(/\/$/, '');
const anonKey = String(config.supabasePublishableKey || config.supabaseAnonKey || '');
const legacyBucket = 'ect-media';
const mediaBuckets = new Set(['brand','homepage','products','services','destinations','portfolio']);
const assetBucket = asset => mediaBuckets.has(asset?.storage_bucket) ? asset.storage_bucket : legacyBucket;
const sessionKey = 'ect-admin-session-v1';
const state = {
  session: null,
  admin: null,
  view: 'overview',
  table: '',
  rows: [],
  selected: null,
  sectionEditorOpen: false,
  settings: {},
  sections: [],
  media: [],
  toast: '',
  busy: false,
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const slugify = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const apiUrl = (path, query = '') => `${supabaseUrl}${path}${query}`;
const headers = (extra = {}) => ({
  apikey: anonKey,
  Authorization: `Bearer ${state.session?.access_token || anonKey}`,
  ...extra,
});

const collections = {
  products: { label: 'Produk & paket', singular: 'Produk', table: 'products', icon: '▣', fields: [
    ['title','Nama program','text',true], ['slug','Slug URL','text',true], ['category','Kategori','text',true],
    ['description','Deskripsi','textarea',true], ['duration','Durasi','text',false], ['destination_names','Destinasi terkait','list',false],
    ['categories','Kategori pencarian','list',false], ['price_amount','Harga angka (opsional)','number',false], ['price_label','Label harga','text',false],
    ['image_url','Foto utama','image',false], ['image_path','Path media','text',false], ['inclusions','Termasuk','list',false],
    ['exclusions','Tidak termasuk','list',false], ['sort_order','Urutan','number',false], ['is_featured','Tampilkan di beranda','checkbox',false],
  ]},
  services: { label: 'Layanan', singular: 'Layanan', table: 'services', icon: '✳', fields: [
    ['title','Nama layanan','text',true], ['slug','Slug URL','text',true], ['icon','Ikon singkat','text',false],
    ['description','Deskripsi','textarea',true], ['image_url','Foto layanan','image',false], ['image_path','Path media','text',false],
    ['inclusions','Cakupan layanan','list',false], ['suitable','Cocok untuk','textarea',false], ['activities','Contoh aktivitas','textarea',false],
    ['sort_order','Urutan','number',false], ['is_featured','Tampilkan di beranda','checkbox',false],
  ]},
  destinations: { label: 'Destinasi', singular: 'Destinasi', table: 'destinations', icon: '⌖', fields: [
    ['title','Nama destinasi','text',true], ['slug','Slug URL','text',true], ['category','Kategori','text',true],
    ['description','Deskripsi','textarea',true], ['image_url','Foto utama','image',false], ['image_path','Path media','text',false],
    ['activities','Aktivitas','textarea',false], ['recommended_duration','Durasi rekomendasi','text',false],
    ['gallery_urls','URL foto galeri (satu per baris)','list',false], ['sort_order','Urutan','number',false], ['is_featured','Tampilkan di beranda','checkbox',false],
  ]},
  portfolio_projects: { label: 'Portofolio', singular: 'Proyek', table: 'portfolio_projects', icon: '▧', fields: [
    ['title','Judul proyek','text',true], ['slug','Slug URL','text',true], ['category','Kategori','text',true],
    ['description','Deskripsi','textarea',true], ['cover_image_url','Foto sampul','image',false], ['cover_image_path','Path media','text',false],
    ['project_date','Tanggal proyek','date',false], ['date_verified','Tanggal telah diverifikasi','checkbox',false],
    ['is_concept','Tandai sebagai contoh konsep','checkbox',false], ['sort_order','Urutan','number',false],
  ]},
  portfolio_images: { label: 'Galeri portofolio', singular: 'Foto galeri', table: 'portfolio_images', icon: '▤', fields: [
    ['project_id','Proyek','project',true], ['image_url','Foto','image',true], ['storage_path','Path media','text',false],
    ['alt_text','Teks alternatif','text',false], ['sort_order','Urutan','number',false],
  ]},
};

function configureAdminMeta() {
  document.title = location.pathname === '/admin/login' ? 'Login Admin | Easy Creative Tours' : 'Admin | Easy Creative Tours';
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
  robots.content = 'noindex,nofollow';
  document.querySelector('link[rel="canonical"]')?.removeAttribute('href');
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: headers({ ...(options.headers || {}) }),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.message || body?.msg || body?.error_description || body?.error || `Request failed (${response.status})`);
  return body;
}

async function authRequest(path, body) {
  const response = await fetch(apiUrl(path), {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await response.text();
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch { result = text; }
  if (!response.ok) throw new Error(result?.msg || result?.message || result?.error_description || 'Autentikasi gagal. Periksa email dan kata sandi.');
  return result;
}

function saveSession(session) {
  state.session = session;
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

function clearSession() {
  state.session = null;
  state.admin = null;
  sessionStorage.removeItem(sessionKey);
}

async function restoreSession() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const recoveryToken = hash.get('access_token');
  if (recoveryToken) {
    saveSession({ access_token: recoveryToken, refresh_token: hash.get('refresh_token') || '', expires_at: Number(hash.get('expires_at')) || 0 });
    history.replaceState({}, '', location.pathname + location.search);
  }
  if (!state.session) { try { state.session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { clearSession(); } }
  if (!state.session?.access_token) return false;
  const exp = Number(state.session.expires_at || 0);
  if (exp && exp * 1000 < Date.now() + 30000 && state.session.refresh_token) {
    const refreshed = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: state.session.refresh_token });
    saveSession(refreshed);
  }
  if (!state.session?.user?.id) {
    const userResponse = await fetch(apiUrl('/auth/v1/user'), { headers: headers() });
    if (!userResponse.ok) { clearSession(); return false; }
    state.session.user = await userResponse.json();
    saveSession(state.session);
  }
  return Boolean(state.session?.access_token);
}

async function verifyAdmin() {
  if (!state.session?.access_token) return false;
  const profile = await request(`/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(state.session.user.id)}&select=user_id,email,display_name,is_active`);
  if (!Array.isArray(profile) || !profile[0]?.is_active) { clearSession(); return false; }
  state.admin = profile[0];
  return true;
}

function setupCard() {
  return `<main class="admin-gate"><section class="admin-gate-card"><a class="admin-brand" href="/" aria-label="Kembali ke website"><img src="/assets/brand/easy-creative-tours-logo.png" alt="Easy Creative Tours"><span>Easy Creative Tours<br><small>Content management</small></span></a><span class="admin-kicker">Setup diperlukan</span><h1>Hubungkan project Supabase</h1><p>Panel admin terkunci sampai project Supabase, migrasi, dan variabel publik dikonfigurasi. Kredensial admin tidak disimpan di aplikasi.</p><ol><li>Buat project Supabase untuk Easy Creative Tours.</li><li>Jalankan file migrasi berurutan dari folder <code>supabase/migrations</code>.</li><li>Undang email pemilik di Authentication, lalu jalankan <code>supabase/provision-admin.sql</code>.</li><li>Set <code>SUPABASE_URL</code> dan <code>SUPABASE_PUBLISHABLE_KEY</code> di Vercel Project Settings → Environment Variables.</li><li>Deploy ulang setelah migrasi dan variabel siap.</li></ol><p class="admin-note">Gunakan publishable/anon key saja di variabel tersebut. Jangan masukkan service-role key.</p><a class="admin-button" href="/">Kembali ke website</a></section></main>`;
}

function loginView(error = '') {
  if (!supabaseUrl || !anonKey) { root.innerHTML = setupCard(); return; }
  root.innerHTML = `<main class="admin-gate"><section class="admin-gate-card"><a class="admin-brand" href="/" aria-label="Kembali ke website"><img src="/assets/brand/easy-creative-tours-logo.png" alt="Easy Creative Tours"><span>Easy Creative Tours<br><small>Admin portal</small></span></a><span class="admin-kicker">Akses terbatas</span><h1>Masuk ke dashboard</h1><p>Gunakan akun admin yang sudah diundang. Pendaftaran publik tidak tersedia.</p>${error ? `<div class="admin-alert" role="alert">${esc(error)}</div>` : ''}<form id="admin-login-form" class="admin-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Kata sandi<input name="password" type="password" autocomplete="current-password" required></label><button class="admin-button" type="submit">Masuk</button></form><a class="admin-text-link" href="/admin/reset">Lupa kata sandi?</a><a class="admin-back" href="/">← Kembali ke website</a></section></main>`;
}

function resetView(error = '') {
  root.innerHTML = `<main class="admin-gate"><section class="admin-gate-card"><a class="admin-brand" href="/" aria-label="Kembali ke website"><img src="/assets/brand/easy-creative-tours-logo.png" alt="Easy Creative Tours"><span>Easy Creative Tours<br><small>Admin portal</small></span></a><span class="admin-kicker">Pemulihan akun</span><h1>${location.pathname === '/admin/update-password' ? 'Buat kata sandi baru' : 'Reset kata sandi'}</h1><p>${location.pathname === '/admin/update-password' ? 'Pilih kata sandi baru untuk akun admin Anda.' : 'Kami akan mengirim tautan pemulihan jika email tersebut terdaftar.'}</p>${error ? `<div class="admin-alert" role="alert">${esc(error)}</div>` : ''}${location.pathname === '/admin/update-password' ? `<form id="admin-update-password" class="admin-form"><label>Kata sandi baru<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><label>Ulangi kata sandi<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label><button class="admin-button" type="submit">Simpan kata sandi</button></form>` : `<form id="admin-reset-form" class="admin-form"><label>Email admin<input name="email" type="email" autocomplete="email" required></label><button class="admin-button" type="submit">Kirim tautan reset</button></form>`}<a class="admin-back" href="/admin/login">← Kembali ke login</a></section></main>`;
}

function navItem(view, label, icon) {
  return `<button class="admin-nav-item ${state.view === view ? 'active' : ''}" data-action="view" data-view="${view}"><span aria-hidden="true">${icon}</span>${label}</button>`;
}

function appShell(content) {
  root.innerHTML = `<div class="admin-shell"><aside class="admin-sidebar"><a class="admin-brand" href="/" aria-label="Website Easy Creative Tours"><img src="/assets/brand/easy-creative-tours-logo.png" alt="Easy Creative Tours"><span>Easy Creative Tours<br><small>Admin CMS</small></span></a><nav aria-label="Navigasi admin">${navItem('overview','Ringkasan','◫')}<div class="admin-nav-label">KONTEN</div>${navItem('homepage','Beranda','⌂')}${navItem('products','Produk & Paket','▣')}${navItem('services','Layanan','✳')}${navItem('destinations','Destinasi','⌖')}${navItem('portfolio_projects','Portofolio','▧')}${navItem('portfolio_images','Galeri portofolio','▤')}${navItem('media_assets','Pustaka media','▧')}${navItem('about','Tentang kami','◉')}${navItem('contact','Kontak','↗')}${navItem('seo_metadata','SEO','◎')}</nav><div class="admin-sidebar-bottom"><span class="admin-user">${esc(state.admin?.display_name || state.admin?.email || 'Admin')}</span><button class="admin-logout" data-action="logout">Keluar</button><a class="admin-back" href="/">Buka website ↗</a></div></aside><main class="admin-main"><header class="admin-topbar"><div><span class="admin-kicker">EASY CREATIVE TOURS</span><h1>${esc(viewTitle())}</h1></div><span class="admin-status-pill"><i></i> Terhubung</span></header><div class="admin-content">${state.toast ? `<div class="admin-toast" role="status">${esc(state.toast)}</div>` : ''}${content}</div></main></div>`;
}

function viewTitle() {
  return ({ overview:'Ringkasan', homepage:'Kelola beranda', products:'Produk & paket', services:'Layanan', destinations:'Destinasi', portfolio_projects:'Portofolio', portfolio_images:'Galeri portofolio', media_assets:'Pustaka media', about:'Tentang kami', contact:'Informasi kontak', seo_metadata:'SEO' })[state.view] || 'Admin CMS';
}

function blankRecord(table) {
  const record = { is_published: false, sort_order: (state.rows.length + 1) * 10 };
  if (table === 'portfolio_projects') record.is_concept = false;
  return record;
}

function mediaSelect(field, value) {
  const options = state.media.map(item => `<option value="${esc(item.public_url)}" data-path="${esc(item.storage_path)}">${esc(item.file_name)}</option>`).join('');
  return `<div class="admin-image-field"><input name="${esc(field)}" type="url" value="${esc(value)}" placeholder="https://…"><select aria-label="Pilih dari pustaka media" data-image-picker="${esc(field)}"><option value="">Pilih dari pustaka media</option>${options}</select>${value ? `<img class="admin-image-preview" src="${esc(value)}" alt="Pratinjau foto">` : ''}</div>`;
}

function inputField([name, label, type, required], record) {
  const value = record?.[name];
  const req = required ? 'required' : '';
  if (type === 'checkbox') return `<label class="admin-check"><input name="${esc(name)}" type="checkbox" ${value ? 'checked' : ''}>${esc(label)}</label>`;
  if (type === 'list') return `<label>${esc(label)}<textarea name="${esc(name)}" rows="4" data-field-type="list" placeholder="Satu item per baris">${esc(Array.isArray(value) ? value.join('\n') : '')}</textarea><small>Satu item per baris.</small></label>`;
  if (type === 'textarea') return `<label>${esc(label)}<textarea name="${esc(name)}" rows="5" ${req}>${esc(value || '')}</textarea></label>`;
  if (type === 'image') return `<label>${esc(label)}${mediaSelect(name, value || '')}</label>`;
  if (type === 'project') return `<label>${esc(label)}<select name="${esc(name)}" ${req}><option value="">Pilih proyek portofolio</option>${state.sections.map(row => `<option value="${esc(row.id)}" ${String(value || '') === row.id ? 'selected' : ''}>${esc(row.title)}</option>`).join('')}</select></label>`;
  if (type === 'number') return `<label>${esc(label)}<input name="${esc(name)}" type="number" ${name === 'sort_order' ? 'step="1"' : 'step="any"'} value="${esc(value ?? '')}" ${req}></label>`;
  if (type === 'date') return `<label>${esc(label)}<input name="${esc(name)}" type="date" value="${esc(value || '')}" ${req}></label>`;
  return `<label>${esc(label)}<input name="${esc(name)}" type="${type === 'url' ? 'url' : 'text'}" value="${esc(value || '')}" ${req}></label>`;
}

function recordForm() {
  const def = collections[state.table];
  const record = state.selected || blankRecord(state.table);
  const fields = def.fields.map(field => `<div class="admin-field ${field[2] === 'textarea' || field[2] === 'list' || field[2] === 'image' ? 'wide' : ''}">${inputField(field, record)}</div>`).join('');
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">${state.selected?.id ? 'UBAH KONTEN' : 'KONTEN BARU'}</span><h2>${state.selected?.id ? `Edit ${esc(def.singular)}` : `Tambah ${esc(def.singular)}`}</h2></div><button class="admin-icon-button" type="button" data-action="cancel-edit" aria-label="Tutup form">×</button></div><form id="admin-record-form" class="admin-record-form" data-table="${esc(state.table)}"><div class="admin-fields">${fields}</div><div class="admin-form-actions"><button class="admin-button secondary" type="submit" data-action="save-record" data-publish="false">Simpan draf</button><button class="admin-button" type="submit" data-action="save-record" data-publish="true">${state.selected?.is_published ? 'Simpan & terbitkan' : 'Terbitkan'}</button></div><p class="admin-hint">Draf tidak akan ditampilkan di website publik. Slug URL harus unik.</p></form></section>`;
}

function recordList() {
  const def = collections[state.table];
  const rows = state.rows.map(row => `<tr><td><strong>${esc(row.title || row.alt_text || row.slug || 'Tanpa judul')}</strong><small>${esc(row.slug || row.storage_path || row.image_url || '')}</small></td><td>${esc(row.category || row.project_id || row.duration || '—')}</td><td><span class="admin-publish ${row.is_published ? 'published' : 'draft'}">${row.is_published ? 'Terbit' : 'Draf'}</span></td><td>${row.updated_at ? new Date(row.updated_at).toLocaleDateString('id-ID') : '—'}</td><td><div class="admin-row-actions"><button data-action="edit" data-id="${esc(row.id)}">Edit</button><button class="danger-text" data-action="delete" data-id="${esc(row.id)}">Hapus</button></div></td></tr>`).join('');
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">${esc(def.label.toUpperCase())}</span><h2>Semua konten</h2><p>${state.rows.length} item ditemukan</p></div><button class="admin-button" data-action="new-record">+ Tambah ${esc(def.singular)}</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Konten</th><th>Kategori</th><th>Status</th><th>Diubah</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="admin-empty">Belum ada data untuk ditampilkan.</td></tr>'}</tbody></table></div></section>`;
}

function recordsView() {
  const form = state.selected ? recordForm() : '';
  return `${state.toast ? `<div class="admin-toast" role="status">${esc(state.toast)}</div>` : ''}${form}${recordList()}`;
}

function settingFields(key) {
  if (key === 'homepage') return [
    ['hero_eyebrow','Label kecil di atas judul','text'], ['hero_title','Judul utama','textarea'], ['hero_description','Deskripsi utama','textarea'],
    ['primary_cta_label','Teks tombol utama','text'], ['primary_cta_href','Tautan tombol utama','text'],
    ['secondary_cta_label','Teks tombol kedua','text'], ['secondary_cta_href','Tautan tombol kedua','text'], ['hero_image_url','Foto hero','image'],
    ['featured_service_slugs','Layanan unggulan — slug','list'], ['featured_destination_slugs','Destinasi unggulan — slug','list'],
    ['featured_product_slugs','Program unggulan — slug','list'], ['featured_portfolio_slugs','Portofolio unggulan — slug','list'],
  ];
  if (key === 'about') return [
    ['positioning','Posisi perusahaan','textarea'], ['description','Deskripsi perusahaan','textarea'],
    ['vision','Visi','textarea'], ['mission','Misi — satu butir per baris','list'], ['values','Nilai inti','list'],
  ];
  return [
    ['whatsapp_number','Nomor WhatsApp (format internasional, tanpa +)','text'], ['email','Email','text'],
    ['instagram_url','URL Instagram','text'], ['address','Alamat','textarea'], ['social_links','Tautan sosial (satu URL per baris)','list'],
  ];
}

function settingForm(key) {
  const values = state.settings[key] || {};
  const fields = settingFields(key).map(([name, label, type]) => `<div class="admin-field ${type === 'textarea' || type === 'list' || type === 'image' ? 'wide' : ''}">${inputField([name,label,type,false], values)}</div>`).join('');
  const title = ({ homepage:'Konten utama dan bagian unggulan', about:'Profil perusahaan', contact:'Kanal komunikasi publik' })[key];
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">PENGATURAN PUBLIK</span><h2>${title}</h2><p>Perubahan tersimpan akan dipakai website publik pada kunjungan berikutnya.</p></div></div><form class="admin-settings-form" data-setting="${esc(key)}"><div class="admin-fields">${fields}</div><div class="admin-form-actions"><button class="admin-button" type="submit">Simpan perubahan</button></div></form></section>`;
}

function homepageSectionsView() {
  const rows = state.sections.filter(row => row.section_key).map(row => `<tr><td><strong>${esc(row.title)}</strong><small>${esc(row.section_key)}</small></td><td>${esc(row.description.slice(0,120))}</td><td><span class="admin-publish ${row.is_published?'published':'draft'}">${row.is_published?'Terbit':'Draf'}</span></td><td><div class="admin-row-actions"><button data-action="edit-section" data-id="${esc(row.id)}">Edit bagian</button><button class="danger-text" data-action="delete-section" data-id="${esc(row.id)}">Hapus</button></div></td></tr>`).join('');
  const selected = state.sectionEditorOpen ? state.selected : null;
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">BAGIAN BERANDA</span><h2>Judul dan deskripsi bagian</h2><p>Urutan bagian diatur dari kolom Urutan.</p></div><button class="admin-button" type="button" data-action="new-section">+ Tambah bagian</button></div>${selected ? `<form id="admin-section-form" class="admin-record-form"><input type="hidden" name="id" value="${esc(selected.id || '')}"><div class="admin-fields">${inputField(['section_key','ID bagian (unik)','text',true],selected)}${inputField(['title','Judul','text',true],selected)}${inputField(['description','Deskripsi','textarea',false],selected)}${inputField(['image_url','Gambar bagian','image',false],selected)}${inputField(['sort_order','Urutan','number',false],selected)}<div class="admin-field wide"><label>Data tambahan (JSON)<textarea name="content_json" rows="4">${esc(JSON.stringify(selected.content || {},null,2))}</textarea></label></div></div><div class="admin-form-actions"><button class="admin-button secondary" type="button" data-action="save-section" data-publish="false">Simpan draf</button><button class="admin-button" type="button" data-action="save-section" data-publish="true">${selected.is_published?'Simpan & terbitkan':'Terbitkan'}</button><button type="button" class="admin-button ghost" data-action="cancel-edit">Batal</button></div></form>`:''}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Bagian</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="admin-empty">Belum ada bagian.</td></tr>'}</tbody></table></div></section>`;
}

function overviewView() {
  const cards = [
    ['products','Produk'], ['destinations','Destinasi'], ['services','Layanan'], ['portfolio_projects','Portofolio'],
  ].map(([key,label]) => `<article class="admin-stat"><span>${label}</span><strong>${state.counts?.[key] ?? '—'}</strong><small>item tersimpan</small></article>`).join('');
  const recent = (state.recent || []).map(row => `<li><span><strong>${esc(row.title)}</strong><small>${esc(row.type)}</small></span><time>${row.date ? new Date(row.date).toLocaleString('id-ID') : 'Baru'}</time></li>`).join('');
  return `<section class="admin-welcome"><span class="admin-kicker">RUANG KERJA KONTEN</span><h2>Halo, ${esc(state.admin?.display_name || 'Admin')}.</h2><p>Kelola konten yang sudah terbit dan siapkan pembaruan berikutnya.</p></section><div class="admin-stat-grid">${cards}</div><section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">AKTIVITAS</span><h2>Pembaruan terbaru</h2></div></div><ul class="admin-activity">${recent || '<li class="admin-empty">Belum ada pembaruan konten.</li>'}</ul></section>`;
}

function mediaView() {
  const rows = state.media.map(asset => `<article class="admin-media-card"><img src="${esc(asset.public_url)}" alt="${esc(asset.alt_text || asset.file_name)}"><div class="admin-media-info"><strong>${esc(asset.file_name)}</strong><small>${esc(asset.category)} · ${(asset.file_size/1024).toFixed(0)} KB · ${asset.mime_type}</small><div class="admin-media-actions"><button data-action="copy-media" data-url="${esc(asset.public_url)}">Salin URL</button><button data-action="replace-media" data-id="${esc(asset.id)}">Ganti foto</button><button class="danger-text" data-action="delete-media" data-id="${esc(asset.id)}">Hapus</button></div><form class="admin-media-meta" data-media-id="${esc(asset.id)}"><label>Kategori<select name="category"><option value="brand" ${asset.category==='brand'?'selected':''}>Brand</option><option value="homepage" ${asset.category==='homepage'?'selected':''}>Homepage</option><option value="products" ${asset.category==='products'?'selected':''}>Produk</option><option value="services" ${asset.category==='services'?'selected':''}>Layanan</option><option value="destinations" ${asset.category==='destinations'?'selected':''}>Destinasi</option><option value="portfolio" ${asset.category==='portfolio'?'selected':''}>Portofolio</option><option value="uncategorized" ${asset.category==='uncategorized'?'selected':''}>Lainnya</option></select></label><label class="admin-inline-check"><input type="checkbox" name="is_published" ${asset.is_published?'checked':''}>Metadata publik</label><label>Teks alternatif<input name="alt_text" value="${esc(asset.alt_text||'')}"></label><button type="submit">Simpan</button></form></div></article>`).join('');
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">SUPABASE STORAGE</span><h2>Unggah foto</h2><p>JPG, PNG, atau WEBP · maks. 10 MB per file.</p></div></div><form id="admin-upload-form" class="admin-upload-form"><label class="admin-upload-target"><span>＋</span><strong>Pilih satu atau beberapa foto</strong><small>File akan disimpan permanen di Supabase Storage.</small><input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><label>Kategori<select name="category"><option value="homepage">Homepage</option><option value="products">Produk</option><option value="services">Layanan</option><option value="destinations">Destinasi</option><option value="portfolio">Portofolio</option><option value="brand">Brand</option></select></label><div id="admin-upload-preview" class="admin-upload-preview"></div><button class="admin-button" type="submit">Unggah foto</button></form></section><section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">PUSTAKA ASET</span><h2>Foto tersimpan</h2><p>${state.media.length} file</p></div></div><div class="admin-media-grid">${rows || '<div class="admin-empty">Belum ada foto di pustaka media.</div>'}</div><input id="admin-replace-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></section>`;
}

function seoView() {
  const row = state.rows.find(item => item.page_path === (state.seoPath || '/')) || { page_path: state.seoPath || '/', is_published: true };
  const choices = ['/', '/about', '/services', '/destinations', '/packages', '/portfolio', '/contact'];
  return `<section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-kicker">SEARCH ENGINE OPTIMIZATION</span><h2>Metadata halaman</h2><p>Title, deskripsi, Open Graph, dan canonical untuk halaman publik.</p></div></div><form id="admin-seo-form" class="admin-settings-form"><div class="admin-fields"><div class="admin-field"><label>Halaman<select name="page_path">${choices.map(path => `<option value="${path}" ${path === row.page_path ? 'selected' : ''}>${path}</option>`).join('')}</select></label></div>${inputField(['page_title','Page title','text',false],row)}${inputField(['canonical_url','Canonical URL','text',false],row)}<div class="admin-field wide">${inputField(['meta_description','Meta description','textarea',false],row)}</div><div class="admin-field wide">${inputField(['open_graph_image','Open Graph image','image',false],row)}</div></div><div class="admin-form-actions"><button class="admin-button" type="submit">Simpan metadata</button></div></form></section>`;
}

async function render() {
  configureAdminMeta();
  if (!supabaseUrl || !anonKey) { root.innerHTML = setupCard(); return; }
  if (location.pathname === '/admin/login' || location.pathname === '/admin/reset' || location.pathname === '/admin/update-password') {
    if (location.pathname === '/admin/reset') { resetView(); return; }
    if (location.pathname === '/admin/update-password') { await restoreSession().catch(() => false); resetView(); return; }
    const recovered = await restoreSession().catch(() => false);
    if (recovered && await verifyAdmin().catch(() => false)) { history.replaceState({}, '', '/admin'); state.view = 'overview'; await render(); return; }
    loginView(); return;
  }
  const hasSession = await restoreSession().catch(() => false);
  if (!hasSession || !(await verifyAdmin().catch(() => false))) { history.replaceState({}, '', '/admin/login'); loginView(); return; }
  root.className = 'admin-root';
  await loadViewData();
  const content = state.view === 'overview' ? overviewView()
    : ['homepage','about','contact'].includes(state.view) ? (state.view === 'homepage' ? `${settingForm('homepage')}${homepageSectionsView()}` : settingForm(state.view))
    : state.view === 'media_assets' ? mediaView()
    : state.view === 'seo_metadata' ? seoView()
    : recordsView();
  appShell(content);
}

async function loadViewData() {
  state.toast = '';
  if (state.view === 'overview') {
    const tables = ['products','destinations','services','portfolio_projects'];
    const results = await Promise.all(tables.map(table => request(`/rest/v1/${table}?select=id,title,updated_at&order=updated_at.desc`)));
    state.counts = Object.fromEntries(tables.map((table, i) => [table, results[i].length]));
    state.recent = results.flatMap((rows,i) => rows.map(row => ({title:row.title,type:collections[tables[i]].label,date:row.updated_at}))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8);
    return;
  }
  if (['homepage','about','contact'].includes(state.view)) {
    const key = state.view;
    const rows = await request(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=key,value`);
    state.settings[key] = rows[0]?.value || {};
    if (key === 'homepage') {
      state.sections = await request('/rest/v1/homepage_sections?select=*&order=sort_order.asc');
      state.media = await request('/rest/v1/media_assets?select=id,file_name,storage_bucket,storage_path,public_url,category,mime_type,file_size,alt_text,is_published&order=created_at.desc');
    }
    return;
  }
  if (state.view === 'media_assets') {
    state.media = await request('/rest/v1/media_assets?select=*&order=created_at.desc');
    return;
  }
  if (state.view === 'seo_metadata') {
    state.rows = await request('/rest/v1/seo_metadata?select=*&order=page_path.asc');
    state.media = await request('/rest/v1/media_assets?select=id,file_name,storage_bucket,storage_path,public_url,category,mime_type,file_size,alt_text,is_published&order=created_at.desc');
    return;
  }
  const def = collections[state.view];
  if (!def) { state.rows = []; return; }
  const order = state.view === 'portfolio_images' ? 'sort_order.asc' : 'sort_order.asc';
  state.rows = await request(`/rest/v1/${def.table}?select=*&order=${order}`);
  state.media = await request('/rest/v1/media_assets?select=id,file_name,storage_bucket,storage_path,public_url,category,mime_type,file_size,alt_text,is_published&order=created_at.desc');
  if (state.view === 'portfolio_images') state.sections = await request('/rest/v1/portfolio_projects?select=id,title&order=title.asc');
}

function listValue(value) { return String(value || '').split(/\n/).map(item => item.trim()).filter(Boolean); }
function formPayload(form, fields) {
  const data = new FormData(form);
  const payload = {};
  for (const [name, , type] of fields) {
    const element = form.elements.namedItem(name);
    if (!element) continue;
    if (type === 'checkbox') payload[name] = element.checked;
    else if (type === 'list') payload[name] = listValue(data.get(name));
    else if (type === 'number') payload[name] = data.get(name) === '' ? null : Number(data.get(name));
    else if (type === 'date') payload[name] = data.get(name) === '' ? null : String(data.get(name));
    else payload[name] = String(data.get(name) ?? '').trim();
  }
  if ('title' in payload && !payload.slug) payload.slug = slugify(payload.title);
  return payload;
}

async function saveRecord(form, publish) {
  const table = form.dataset.table;
  const def = collections[table];
  const id = state.selected?.id;
  const payload = formPayload(form, def.fields);
  payload.is_published = publish;
  payload.updated_by = state.session.user.id;
  if (!id) payload.created_by = table === 'media_assets' ? state.session.user.id : undefined;
  const clean = Object.fromEntries(Object.entries(payload).filter(([,value]) => value !== undefined));
  await request(`/rest/v1/${def.table}${id ? `?id=eq.${encodeURIComponent(id)}` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type':'application/json', Prefer:'return=representation' },
    body: JSON.stringify(clean),
  });
  state.selected = null;
  state.toast = publish ? 'Konten sudah diterbitkan.' : 'Draf berhasil disimpan.';
  await render();
}

async function saveSetting(form) {
  const key = form.dataset.setting;
  const fields = settingFields(key);
  const value = {};
  for (const [name,,type] of fields) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    value[name] = type === 'list' ? listValue(field.value) : field.value.trim();
  }
  await request('/rest/v1/site_settings?on_conflict=key', {
    method:'POST', headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
    body:JSON.stringify({key,value,is_published:true,updated_by:state.session.user.id}),
  });
  state.settings[key] = value;
  state.toast = 'Perubahan berhasil disimpan.';
  await render();
}

async function saveSection(form, publish) {
  const data = new FormData(form);
  let extra;
  try { extra = JSON.parse(String(data.get('content_json') || '{}')); }
  catch { throw new Error('Data tambahan harus berupa JSON yang valid.'); }
  const id = String(data.get('id') || '');
  const payload = {
    section_key:String(data.get('section_key')||'').trim(), title:String(data.get('title')||'').trim(),
    description:String(data.get('description')||'').trim(), image_url:String(data.get('image_url')||'').trim(),
    sort_order:Number(data.get('sort_order')||0), content:extra, is_published:publish, updated_by:state.session.user.id,
  };
  await request(`/rest/v1/homepage_sections${id ? `?id=eq.${encodeURIComponent(id)}` : ''}`, {
    method:id?'PATCH':'POST', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload),
  });
  state.selected=null; state.sectionEditorOpen=false; state.toast=publish?'Bagian beranda diterbitkan.':'Draf bagian beranda tersimpan.'; await render();
}

async function uploadAssets(form) {
  const files = [...(form.elements.files.files || [])];
  const category = form.elements.category.value;
  if (!files.length) throw new Error('Pilih setidaknya satu foto.');
  for (const file of files) await validateMediaFile(file);
  for (const file of files) {
    const ext = mediaExtension(file.type);
    const path = `${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}-${slugify(file.name.replace(/\.[^.]+$/,''))}.${ext}`;
    const uploaded = await fetch(apiUrl(`/storage/v1/object/${category}/${path.split('/').map(encodeURIComponent).join('/')}`), {
      method:'POST', headers:headers({'Content-Type':file.type,'x-upsert':'false'}), body:file,
    });
    if (!uploaded.ok) throw new Error(`${file.name}: unggah gagal (${uploaded.status}).`);
    const url = `${supabaseUrl}/storage/v1/object/public/${category}/${path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      await request('/rest/v1/media_assets', {
        method:'POST', headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify({file_name:file.name,storage_bucket:category,storage_path:path,public_url:url,category,mime_type:file.type,file_size:file.size,created_by:state.session.user.id,updated_by:state.session.user.id,is_published:false}),
      });
    } catch (error) {
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const cleanup = await fetch(apiUrl(`/storage/v1/object/${category}/${encoded}`), {method:'DELETE',headers:headers()});
      if (!cleanup.ok) throw new Error(`${file.name}: metadata gagal disimpan dan objek sementara tidak dapat dibersihkan (${cleanup.status}).`);
      throw error;
    }
  }
  state.toast = `${files.length} foto berhasil diunggah.`; await render();
}

function mediaExtension(mime) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime] || '';
}

async function validateMediaFile(file) {
  const extension = mediaExtension(file?.type);
  if (!extension) throw new Error(`${file?.name || 'File'}: format harus JPG, PNG, atau WEBP.`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: ukuran melebihi 10 MiB.`);
  const nameExtension = file.name.split('.').pop()?.toLowerCase();
  const compatible = file.type === 'image/jpeg' ? ['jpg','jpeg'] : [extension];
  if (!compatible.includes(nameExtension)) throw new Error(`${file.name}: ekstensi file tidak cocok dengan tipe ${file.type}.`);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = file.type === 'image/png' && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp = file.type === 'image/webp' && bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new Error(`${file.name}: isi file tidak sesuai dengan format gambar yang diizinkan.`);
  return extension;
}

async function replaceAsset(id) {
  const asset = state.media.find(item => item.id === id);
  if (!asset) return;
  const input = document.querySelector('#admin-replace-file');
  input.dataset.assetId = id;
  input.click();
}

async function performReplace(file, id) {
  const asset = state.media.find(item => item.id === id);
  if (!asset) return;
  const extension = await validateMediaFile(file);
  const bucket = assetBucket(asset);
  const oldPath = asset.storage_path;
  const oldUrl = asset.public_url;
  const nextPath = `${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}-${slugify(file.name.replace(/\.[^.]+$/,''))}.${extension}`;
  const objectUrl = path => `${supabaseUrl}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const publicUrl = path => `${supabaseUrl}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const oldObject = await fetch(objectUrl(oldPath), {headers:headers()});
  if (!oldObject.ok) throw new Error(`Foto lama tidak dapat dibaca untuk penggantian aman (${oldObject.status}).`);
  const oldBytes = await oldObject.blob();
  const oldContentType = oldObject.headers.get('content-type') || asset.mime_type || 'application/octet-stream';
  const nextUrl = publicUrl(nextPath);
  const nextObject = await fetch(objectUrl(nextPath), {method:'POST',headers:headers({'Content-Type':file.type,'x-upsert':'false'}),body:file});
  if (!nextObject.ok) throw new Error(`Foto tidak dapat diganti (${nextObject.status}).`);

  const changedReferences = [];
  const oldMetadata = {file_name:asset.file_name,storage_path:oldPath,public_url:oldUrl,mime_type:asset.mime_type,file_size:asset.file_size,updated_by:asset.updated_by || null};
  let metadataUpdated = false;
  let oldRemoved = false;
  try {
    await updateAssetReferences(asset, nextPath, nextUrl, changedReferences);
    await request(`/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({file_name:file.name,storage_path:nextPath,public_url:nextUrl,mime_type:file.type,file_size:file.size,updated_by:state.session.user.id}),
    });
    metadataUpdated = true;
    const oldEncoded = oldPath.split('/').map(encodeURIComponent).join('/');
    const removed = await fetch(apiUrl(`/storage/v1/object/${bucket}/${oldEncoded}`), {method:'DELETE',headers:headers()});
    if (!removed.ok) throw new Error(`Foto baru tersimpan, tetapi objek lama belum dapat dihapus (${removed.status}).`);
    oldRemoved = true;
  } catch (error) {
    const rollbackErrors = [];
    if (oldRemoved) {
      const restored = await fetch(objectUrl(oldPath), {method:'POST',headers:headers({'Content-Type':oldContentType,'x-upsert':'true'}),body:oldBytes});
      if (!restored.ok) rollbackErrors.push(`pemulihan objek lama gagal (${restored.status})`);
    }
    if (metadataUpdated) {
      try { await request(`/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(oldMetadata)}); }
      catch { rollbackErrors.push('pemulihan metadata gagal'); }
    }
    for (const change of changedReferences.reverse()) {
      try { await request(`/rest/v1/${change.table}?${change.filterColumn}=eq.${encodeURIComponent(change.filterValue)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(change.before)}); }
      catch { rollbackErrors.push(`pemulihan referensi ${change.table} gagal`); }
    }
    const nextEncoded = nextPath.split('/').map(encodeURIComponent).join('/');
    const cleanup = await fetch(apiUrl(`/storage/v1/object/${bucket}/${nextEncoded}`), {method:'DELETE',headers:headers()});
    if (!cleanup.ok) rollbackErrors.push('pembersihan objek baru gagal');
    throw new Error(`${error.message}${rollbackErrors.length ? ` Pemulihan perlu ditinjau: ${rollbackErrors.join(', ')}.` : ''}`);
  }
  state.toast='Foto berhasil diganti.'; await render();
}

function replaceAssetValue(value, oldPath, oldUrl, nextPath, nextUrl) {
  if (typeof value === 'string') return value.replaceAll(oldUrl, nextUrl).replaceAll(oldPath, nextPath);
  if (Array.isArray(value)) return value.map(item => replaceAssetValue(item, oldPath, oldUrl, nextPath, nextUrl));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,replaceAssetValue(item,oldPath,oldUrl,nextPath,nextUrl)]));
  return value;
}

async function updateAssetReferences(asset, nextPath, nextUrl, changes) {
  const oldPath = asset.storage_path;
  const oldUrl = asset.public_url;
  const sourceMap = [
    ['products','image_path,image_url',['image_path','image_url']],
    ['services','image_path,image_url',['image_path','image_url']],
    ['destinations','image_path,image_url,gallery_urls',['image_path','image_url','gallery_urls']],
    ['portfolio_projects','cover_image_path,cover_image_url',['cover_image_path','cover_image_url']],
    ['portfolio_images','storage_path,image_url',['storage_path','image_url']],
    ['homepage_sections','image_url',['image_url']],
  ];
  for (const [table,columns,fields] of sourceMap) {
    const rows = await request(`/rest/v1/${table}?select=id,${columns}`);
    for (const row of rows || []) {
      const before = {};
      const after = {};
      for (const field of fields) {
        const replaced = replaceAssetValue(row[field], oldPath, oldUrl, nextPath, nextUrl);
        if (JSON.stringify(replaced) !== JSON.stringify(row[field])) { before[field] = row[field]; after[field] = replaced; }
      }
      if (Object.keys(after).length) {
        await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(row.id)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(after)});
        changes.push({table,filterColumn:'id',filterValue:row.id,before});
      }
    }
  }
  const settings = await request('/rest/v1/site_settings?select=key,value');
  for (const row of settings || []) {
    const value = replaceAssetValue(row.value, oldPath, oldUrl, nextPath, nextUrl);
    if (JSON.stringify(value) !== JSON.stringify(row.value)) {
      await request(`/rest/v1/site_settings?key=eq.${encodeURIComponent(row.key)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})});
      changes.push({table:'site_settings',filterColumn:'key',filterValue:row.key,before:{value:row.value}});
    }
  }
}

async function deleteAsset(id) {
  const asset = state.media.find(item => item.id === id);
  if (!asset) return;
  const checks = await Promise.all([
    ['products',`image_path=eq.${encodeURIComponent(asset.storage_path)}`],
    ['services',`image_path=eq.${encodeURIComponent(asset.storage_path)}`],
    ['destinations',`image_path=eq.${encodeURIComponent(asset.storage_path)}`],
    ['portfolio_projects',`cover_image_path=eq.${encodeURIComponent(asset.storage_path)}`],
    ['portfolio_images',`storage_path=eq.${encodeURIComponent(asset.storage_path)}`],
  ].map(([table,filter]) => request(`/rest/v1/${table}?${filter}&select=id`)));
  if (checks.some(rows => rows.length)) throw new Error('Foto ini masih dipakai konten. Lepaskan dari semua konten sebelum menghapusnya.');
  if (!window.confirm(`Hapus permanen ${asset.file_name} dari pustaka media?`)) return;
  const encoded = asset.storage_path.split('/').map(encodeURIComponent).join('/');
  const removed = await fetch(apiUrl(`/storage/v1/object/${assetBucket(asset)}/${encoded}`), {method:'DELETE',headers:headers()});
  if (!removed.ok) throw new Error(`File tidak dapat dihapus dari Storage (${removed.status}).`);
  await request(`/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`, {method:'DELETE'});
  state.toast='Foto dihapus.'; await render();
}

async function handleSubmit(event) {
  const form = event.target;
  if (!form.matches('#admin-login-form,#admin-reset-form,#admin-update-password,#admin-record-form,.admin-settings-form,#admin-section-form,#admin-seo-form,#admin-upload-form,.admin-media-meta')) return;
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  try {
    if (form.id === 'admin-login-form') {
      const data = new FormData(form);
      const session = await authRequest('/auth/v1/token?grant_type=password',{email:data.get('email'),password:data.get('password')});
      saveSession(session);
      if (!(await verifyAdmin())) throw new Error('Akun ini belum diberi akses administrator. Hubungi pemilik sistem.');
      history.replaceState({}, '', '/admin'); state.view='overview'; await render(); return;
    }
    if (form.id === 'admin-reset-form') {
      const email = new FormData(form).get('email');
      await authRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${location.origin}/admin/update-password`)}`,{email});
      resetView('Jika alamat email terdaftar sebagai admin, tautan reset akan segera dikirim.'); return;
    }
    if (form.id === 'admin-update-password') {
      const data = new FormData(form);
      if (data.get('password') !== data.get('confirm')) throw new Error('Kata sandi dan konfirmasi tidak sama.');
      if (!state.session?.access_token) throw new Error('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.');
      const response = await fetch(apiUrl('/auth/v1/user'),{method:'PUT',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({password:data.get('password')})});
      if (!response.ok) throw new Error('Kata sandi gagal diperbarui. Tautan mungkin sudah kedaluwarsa.');
      clearSession(); history.replaceState({}, '', '/admin/login'); loginView('Kata sandi sudah diperbarui. Silakan masuk.'); return;
    }
    if (form.id === 'admin-record-form') { await saveRecord(form,event.submitter?.dataset.publish === 'true'); return; }
    if (form.classList.contains('admin-settings-form') && form.id !== 'admin-seo-form') { await saveSetting(form); return; }
    if (form.id === 'admin-section-form') { await saveSection(form,event.submitter?.dataset.publish === 'true'); return; }
    if (form.id === 'admin-seo-form') { await saveSeo(form); return; }
    if (form.id === 'admin-upload-form') { await uploadAssets(form); return; }
    if (form.classList.contains('admin-media-meta')) {
      const data=new FormData(form); const id=form.dataset.mediaId;
      await request(`/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:data.get('category'),alt_text:data.get('alt_text'),is_published:form.elements.is_published.checked,updated_by:state.session.user.id})});
      state.toast='Detail media disimpan.'; await render();
    }
  } catch (error) {
    const message = error?.message || 'Terjadi kesalahan.';
    if (location.pathname === '/admin/login') loginView(message);
    else if (location.pathname.startsWith('/admin/reset') || location.pathname === '/admin/update-password') resetView(message);
    else { state.toast=message; await render().catch(()=>{}); }
  } finally { state.busy=false; }
}

async function saveSeo(form) {
  const data=new FormData(form); const payload={page_path:data.get('page_path'),page_title:data.get('page_title'),canonical_url:data.get('canonical_url'),meta_description:data.get('meta_description'),open_graph_image:data.get('open_graph_image'),is_published:true,updated_by:state.session.user.id};
  await request('/rest/v1/seo_metadata?on_conflict=page_path',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  state.seoPath=payload.page_path; state.toast='Metadata SEO disimpan.'; await render();
}

async function handleClick(event) {
  const control=event.target.closest('[data-action]');
  if (!control) return;
  const action=control.dataset.action;
  try {
    if (action==='view') { state.view=control.dataset.view; state.table=collections[state.view]?.table||''; state.selected=null; state.sectionEditorOpen=false; await render(); }
    if (action==='logout') { try { await fetch(apiUrl('/auth/v1/logout'),{method:'POST',headers:headers()}); } catch {} clearSession(); history.replaceState({},'','/admin/login'); loginView(); }
    if (action==='save-record') {
      event.preventDefault();
      const form=control.closest('#admin-record-form');
      if (!form || state.busy || !form.reportValidity()) return;
      state.busy=true;
      try { await saveRecord(form,control.dataset.publish==='true'); }
      finally { state.busy=false; }
    }
    if (action==='new-record') { state.selected=blankRecord(state.table); await render(); }
    if (action==='cancel-edit') { state.selected=null; state.sectionEditorOpen=false; await render(); }
    if (action==='edit') { state.selected=state.rows.find(row=>row.id===control.dataset.id)||null; await render(); }
    if (action==='delete') {
      const row=state.rows.find(item=>item.id===control.dataset.id);
      if (!row || !window.confirm(`Hapus “${row.title || row.slug || 'konten ini'}”? Tindakan ini tidak dapat dibatalkan.`)) return;
      await request(`/rest/v1/${collections[state.view].table}?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE'});
      state.toast='Konten dihapus.'; await render();
    }
    if (action==='new-section') { state.selected={section_key:'',title:'',description:'',content:{},is_published:false,sort_order:(state.sections.length+1)*10}; state.sectionEditorOpen=true; await render(); }
    if (action==='edit-section') { state.selected=state.sections.find(row=>row.id===control.dataset.id)||null; state.sectionEditorOpen=Boolean(state.selected); await render(); }
    if (action==='save-section') {
      const form=root.querySelector('#admin-section-form');
      if (!form || state.busy || !form.reportValidity()) return;
      state.busy=true;
      try { await saveSection(form,control.dataset.publish==='true'); }
      finally { state.busy=false; }
    }
    if (action==='delete-section') {
      const row=state.sections.find(item=>item.id===control.dataset.id);
      if (!row || !window.confirm(`Hapus bagian “${row.title || row.section_key}”? Tindakan ini tidak dapat dibatalkan.`)) return;
      await request(`/rest/v1/homepage_sections?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE'});
      state.selected=null; state.sectionEditorOpen=false; state.toast='Bagian beranda dihapus.'; await render();
    }
    if (action==='copy-media') { await navigator.clipboard.writeText(control.dataset.url); state.toast='URL foto disalin.'; await render(); }
    if (action==='replace-media') await replaceAsset(control.dataset.id);
    if (action==='delete-media') await deleteAsset(control.dataset.id);
  } catch (error) { state.toast=error.message; await render(); }
}

function handleChange(event) {
  const picker=event.target.closest('[data-image-picker]');
  if (picker && picker.value) {
    const field=picker.dataset.imagePicker;
    const input=picker.closest('.admin-image-field').querySelector(`input[name="${CSS.escape(field)}"]`);
    input.value=picker.value;
    const asset=state.media.find(item=>item.public_url===picker.value);
    const pathInput=picker.closest('form')?.elements.namedItem(field.replace('_url','_path'));
    if (asset && pathInput) pathInput.value=asset.storage_path;
    const preview=picker.closest('.admin-image-field').querySelector('.admin-image-preview');
    if (preview) preview.src=picker.value;
    else picker.insertAdjacentHTML('afterend',`<img class="admin-image-preview" src="${esc(picker.value)}" alt="Pratinjau foto">`);
  }
  if (event.target.matches('#admin-upload-form input[type=file]')) {
    const preview=document.querySelector('#admin-upload-preview');
    preview.innerHTML=[...event.target.files].map(file=>`<figure><img src="${URL.createObjectURL(file)}" alt="Pratinjau ${esc(file.name)}"><figcaption>${esc(file.name)}</figcaption></figure>`).join('');
  }
  if (event.target.matches('#admin-replace-file')) {
    const file=event.target.files?.[0]; const id=event.target.dataset.assetId;
    if (file) performReplace(file,id).catch(error=>{state.toast=error.message;render();});
  }
}

async function handleSeoPathChange(event) {
  if (event.target.name!=='page_path') return;
  state.seoPath=event.target.value;
  await loadViewData();
  appShell(seoView());
}

root.addEventListener('click', handleClick);
root.addEventListener('submit', event => handleSubmit(event));
root.addEventListener('change', event => { handleChange(event); handleSeoPathChange(event).catch(()=>{}); });

document.addEventListener('click', event => {
  if (event.target.closest('#admin-login-form a, #admin-reset-form a, .admin-back')) return;
});

render().catch(error => {
  root.innerHTML = `<main class="admin-gate"><section class="admin-gate-card"><h1>Dashboard tidak dapat dibuka</h1><p>${esc(error.message)}</p><a class="admin-button" href="/admin/login">Kembali ke login</a></section></main>`;
});
