# POSMerahPutih

Aplikasi **Point of Sale (POS)** modern & _local-first_ untuk UMKM retail dan F&B.
Berjalan 100% offline menggunakan database **SQLite** di browser (sql.js), dengan
roadmap menuju omnichannel marketplace, KDS, Table Layout, Self-Order, dan wrapper
native (Tauri / Capacitor).

> Versi PRD acuan: **1.5** · Stack: **React (Vite) + SQLite (local-first) + Tailwind CSS**

## Fitur pada foundation ini (Milestone 1)

- ⚙️ Inisialisasi database SQLite lokal dengan **25 tabel** (lihat `src/db/schema.sql`),
  dipersist otomatis ke **IndexedDB** — data bertahan walau browser ditutup.
- 🧩 Modularitas fitur lewat tabel `app_settings` (KDS, Table Layout, Self-Order,
  Marketplace, Queue bisa dinyalakan/dimatikan).
- 🛒 **Layar Kasir inti**: grid produk (kiri 65%) + panel keranjang (kanan 35%)
  sesuai wireframe PRD — pencarian produk/SKU, filter kategori, penggabungan item
  otomatis, kalkulasi pajak, simpan **Draft** atau **Bayar** (menulis transaksi &
  memotong stok).
- 🎨 Palet warna sesuai identitas visual PRD (Tailwind theme).

## Menjalankan

```bash
npm install
npm run dev      # buka http://localhost:5173
```

Build produksi:

```bash
npm run build
npm run preview
```

## Struktur proyek

```
src/
  db/            # schema.sql (25 tabel), database.ts (sql.js + IndexedDB), seed.ts
  features/
    pos/         # Layar kasir: PosPage, ProductCard, CartPanel, useCart, posRepository
    tables/      # (roadmap) Interactive Table Layout
    kds/         # (roadmap) Kitchen Display System
    settings/    # (roadmap) Konfigurasi & modularitas
  lib/           # format Rupiah, invoice, akses app_settings
  types/         # tipe domain
```

> **Status: seluruh spesifikasi fungsional PRD v1.5 telah diimplementasikan** (M1–M10). Yang tersisa bersifat operasional/integrasi eksternal: adapter API marketplace nyata & kompilasi native (butuh toolchain & kredensial di mesin lokal).

## Roadmap (mengikuti Milestone PRD)

