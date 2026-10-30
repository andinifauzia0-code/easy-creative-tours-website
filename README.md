# Easy Creative Tours

Website lokal untuk Easy Creative Tours, partner 360° perjalanan dan event. Aplikasi menggunakan HTML, CSS, JavaScript, serta server Node.js bawaan tanpa dependensi eksternal.

## Menjalankan secara lokal

Dengan Node.js 18 atau lebih baru:

```sh
node server.mjs
```

Buka [http://localhost:3000](http://localhost:3000). Gunakan `PORT=3001 node server.mjs` jika port 3000 sudah dipakai.

## Build produksi

Jalankan `npm run build` untuk membuat hasil situs statis di `dist/`. Vercel memakai preset **Other**, Node.js **24.x**, build command `npm run build`, dan output directory `dist`. Route aplikasi tetap diarahkan ke `index.html`; file aset yang cocok disajikan langsung.

Pada build Vercel, sitemap, robots, canonical, dan Open Graph memakai host proyek aktual dari `VERCEL_PROJECT_PRODUCTION_URL` atau `VERCEL_URL`. Jika variabel sistem Vercel tidak diekspos, build Vercel akan berhenti dengan pesan yang meminta `PUBLIC_SITE_URL`. Situs ini tidak memerlukan rahasia atau variabel lingkungan bisnis.

Konfigurasi Vercel dan fallback SPA ada di [vercel.json](vercel.json). Tidak ada domain permanen yang ditetapkan oleh proyek.

## Isi website

- Halaman beranda, tentang, layanan, direktori destinasi, katalog program, inspirasi portofolio, dan kontak.
- Halaman detail untuk 8 layanan, 17 destinasi, dan 10 konsep paket.
- Pencarian destinasi, filter kategori, pencarian/filter katalog, dan filter inspirasi.
- Formulir inquiry dengan validasi browser yang menyiapkan pesan lengkap di WhatsApp Easy Creative Tours. Pesan baru terkirim setelah pengunjung menekan kirim di WhatsApp.
- Navigasi responsif, tombol WhatsApp mengambang, metadata dasar, `robots.txt`, dan sitemap.

## Konten dan aset

Konten katalog dipisahkan di bagian atas `src.js` agar mudah disunting. Semua program awal adalah konsep, bukan penawaran harga tetap. Kartu portofolio secara jelas bertanda contoh konsep. Foto sementara memakai URL gambar Unsplash dan memerlukan koneksi internet; ganti URL foto di `src.js` dengan aset lokal saat dokumentasi resmi tersedia.

Logo asli Easy Creative Tours tersedia di `public/assets/brand/easy-creative-tours-logo.png`. Catatan penggantian aset dan foto sementara ada di [ASSETS.md](ASSETS.md).

Saat domain resmi tersedia, atur domain proyek di Vercel. Host kanonis dan sitemap untuk deployment berikutnya mengikuti host produksi Vercel secara otomatis. Jam operasional dan alamat lokasi belum ditampilkan sebagai fakta karena belum diverifikasi.

### Menghubungkan domain resmi nanti

1. Buka **Vercel Dashboard → Project → Settings → Domains** dan tambahkan domain yang sudah dimiliki perusahaan.
2. Ikuti nilai DNS yang ditampilkan Vercel di penyedia domain; nilai record dapat berbeda menurut domain dan konfigurasi yang ada.
3. Tetapkan domain utama setelah Vercel memverifikasi DNS. Vercel akan mengaktifkan HTTPS setelah domain siap.
4. Jalankan deployment produksi baru. Canonical dan Open Graph mengikuti origin yang sedang dibuka; sitemap dan `robots.txt` mengikuti `VERCEL_PROJECT_PRODUCTION_URL` atau `VERCEL_URL` saat build.
5. Periksa redirect domain lama/baru, `/sitemap.xml`, dan `/robots.txt` sebelum mendaftarkan domain ke mesin pencari.