| Milestone | Cakupan |
|-----------|---------|
| **M1** ✅ | Init proyek, SQLite 22 tabel, app_settings, layar kasir inti |
| **M2** ✅ | Router + shell navigasi, **Canvas Table Layout** (drag-drop, indikator warna, integrasi POS), **Queue** (terbit A/B, monitor TV publik, TTS) |
| **M3** ✅ | Bus real-time lokal (BroadcastChannel), **KDS** (aging timer, check-off item), **Self-Order** (menu QR pelanggan → dapur), **Voucher Generator** massal + diskon voucher di POS, **Marketplace** config scaffold |
| **M4** ✅ | **Relay WebSocket LAN** (`server/relay.mjs`, sinkron lintas-perangkat), **Sync Queue offline-first** (auto-flush saat online), indikator koneksi, konfigurasi **Tauri** (desktop) & **Capacitor** (mobile). _Adapter API marketplace nyata & kompilasi native butuh toolchain lokal._ |
| **M5** ✅ | **Member & Loyalitas** (CRUD, poin otomatis saat bayar + audit `point_logs`), **Dashboard & Laporan** manajer (KPI, penjualan per sumber, produk terlaris), **Ekspor CSV** (PRD 4.8) |
| **M6** ✅ | **Supplier & Stok Masuk** (penerimaan barang → tambah stok + catat HPP), **Riwayat Transaksi & Refund** (pengembalian dana → restok + audit `refunds`/`refund_details` + koreksi poin member) |
| **M7** ✅ | **Pembayaran Berganda** (PRD 4.5): modal checkout multi-metode (Tunai/QRIS/Debit/Kredit), kalkulasi kembalian, referensi QRIS, dicatat ke `transaction_payments` & tampil di Riwayat |
| **M8** ✅ | **Pre-Order & Uang Muka** (PRD 4.6): buat pesanan di muka dengan tenggat + DP (stok belum dipotong), pelunasan saat ambil (potong stok + poin) via modal pembayaran |
| **M9** ✅ | **Cicilan Internal** (PRD 4.5): rencana kredit member (pokok + tenor + bunga flat), angsuran bulanan → sisa berkurang, jatuh tempo maju, status UNPAID→PARTIALLY_PAID→PAID (`transaction_installments`) |
| **M10** ✅ | **Split Bill** (`parent_transaction_id`): pisah item satu order ke beberapa nota tertaut, **Voucher-as-tender** (PRD 4.4): bayar pakai gift card (`VALUE_DEPOSIT`) di modal pembayaran. Nomor invoice kini ber-suffix urut agar unik. |
| **M11** ✅ | **Pengaturan Fasilitas** (PRD 4.7): kelola outlet, tarif pajak, rasio poin, dan **toggle modul** (KDS/Meja/Antrean/Self-Order/Marketplace) — perubahan modul langsung memperbarui menu navigasi tanpa reload. |
| **M12** ✅ | **Struk / Receipt**: lihat & cetak ulang struk transaksi dari Riwayat (header outlet, item, pajak, pembayaran + kembalian, poin). Cetak via iframe tersembunyi. |
| **M13** ✅ | **Desain Struk**: kustomisasi struk (tagline, catatan kaki/tambahan, tampil/sembunyi alamat/telepon/member/poin, lebar 58/80mm) dengan pratinjau langsung; tersimpan di `app_settings` & diterapkan ke struk tampil/cetak. |
| **M14** ✅ | **Desain Struk lanjutan**: unggah **logo/gambar** (otomatis di-resize, posisi atas/bawah), **teks multiline** (tagline/penutup/catatan), dan **perataan** header/footer (kiri/tengah/kanan) — semua dengan pratinjau langsung. |
| **M15** ✅ | **Menu sidebar aktif**: sidebar dapat dibuka/tutup (expand berlabel ↔ ringkas ikon) via tombol ☰ di header sidebar maupun header Kasir; konten menyesuaikan lebar. |
| **M16** ✅ | **Logo dari URL**: pasang logo struk dengan menempel URL gambar (diunduh & disimpan sebagai data URL agar tetap local-first). Butuh URL publik yang mengizinkan CORS. |
| **M17** ✅ | **Logo aplikasi**: brand POS Merah Putih terpasang di badge sidebar, favicon tab, dan layar loading (`public/logo-mark.png` + `public/logo-full.png`). |
| **M18** ✅ | **Logo di semua permukaan**: header **Monitor TV** & **Self-Order**, serta **logo default struk** (path relatif di-absolutkan agar tetap tercetak; bisa diganti/hapus via Desain Struk). |
| **M19** ✅ | **Persona & Peran/Hak Akses** (di Setelan): kelola pengguna (persona) + peran dengan izin per-menu (disimpan JSON di `app_settings`). Persona aktif memfilter menu sidebar sesuai hak akses; **Setelan selalu tampil** agar tak terkunci. |
| **M20** ✅ | **Tema** (di Setelan): 6 pilihan tema (**Merah Putih/bawaan** + Klasik, Laut, Hutan, Senja, Anggur) via CSS variables; berlaku seketika seluruh aplikasi & tersimpan. Warna status (hijau/merah/kuning) tetap semantik. |
| **M21** ✅ | **Data Master**: grup menu baru berisi **Produk** (CRUD katalog + kategori, dgn stok awal), **Kategori Produk** (CRUD kategori: nama, warna, jumlah produk), dan **Contact** (tab **Pelanggan**/member, **Pemasok**/supplier, **Karyawan**/persona, **Penjual**/baru di `app_settings`). |
| **M22** ✅ | **Member CRUD lengkap**: identitas (nama/kontak/email/alamat/tgl lahir/jenis kelamin/pekerjaan), keanggotaan (no. kartu, **tingkatan** Silver/Gold/Platinum/Diamond, tgl daftar, masa berlaku, **status** Aktif/Nonaktif/Ditangguhkan/Diblokir), loyalti (poin, **saldo/kredit**, preferensi) + **riwayat transaksi & penukaran poin**. Kolom `members` diperluas via migrasi otomatis. |
| **M23** ✅ | **ID Card member dengan template desainable** (Setelan › Desain Kartu): editor kartu (judul, warna gradien/preset, logo, barcode, tampil tier/masa berlaku/poin) + pratinjau langsung; tombol **Kartu ID** di detail member untuk lihat, **cetak**, & **unduh PNG** kartu. |
| **M24** ✅ | **Data Master Outlet & Kasir**: **Outlet** (CRUD cabang: nama, alamat, telepon, aktif/nonaktif; hapus dijaga bila masih ada kasir/transaksi/stok/meja), **Kasir** (CRUD titik/mesin kasir per outlet: nama, kode, lokasi, status; filter per outlet). Tabel `cashiers` (ke-23) dibuat via migrasi otomatis untuk database lama. |
| **M25** ✅ | **Master Meja** (Data Master): CRUD meja lintas outlet (nomor/nama, area INDOOR/OUTDOOR/VIP, **kapasitas standar** & **kapasitas maksimum**) + filter per outlet. Kolom `max_capacity` ditambahkan ke `dining_tables` via migrasi otomatis (default = kapasitas saat ini). |
| **M26** ✅ | **Catatan khusus pesanan**: catatan **per item** (mis. "tanpa sambal, level pedas") tampil di KDS (dapur) & detail Riwayat, dan catatan **per transaksi** (mis. "bungkus terpisah") tersimpan di header transaksi & tampil di detail Riwayat. Kolom `transactions.note` via migrasi otomatis; item memakai `transaction_details.notes` yang sudah ada. |
| **M27** ✅ | **Merge Bill / Gabung Tagihan** (opsional, Setelan › Fitur Kasir, **bawaan nonaktif**): gabungkan ≥2 bill tersimpan (Draft) menjadi satu — item dipindah ke bill target (id terkecil), total & pajak dihitung ulang, catatan digabung, meja bill lain dikosongkan, header lama dihapus (satu transaksi SQL). Tombol "Gabung Bill" muncul di layar kasir saat diaktifkan. |
| **M28** ✅ | **Mode Scan Barcode di kasir** (tombol "Scan": input jadi kolom barcode, scan/ketik + Enter → produk otomatis masuk keranjang via `barcode`/`sku` persis, tangani stok habis & tidak ditemukan), **snackbar konfirmasi tiap item** yang ditambahkan (scan maupun ketuk kartu), dan **master produk lebih detail**: kolom baru `barcode`, `cost_price` (modal/HPP), `unit` (satuan), `min_stock`, `description`, `is_active` — via migrasi otomatis; tabel & form produk diperluas, produk nonaktif disembunyikan dari kasir. |
| **M29** ✅ | **Data Master Satuan & Pajak**: **Satuan** (CRUD satuan produk + status aktif; dipakai sebagai pilihan di form Produk), **Pajak** (CRUD jenis pajak: nama, tarif %, default, aktif). Tarif pajak **default aktif** disinkronkan ke `app_settings.tax_rate` sehingga otomatis dipakai kasir & struk; Setelan › Pengaturan menampilkan tarif read-only + tautan "Kelola Pajak". Tabel `units` (24) & `taxes` (25) via migrasi otomatis. |
| **M30** ✅ | **Gambar produk** di Master Produk: unggah foto (otomatis diperkecil ke lebar 320px & disimpan sebagai data URL di `products.image_path`), pratinjau + ganti/hapus di form; thumbnail tampil di tabel produk dan **kartu produk kasir** (menggantikan inisial). |
| **M31** ✅ | **Perbaikan Monitor TV**: monitor antrean (tab terpisah) kini tersegar **real-time lintas-tab**. Sebelumnya salinan sql.js in-memory-nya basi sehingga antrean baru tak muncul. Perbaikan: aksi antrean (`issueQueue`/`setQueueStatus`) kini `publish('queue:update')`, dan monitor **memuat ulang snapshot DB dari IndexedDB** (`reloadDatabase`) pada tiap event realtime + polling cadangan sebelum menampilkan. |
| **M32** ✅ | **Kalimat panggilan antrean dapat diatur** (Setelan › Pengaturan › Antrean): teks TTS panggilan "Tandai Siap" kini dari `app_settings.queue_call_text` dengan placeholder `{no}` (nomor antrean, dieja per karakter) + tombol "🔊 Coba" untuk pratinjau suara. Bawaan: "Nomor antrian {no}, silakan diambil." |
| **M33** ✅ | **Peningkatan layar Kasir**: info **Total Item** (badge + ringkasan), **pemilih pelanggan** dari master (📇 dropdown cari nama/HP → set nama + member/loyalti), **nomor invoice bisa diedit** (dipakai saat simpan via `saveOrder.invoiceNumber`), **catatan item & catatan transaksi kini tersembunyi default** dengan tombol "＋" untuk menampilkan. Dua toggle baru di Setelan › Fitur Kasir (bawaan **nonaktif**): **Kode Voucher** & **Pre-Order** — kolom terkait di kasir hanya muncul saat diaktifkan. |
| **M34** ✅ | **Kasir — menu opsi aksi**: "Simpan Bill (Draft)" & "Split Bill" dipindah ke **menu dropdown "⋮"** di **sebelah kiri** tombol "Bayar" (tombol Bayar kini lebih dominan). Menu tutup saat memilih/klik luar; Split Bill nonaktif bila item < 2. |

### Sinkronisasi real-time (local-first)

Perubahan antar-layar disiarkan lewat `BroadcastChannel` (`src/lib/realtime.ts`) —
instan untuk layar pada origin/perangkat yang sama (Kasir, KDS, Self-Order, Monitor).
Transport ini dipetakan ke **WebSocket relay LAN** pada M4 untuk sinkron lintas-perangkat
dalam satu jaringan lokal. Catatan: BroadcastChannel tidak mengirim balik ke pengirimnya,
jadi `publish()` juga men-_deliver_ ke pelanggan lokal agar layar pemicu ikut menyegar.

### Rute aplikasi

| Path | Layar |
|------|-------|
| `#/` | Kasir (POS) — + diskon voucher |
| `#/outlets` | Data Master › Outlet (cabang) |
| `#/cashiers` | Data Master › Kasir (titik kasir per outlet) |
| `#/master-tables` | Data Master › Master Meja (kapasitas standar & maksimum) |
| `#/products` | Data Master › Produk (katalog) |
| `#/categories` | Data Master › Kategori Produk |
| `#/units` | Data Master › Satuan (satuan produk) |
| `#/taxes` | Data Master › Pajak (jenis & tarif pajak) |
| `#/contacts` | Data Master › Contact (pelanggan/pemasok/karyawan/penjual) |
| `#/tables` | Tata Letak Meja |
| `#/kds` | Kitchen Display System (dapur) |
| `#/queue` | Sistem Antrean (operator) |
| `#/members` | Member & Loyalitas Poin |
| `#/stockin` | Stok Masuk & Supplier |
| `#/history` | Transaksi › Riwayat & Refund |
| `#/preorder` | Transaksi › Pre-Order & Uang Muka |
| `#/installments` | Cicilan Internal |
| `#/vouchers` | Voucher Generator |
| `#/marketplace` | Integrasi Marketplace (config) |
| `#/dashboard` | Dashboard manajer (KPI, penjualan per sumber, produk terlaris) |
| `#/reports` | Laporan transaksi (tabel + Ekspor CSV) |
| `#/settings` | Setelan › Pengaturan (outlet, pajak, poin, modul) |
| `#/personas` | Setelan › Persona (pengguna aplikasi) |
| `#/roles` | Setelan › Peran & Hak Akses |
| `#/theme` | Setelan › Tema (6 pilihan warna) |
| `#/receipt-design` | Setelan › Desain Struk (kustomisasi + pratinjau) |
| `#/monitor` | Monitor antrean publik (Smart TV) |
| `#/order/:tableNumber` | Self-Order pelanggan (QR meja) |

## Sinkronisasi lintas-perangkat (Relay WebSocket LAN)

Untuk sinkron real-time antar-perangkat dalam satu jaringan lokal (Tablet Kasir ↔
Kitchen Display ↔ Self-Order ↔ Monitor TV), jalankan relay ringan tanpa dependensi:

```bash
npm run relay          # ws://0.0.0.0:7071 (health: http://localhost:7071/)
```

Klien web otomatis menyambung ke `ws://<host>:7071` dan menyambung ulang bila relay
dinyalakan belakangan. Bila relay tak aktif, aplikasi tetap jalan penuh dengan
BroadcastChannel (sekelas perangkat). Indikator **Online/Relay/antre** ada di bilah kiri.

## Offline-first & Sync Queue

Operasi yang butuh internet (mis. push stok marketplace) masuk **Sync Queue** lokal
(`src/lib/syncQueue.ts`). Saat offline, operasi mengendap; saat online kembali, antrean
otomatis di-_flush_. Transaksi kasir, KDS, meja, dan antrean tetap berjalan penuh tanpa
internet.

## Kompilasi Native (butuh toolchain lokal)

**Desktop (Tauri v2)** — perlu Rust + prasyarat OS ([tauri.app](https://tauri.app)):

```bash
npm i -D @tauri-apps/cli
npm run tauri:dev      # jalankan sebagai app desktop
npm run tauri:build    # bundel .app/.dmg/.msi/.deb
```

**Mobile (Capacitor)** — perlu Android SDK / Xcode:

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
npm run build && npx cap add android && npm run cap:sync
npm run cap:android    # buka di Android Studio
```

Konfigurasi sudah disediakan: `src-tauri/` dan `capacitor.config.ts`.

## Catatan teknis

- **Local-first**: engine SQLite dimuat dari `sql.js` (WASM) yang di-_bundle_ lokal,
  bukan CDN — tidak butuh internet untuk operasional dasar.
- Snapshot database disimpan ke IndexedDB setiap operasi tulis (`persist()`).
- Untuk mereset data demo: hapus IndexedDB `posmerahputih` dari DevTools → Application.

---

🤖 Foundation di-scaffold dengan [Claude Code](https://claude.com/claude-code).
