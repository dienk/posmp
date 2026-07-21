# POSMerahPutih

Aplikasi **Point of Sale (POS)** modern & _local-first_ untuk UMKM retail dan F&B.
Berjalan 100% offline menggunakan database **SQLite** di browser (sql.js), dengan
roadmap menuju omnichannel marketplace, KDS, Table Layout, Self-Order, dan wrapper
native (Tauri / Capacitor).

> Versi PRD acuan: **1.5** · Stack: **React (Vite) + SQLite (local-first) + Tailwind CSS**

## Fitur pada foundation ini (Milestone 1)

- ⚙️ Inisialisasi database SQLite lokal dengan **29 tabel** (lihat `src/db/schema.sql`),
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
  db/            # schema.sql (29 tabel), database.ts (sql.js + IndexedDB), seed.ts
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
| **M35** ✅ | **Transaksi Draft** (Transaksi › Draft): daftar bill berstatus DRAFT (invoice, meja, item, total, tanggal) + detail item/catatan; aksi **Batalkan Draft** (`deleteDraft` — hapus draft + tiket dapur + kosongkan meja). Tersegar realtime `order:update`. |
| **M36** ✅ | **Kasir — Buka Draft**: opsi "📂 Buka Draft" di menu "⋮" memuat bill DRAFT tersimpan kembali ke keranjang (item + catatan + invoice + fasilitas + member) untuk dilanjutkan. Saat disimpan/dibayar, draft lama **dihapus atomik** dalam transaksi SQL yang sama (`saveOrder.replaceDraftId`) sehingga tak duplikat & nomor invoice tetap. |
| **M37** ✅ | **Setelan Tema lebih detail**: tiap preset kini menampilkan **rincian palet** (7 swatch peran warna + hex). Ditambah **editor Tema Kustom**: color picker per peran (brand/soft/strong, latar, permukaan, teks utama/sekunder) dengan pratinjau langsung & hex; simpan ke `app_settings` (`theme='custom'`, palet JSON di `theme_custom`) dan diterapkan seluruh aplikasi via `ThemeApplier`. |
| **M38** ✅ | **Modul Stock Opname** (menu Stock Opname): lembar hitung stok fisik vs sistem dengan **mode scan barcode** (scan/ketik barcode + Enter → tambah hitungan fisik) + input/±  manual & selisih per produk; **Simpan Opname** menyetel `outlet_stocks.stock` ke jumlah fisik dan mencatat audit (`stock_opnames` 26 + `stock_opname_details` 27, via migrasi otomatis). Menampilkan opname terakhir. |
| **M39** ✅ | **Menu "Stock" + Kartu Stock**: menu stok kini grup **Stock** (Stok Masuk · Stock Opname · **Kartu Stock**). Kartu Stock = kardex mutasi stok per produk: gabungan stok masuk (+), penjualan (−), refund (+), penyesuaian opname (±) urut kronologis dengan **saldo berjalan** (saldo awal dihitung mundur dari stok saat ini) + ringkasan saldo awal/masuk/keluar/stok kini. |
| **M40** ✅ | **Stok Masuk & Supplier lebih lengkap** (3 tab): **Penerimaan** (form + subtotal per baris & total qty/modal), **Supplier CRUD** (nama, kontak, telepon, alamat, status aktif; jumlah pemakaian; edit/hapus dijaga bila sudah dipakai penerimaan), **Riwayat** (daftar + total modal per penerimaan → detail baris item: produk, qty, modal, subtotal, total, catatan). |
| **M41** ✅ | **Penerimaan: input waktu + Update/Delete Riwayat**: field **Waktu Penerimaan** (datetime-local, disimpan ke `entry_date`); **Edit** memuat penerimaan ke form & **menyesuaikan stok dengan selisih** (qty baru − lama), **Hapus** mengembalikan (mengurangi) stok — keduanya dijaga agar stok tak minus (barang sudah terpakai) & dalam satu transaksi SQL + publish `order:update`. |
| **M42** ✅ | **Menu "Saldo Awal"** (grup Stock): lembar setel **stok pembuka (baseline)** per produk — input saldo awal + selisih vs stok saat ini; simpan menyetel `outlet_stocks.stock` **langsung** ke nilai tersebut (upsert, bukan penambahan). Berbeda dari Stock Opname yang mencatat selisih sebagai mutasi. |
| **M44x** ✅ | **User & peran contoh (hak akses berbeda)**: `DEFAULT_ROLES` +2 peran — **Supervisor** (operasional penuh tanpa Channel/Kiosk) & **Staf Gudang** (Data Master, Stok Masuk, Opname, Laporan). `DEFAULT_PERSONAS` +4 user contoh (Budi Santoso→Supervisor, Sari Kasir→Kasir, Andi Gudang→Gudang, Dewi Dapur→Dapur) — DB baru langsung punya 5 user. Terverifikasi: mengaktifkan Sari Kasir menciutkan sidebar (Data Master/Stock/Channel/Dashboard/Laporan/Kiosk hilang) sesuai hak akses. |
| **M44w** ✅ | **Halaman login + multi-database**: rute publik **`/login`** (guard `RequireLogin`, sesi per-tab di sessionStorage) — **pilih Database** lalu **pilih User (Persona)** → masuk app; tombol **Keluar** di sidebar. **Multi-database aditif** di `database.ts`: registry slot di localStorage, slot **`main` tetap kunci `main.db`** (data lama utuh), slot lain di `db:<id>`; `listDatabases`/`createDatabase`/`switchDatabase`/`renameDatabase`/`deleteDatabase` (persist per-slot). Tiap DB punya data & setelan **terpisah** (mis. tema berbeda per cabang). Terverifikasi: login→app→keluar→buat DB→switch, tanpa error konsol. |
| **M44v** ✅ | **PIN Kasir per-Persona (buka/tutup)**: tiap **Persona** kini punya **PIN angka (4–6 digit)** + toggle **"Wajib PIN buka/tutup Kasir"** (Setelan › Persona). Bila aktif, halaman **Kasir dikunci** oleh **`KasirPinGate`** — layar PIN dengan keypad angka (buka Kasir), plus tombol **"🔒 Kunci Kasir"** untuk mengunci lagi (tutup). Aditif & aman: persona tanpa setelan ini tak terpengaruh; validasi PIN di effect (bukan saat render). Field `pin`/`pinKasir` opsional di `Persona` (tanpa migrasi). *(Halaman login + pilih database ditunda: menyentuh entry & DB inti, perlu verifikasi browser.)* |
| **M44u** ✅ | **Sample data produk diperbanyak + gambar**: seed produk dari **9 → 38 produk** di **5 kategori** (Makanan, Minuman, Snack, **Kopi**, **Dessert**). Tiap produk kini punya **gambar** — SVG **data-URI mandiri** (gradien per-kategori + emoji + nama), **offline-friendly** (tanpa file/CDN), disimpan di `products.image_path` + `images`. SKU per-kategori (MKN/MNM/SNK/KOP/DST-###) & barcode unik. Berlaku pada DB baru / setelah **Reset** (Koneksi Database). |
| **M44t** ✅ | **Peran & Hak Akses: lengkapi daftar izin**: menambah izin **`dashboard`** (Dashboard, dulu menumpang `reports`) & **`kiosk`** (grup Kiosk yang tadinya tak dapat di-gate) ke `PERMISSIONS` → total 16 izin; grup **Kiosk** kini `perm: 'kiosk'` dan link **Dashboard** `perm: 'dashboard'` di sidebar. **Migrasi aman** (`loadRoles`): peran yang memiliki semua izin lama otomatis diberi `dashboard`+`kiosk` sehingga peran **Pemilik/Manajer** tersimpan tak kehilangan menu. Peran terbatas (Kasir/Dapur) tak otomatis dapat izin baru. Checkbox baru muncul otomatis di halaman Peran & Hak Akses. |
| **M44s** ✅ | **Perbaiki warna snackbar/toast di mode gelap**: toast & elemen `bg-ink` sebelumnya pakai `text-white` — di tema gelap (Oniks/Safir/Zamrud) `ink` = **terang** sehingga putih-di-atas-terang **tak terbaca**. Diganti **`text-panel`** (36 titik di 35 file): di tema terang `panel`=putih → teks tetap putih (tak berubah); di tema gelap `panel`=gelap → teks gelap di atas pil terang (terbaca). |
| **M44r** ✅ | **Safir & Zamrud jadi tema gelap**: **Safir** → **biru gelap** (latar `#0C1B33`, permukaan `#132741`) & **Zamrud** → **hijau gelap** (latar `#0B211A`, permukaan `#123227`), teks terang + aksen `brand-strong` (blue-600 / emerald-700, kontras teks putih ≥4.5:1). Pakai mekanisme dark-mode yang sama seperti Oniks: override `--c-panel`/`--c-border` via `:root[data-theme="safir"|"zamrud"]` di `index.css` agar kartu/header/modal/garis ikut gelap. |
| **M44q** ✅ | **Halaman konfigurasi & laporan pakai sistem tombol ui-ux-pro-max**: **Pengaturan** (Simpan Perubahan→primary, +Metode/Hapus, input/select→field-*), **Desain Struk** (Simpan→primary, Baru→secondary, Duplikat→ghost, Hapus→danger-outline, form→field-*), **Desain Kartu** (Simpan→primary), **Tema** (Simpan Tema Kustom→primary, Muat/Pratinjau→ghost), **Channel** (Hubungkan/Sinkron→primary, Hapus→danger), **Dashboard** (Atur Widget→ghost, dialog konfirmasi), **Laporan** (export CSV/JSON→ghost, Cetak→primary, Simpan Template/Terapkan→primary, dialog filter→field-*). Toggle modul, kartu tema, swatch, tab periode/kolom, status pill, file/color input **dibiarkan**. Tanpa perubahan logika; `tsc`/build lolos. |
| **M44p** ✅ | **Tata Letak Meja, Riwayat, Jadwal, Koneksi DB, Antrean pakai sistem tombol**: **Tata Letak Meja** (+Meja, Kelola Ruangan, Buka Pesanan, Kosongkan, Hapus Meja=danger-outline, modal rename/delete, Ruangan→field-select), **Riwayat** (Refund→danger-outline, alasan→field-input) & **Struk** (Cetak→primary), **Jadwal Operasi** (Simpan/+Shift, remove-shift→danger), **Koneksi Database** (Simpan/Unduh→primary, VACUUM/Pulihkan/Persisten→ghost, Reset→danger-outline, input→field-input/label), **Antrean** (Take Away→primary, Panggil Ulang→ghost). Tombol berwarna-status semantik (Dapur, "Minta Tagihan", "Siap"), toggle, list-row, drag-card, `✕`, time-input dibiarkan. Tanpa perubahan logika; `tsc`/build lolos. |
| **M44o** ✅ | **Grup Stock & modal POS pakai sistem tombol ui-ux-pro-max**: **Stok Masuk** (10 tombol: +Item, Simpan, +Supplier, Edit/Hapus, detail Edit(secondary)/Hapus(danger-outline)), **Stock Opname** & **Saldo Awal** (CTA Simpan→primary), dan CTA konfirmasi modal **Pembayaran** ("Selesaikan Pembayaran"), **Split Bill** ("Buat N Nota"), **Merge Bill** ("Gabungkan") → `<Button>`. Chip metode/nominal, toggle item, list-row draft/bill, stepper, `✕` close, `<select>`, & input berlayout khusus **dibiarkan**. Kartu Stock & Buka Draft tanpa tombol aksi standar. Tanpa perubahan logika; `tsc`/build lolos. |
| **M44n** ✅ | **Seragamkan textbox & combobox ke tema**: base-layer global untuk `input`/`textarea`/`select` — **latar `--c-panel`, teks `--c-ink`, placeholder `--c-ink-soft`, & daftar `<option>`** mengikuti token tema di **semua tema** (mode gelap termasuk), jadi tiap textbox/combobox konsisten tanpa menyunting per-file. Hanya properti warna (padding/lebar/ikon per-elemen tetap). Ditambah kelas `.field-select` (senada `.field-input`) untuk pemakaian eksplisit. |
| **M44m** ✅ | **Grup Transaksi & Loyalitas pakai sistem tombol ui-ux-pro-max**: 8 halaman — Member, Voucher, Persona, Peran & Hak Akses, Saldo Kas, Cicilan, Draft, Pre-Order — dimigrasikan ke `<Button>` + `field-input`/`field-label` (termasuk tombol di dalam modal). Aksi utama→primary adaptif-tema, Edit→quiet, Hapus→danger/danger-outline, Batal→ghost. Tab/pill/toggle, list-row selector, `<select>`, checkbox dibiarkan. Tanpa perubahan logika; `tsc`/build lolos. |
| **M44l** ✅ | **Grup Data Master pakai sistem tombol/CRUD ui-ux-pro-max**: 8 halaman CRUD **Data Master** — Produk, Kategori, Contact, Outlet, Kasir, Master Meja, Gudang, Pajak — dimigrasikan ke komponen `<Button>` (primary/ghost/quiet/danger) + kelas `field-input`/`field-label`. Aksi utama kini pakai **aksen tema adaptif**, Edit/Hapus konsisten (quiet/danger), form seragam. Tab/pill/toggle, `<select>`, checkbox, & thumbnail dibiarkan (bukan tombol aksi). Tanpa perubahan logika; `tsc`/build lolos; terverifikasi (Produk & Pajak) tanpa error konsol. |
| **M44k** ✅ | **Sistem komponen tombol/CRUD ui-ux-pro-max + referensi Units**: `@layer components` di `index.css` — `.btn` + varian (**primary/secondary/ghost/quiet/danger/danger-outline**) + ukuran (sm/icon) + `.field-input`/`.field-label`. Target sentuh ≥44px, radius/bobot konsisten, warna dari **token tema** (CTA = `brand-strong` **adaptif tema**; `status-occupied` khusus destruktif). Komponen `<Button variant size>` (`src/components/ui/Button.tsx`). Modul **Units** dimigrasikan penuh sebagai referensi. |
| **M44j** ✅ | **Standarisasi interaksi tombol (ui-ux-pro-max)**: baseline global `@layer base` untuk **setiap `<button>`** — **transisi mikro ~150ms** (easing standar) pada warna/bg/border/opacity/shadow/transform + **umpan-balik tekan** `active:scale(0.97)` (tanpa menggeser layout sekitar), sesuai standar *Active States* (`active:scale-95`) & *Animation timing 150–300ms* skill. Melengkapi `cursor-pointer`, `:focus-visible`, touch-target ≥44px yang sudah ada — jadi seluruh tombol punya perilaku hover/press/fokus/disabled konsisten. Reduced-motion tetap dihormati. |
| **M44i** ✅ | **Objek desain konsisten di semua tema (border themeable)**: seluruh garis/divider hardcoded `border-black/*` & `divide-black/*` (210 pemakaian di 48 file) + track `bg-black/10` diganti token tema **`line`** (`--c-border`). Default hitam → **tema terang tak berubah**; ditimpa **putih** untuk Oniks (`:root[data-theme="oniks"]`) sehingga garis/divider **terlihat di mode gelap** (sesuai checklist "border visible in both themes" ui-ux-pro-max). Scrim modal `bg-black/40` tetap. |
| **M44h** ✅ | **Tema bawaan diselaraskan ke standar ui-ux-pro-max**: seluruh 9 tema di-repalette mengikuti `colors.csv` skill — **brand-strong = Primary** (kontras teks putih ≥4.5:1), **background/ink** dari Background/Foreground bernuansa hue, **ink-soft = Muted Foreground `#64748B`** seragam, **brand/brand-soft** = tint terang (200/100). Klasik jadi **krem-emas** (beda dari Anggur), Oniks memakai **slate-dark** standar (surface `#1B2336`). `src/lib/themes.ts` + override panel Oniks di `index.css`. |
| **M44g** ✅ | **Penerapan skill ui-ux-pro-max**: audit & perbaikan UX berbasis skill *ui-ux-pro-max*. **(1) Fondasi a11y global** (`index.css`): ring `:focus-visible`, `cursor-pointer`/`not-allowed`, `prefers-reduced-motion`. **(2) Typografi retail**: heading **Rubik** + body **Nunito Sans**, self-hosted via `@fontsource-variable` (offline-friendly). **(3) Ikon navigasi** emoji → **Lucide SVG** (themeable, konsisten; ~40 ikon sidebar + chevron). **(4) Touch target ≥44px** pada kontrol qty (Kasir & Kiosk). **(5) Mode gelap sejati (Oniks)**: token baru `--c-panel` (default putih → tema terang tak berubah), 200 `bg-white`→`bg-panel` di 53 file, `root[data-theme]` + override `:root[data-theme="oniks"]`, Oniks di-repalette gelap. |
| **M44f** ✅ | **Tata Letak Meja: Kelola Ruangan**: modal **⚙ Kelola Ruangan** (mode Atur Layout) untuk mengelola ruangan, bukan hanya lewat data meja — tiap ruangan menampilkan **jumlah meja**, tombol **✎ Ganti nama** (memindah semua mejanya ke nama baru; bila sama dengan ruangan lain otomatis **tergabung**), dan **🗑 Hapus** (konfirmasi inline "Hapus 'X' beserta N meja?" — ikut menghapus meja di dalamnya). `renameSection`/`deleteSection` di repo; `activeSection` & meja terpilih ikut disesuaikan setelah aksi. Melengkapi M44d. |
| **M44e** ✅ | **Tema: 3 tema bawaan berkarakter kuat**: menambah 3 tema di **Setelan › Tema** dengan karakter lebih *strong* — **Oniks** (hitam tegas, monokrom aksen near-black), **Safir** (biru tegas & dalam), **Zamrud** (hijau tegas & pekat). Aksen/`ink` lebih pekat dari tema pastel yang ada (Laut/Hutan). Ditambah ke registri `THEMES` di `src/lib/themes.ts`; kartu pemilih tema otomatis menampilkannya. Total tema bawaan kini 9. |
| **M44d** ✅ | **Tata Letak Meja: pilih ruangan**: baris **Ruangan** di header dengan pil **Semua + tiap ruangan** (`section_name`, mis. INDOOR/OUTDOOR/VIP) untuk **menyaring denah** per ruangan; legenda hitung status ikut ruangan terpilih. Saat **Atur Layout**: tombol **+ Ruangan** (buat ruangan baru), **+ Tambah Meja** masuk ke ruangan aktif, dan panel detail meja punya **dropdown Ruangan** untuk memindah meja antar-ruangan (`updateTableSection`). Tiap ruangan jadi denah tersendiri (posisi meja per ruangan). |
| **M44c** ✅ | **Kasir: nomor urut item + perbaikan warning**: tiap baris item di keranjang kini diberi **nomor urut** (badge bulat 1, 2, 3…) sebelum nama produk, otomatis **berurut ulang** saat item dihapus. Sekalian memperbaiki warning React *"Cannot update a component while rendering"* pada kolom kuantitas (M44b): `props.onQuantityChange` dulu dipanggil **di dalam updater `setQtyEdits`** (dieksekusi saat render) — kini dipindah ke event handler `onBlur` sehingga tak ada setState lintas-komponen saat render. |
| **M44b** ✅ | **Kasir: kuantitas item bisa diketik**: angka jumlah item di keranjang kini **kolom input** (bukan sekadar teks di antara tombol −/+) — kasir bisa **mengetik jumlah langsung** (mis. 12) selain menekan −/+. Fokus otomatis menyeleksi angka; input hanya menerima digit. Buffer teks per item membuat kolom boleh **kosong sementara** saat diketik tanpa langsung menghapus item; saat blur, nilai kosong/0 dikembalikan ke **1** (hapus item tetap lewat tombol ✕). |
| **M44a** ✅ | **Kasir: kode voucher pindah ke menu opsi (bareng Split Bill)**: kolom **Kode Voucher** yang dulu berdiri sendiri di panel keranjang kini dipindah **ke dalam menu "⋮"** di dekat tombol Bayar — **satu tempat** dengan Buka Draft, Simpan Bill (Draft), & **Split Bill**. Input + tombol Pakai (Enter juga bisa), status "diterapkan/Hapus", & pesan validasi tetap lengkap; saat voucher aktif muncul **titik hijau** di tombol "⋮" (terlihat walau menu tertutup) selain baris **Diskon** di ringkasan. Menu "⋮" kini tampil juga saat pre-order agar voucher tetap dapat dipakai. |
| **M44** ✅ | **Kasir: kolom pelanggan & member disatukan**: kolom **"Pelanggan Umum"** dan **"No. HP / nama member"** yang dulu terpisah kini menjadi **satu kolom** di panel kasir. Ketik nama / No. HP → **dropdown member langsung** muncul (disaring dari daftar member); pilih salah satu untuk **melekatkan loyalitas** (badge "★ Member · N poin" + Lepas). Bila tak ada member cocok, teks tetap dipakai sebagai **Pelanggan Umum** (tanpa error). Tombol **✕** mengosongkan (kembali ke Pelanggan Umum), ikon berubah **👤 → ★** saat member aktif, Enter mencari member persis. Satu sumber kebenaran: `customerName` menggerakkan dropdown, `onSelectCustomer` mengisi nama + member sekaligus. |
| **M43z** ✅ | **Kiosk (mode layar mandiri)**: grup nav baru **Kiosk** (🖥️) berisi 3 layar swalayan + tombol **Layar Penuh** di tiap layar. **(1) Kiosk Informasi** (📢) — *digital signage*: header logo/outlet/tagline + jam langsung & badge **Buka/Tutup** (dari `scheduleConfig`), **Direktori** kategori (jumlah produk, warna) + kartu Lokasi, & **Promosi** (voucher aktif). **(2) Kiosk Pemesanan & Pembayaran** (🛒) — swalayan: pilih kategori → grid menu (ketuk = tambah), keranjang (Dine-in/Bawa Pulang, qty, service/pajak), **Bayar** via `PaymentModal` (QRIS/kartu/tunai) → `saveOrder({orderSource:'SELF_ORDER', status:'COMPLETED', sendToKitchen:true})` + **nomor antrean** di layar sukses. **(3) Kiosk Antrian / Check-in** (🎫) — ambil nomor antrean mandiri: 3 tombol layanan (Makan di Tempat/Bawa Pulang/Antar) → `issueQueue()` → nomor besar + footer "Sedang dipanggil" (realtime `queue:update`). `kioskRepository.ts` (`listPromos`/`nextQueueNumber`/`nowServing`) + `FullscreenButton.tsx`; rute `/kiosk-info`·`/kiosk-order`·`/kiosk-queue`. |
| **M43y** ✅ | **Dashboard lengkap + atur widget**: Dashboard kini menampilkan **widget lintas modul** — KPI penjualan, Status Toko (jadwal/shift), Saldo Kas, Member & Loyalitas, Stok & Inventaris, Voucher, Refund/Pre-Order/Cicilan, Operasional (meja/antrean/dapur, F&B), grafik Penjualan per Sumber/Produk Terlaris/Metode Pembayaran, & Transaksi Terkini. Dialog **⚙ Atur Widget** untuk **show/hide** tiap widget (disimpan `app_settings.dashboard_widgets`); widget periode ikut filter tanggal, widget F&B ikut toggle modul. `dashboardData.ts` + `dashboardConfig.ts`. |
| **M43x** ✅ | **Filter laporan**: setiap laporan punya **dialog Filter** — **rentang tanggal** (Semua/Hari Ini/Minggu/Bulan/Bulan Lalu/Tahun/Tahun Lalu/Kustom, untuk laporan berkolom tanggal) + **pencarian kata kunci** lintas kolom. Hasil filter langsung memengaruhi pratinjau, hitungan baris, **serta unduhan & cetak**. Indikator "aktif" di tombol; reset otomatis saat ganti laporan. Util `applyReportFilter()` di `reportOutput.ts`. |
| **M43w** ✅ | **Pusat Laporan (Laporan)**: menu Laporan jadi **hub** dengan **sub-menu laporan lintas modul** (Penjualan, Produk & Stok, Pelanggan & Loyalitas, Keuangan, Master — ~18 laporan). Tiap laporan bisa **diunduh** (CSV, JSON, **Cetak/PDF**), punya **editor template** (judul, sub-judul, catatan kaki, **tampil/sembunyi kolom**) dan **opsi ukuran kertas** (A4/Letter/Legal/F4) + orientasi (potret/lanskap). Registry `reportDefs.ts` + util `reportOutput.ts`; template tersimpan per-laporan di `app_settings`. |
| **M43v** ✅ | **Saldo Kas: edit/hapus entri terakhir, timestamp, konfirmasi**: entri **riwayat kas terakhir** bisa **Edit** (modal — koreksi shift/saldo/waktu, ekspektasi & selisih dihitung ulang) atau **Hapus** (konfirmasi). Form **Buka Kas** kini punya **Waktu Buka** & form **Tutup Kas** punya **Waktu Tutup** (datetime-local; dikonversi ke UTC agar seragam dengan `transaction_date`). **Tutup Kas** memunculkan **dialog konfirmasi** berisi ringkasan saldo fisik/ekspektasi/selisih. |
| **M43u** ✅ | **Saldo Kas: otoritas buka riwayat**: **Riwayat Kas** kini disembunyikan di balik tombol **“Buka Riwayat Kas”** dan digerbang izin baru **`cash_history`** (Peran & Hak Akses). Persona tanpa izin melihat pesan **“Perlu otoritas”** (tetap bisa buka/tutup kas). Bawaan: Pemilik/Manajer punya izin; Kasir tidak. |
| **M43t** ✅ | **Saldo Kas (Transaksi)**: **Transaksi › Saldo Kas** — buka kas (catat **saldo awal**/modal) & tutup kas (**saldo fisik**) per **toko** atau **per shift** (bila shift aktif). Sistem menghitung **penjualan tunai** selama sesi (pembayaran CASH transaksi COMPLETED), **ekspektasi kas** (= saldo awal + tunai), dan **selisih** (fisik − ekspektasi). Tabel baru `cash_sessions` (ke-29, migrasi otomatis) + riwayat sesi. |
| **M43s** ✅ | **Jadwal Operasi (Setelan)**: menu baru **Setelan › Jadwal Operasi** (🕒) — atur **jam buka/tutup per hari** (Senin–Minggu, dukung lewat tengah malam) + opsi **Gunakan shift** (daftar shift bernama dengan jam mulai–selesai). Badge status langsung **Buka/Tutup sekarang** + shift berjalan. Disimpan di `app_settings.schedule_*` via `scheduleConfig.ts` (`getScheduleConfig`/`isOpenNow`/`currentShift`). |
| **M43r** ✅ | **Desain Struk: banyak template**: bisa buat **lebih dari 1 template** desain struk (Baru / Duplikat / Ganti nama / Hapus) dengan **1 template aktif** yang dipakai saat mencetak. Pratinjau mengikuti template terpilih. Disimpan sebagai JSON di `app_settings.receipt_templates` + `receipt_active_template`; konfigurasi lama otomatis dimigrasikan jadi template "Struk Default". `getReceiptConfig()` mengembalikan template aktif (fallback ke kunci `receipt_*` lama). |
| **M43q** ✅ | **Desain Struk: situs & marketplace**: bagian **Situs & Marketplace** di Desain Struk — isian **Website, Shopee, TikTok, Tokopedia** (kosong = sembunyi). Yang terisi muncul di bagian bawah struk (layar & cetak) via helper `receiptSocials()`, disimpan `app_settings.receipt_website/shopee/tiktok/tokopedia`. |
| **M43p** ✅ | **Service Charge (biaya layanan)**: opsi di Pengaturan › Transaksi (aktif + tarif %). Dihitung dari subtotal setelah diskon; **pajak dihitung di atas subtotal + service charge** (model PB1 F&B). Terintegrasi ke kasir (baris "Service (x%)" + total), split/merge bill, tersimpan di kolom baru `transactions.service_charge_amount` (migrasi otomatis), dan tampil di **struk** (layar, cetak, & tautan kirim). |
| **M43o** ✅ | **Pengaturan: pisah Transaksi & Loyalitas + poin lebih lengkap**: seksi lama "Transaksi & Loyalitas" dipecah jadi **Transaksi** (pajak) dan **Program Loyalitas (Poin)**. Konfigurasi poin kini lengkap: aktif/nonaktif, Rp per poin, **dasar hitung** (total/subtotal), **pembulatan** (floor/round), **min. transaksi**, **maks. poin/transaksi**, dan **pengali per tier** (Silver/Gold/Platinum/Diamond) + contoh perhitungan langsung. Ditopang `src/lib/loyalty.ts` (`getLoyaltyConfig`/`computePoints`); dipakai di `saveOrder` (kasir, ambil tier member) & `settlePreorder`. |
| **M43n** ✅ | **Kirim Link struk & member**: tombol **🔗 Kirim Link** di modal Struk (Riwayat) & detail Member — berbagi via **WhatsApp / Email / Salin / Bagikan (native)**. Tautan **mandiri (self-contained)**: data di-encode ke fragmen URL (`shareLink.ts`, base64url), dibuka lewat halaman publik `/#/share/receipt/:payload` & `/#/share/member/:payload` (tanpa server — cocok local-first). Struk publik memakai `ReceiptView`, kartu member memakai `MemberCard` (gaya bawaan). Komponen bersama `ShareLinkPanel` (prefill No. WA member). |
| **M43m** ✅ | **Nav: grup "Loyalitas Pelanggan"**: grup baru (🎁) berisi **Member** & **Voucher** yang dipindah dari tautan tingkat atas, ditempatkan setelah Transaksi. Tiap anak tetap di-gate `perm` (members/vouchers); grup tersembunyi bila tak ada anak yang tampil. |
| **M43l** ✅ | **Nav: Dapur masuk grup Transaksi**: menu **Dapur** (KDS) dipindah dari tautan tingkat atas ke grup **Transaksi** (setelah Cicilan, sebelum Meja). Tetap di-gate `moduleKey: module_kds` + `perm: kds`. Grup Transaksi kini memuat: Riwayat, Draft, Pre-Order, Cicilan, Dapur, Meja, Antrean. |
| **M43k** ✅ | **Nav: Meja & Antrean masuk grup Transaksi**: menu **Meja** & **Antrean** dipindah dari tautan tingkat atas ke dalam grup **Transaksi** (setelah Riwayat/Draft/Pre-Order/Cicilan). Sub-menu `NavGroup` kini menghormati `moduleKey` (toggle modul) & `perm` (hak akses) per anak — jadi keduanya tetap tersembunyi bila modul dimatikan / persona tak berhak; grup kosong otomatis disembunyikan. |
| **M43j** ✅ | **Filter tanggal Dashboard**: pemilih **Periode** di header Dashboard — Hari Ini, Minggu Ini, Bulan Ini, Bulan Lalu, Tahun Ini, Tahun Lalu, & **Kustom (dari–sampai)** dengan dua input tanggal. Rentang dihitung di klien (`dateRange.ts` · `computeRange`) lalu difilter `date(transaction_date) BETWEEN from AND to` di `salesSummary`/`salesBySource`/`topProducts`. Label rentang aktif tampil di header; KPI/grafik ikut menyesuaikan realtime. |
| **M43i** ✅ | **Pengaturan Database Lokal (Koneksi Database)**: bagian baru di halaman Koneksi Database — **Label Database** (identitas perangkat, `app_settings.db_label`, dipakai pada nama file cadangan), **Persistensi Penyimpanan** (status persisted + estimasi kuota terpakai via `navigator.storage.estimate()` + tombol `persist()` agar DB tak dibersihkan peramban), dan **Kompakkan Database (VACUUM)** (`vacuumDatabase()` — merapikan ruang kosong, tampilkan hemat ukuran). |
| **M43h** ✅ | **Koneksi Database (Setelan)**: halaman **Setelan › Koneksi Database** menampilkan **status DB lokal** (mesin SQLite/sql.js, penyimpanan IndexedDB, ukuran, jumlah tabel, versi SQLite), pengaturan **Relay LAN** (aktif/nonaktif + host + port, status koneksi langsung, "Simpan & Sambungkan Ulang" — relay kini dapat dikonfigurasi via `localStorage`), serta **Cadangan & Pemulihan** (unduh snapshot `.sqlite`, pulihkan dari file dengan validasi header, reset ke data awal). Ditopang `exportDatabase`/`importDatabase`/`resetDatabase`/`databaseStats` di `database.ts` & `getRelayConfig`/`setRelayConfig`/`reconnectRelay` di `realtime.ts`. |
| **M43g** ✅ | **Metode Pembayaran (Pengaturan)**: bagian **Metode Pembayaran** di Pengaturan — **aktif/nonaktifkan** metode bawaan (Tunai, QRIS, Debit, Kredit, Voucher) & **tambah metode kustom** (mis. GoPay, OVO, Transfer BCA) dengan ikon + nama. Modal bayar (kasir & pelunasan pre-order) hanya menampilkan metode aktif via `enabledPaymentMethods()`; metode kustom bersifat generik (cukup nominal) dan namanya tampil apa adanya di struk & riwayat. Disimpan JSON di `app_settings.payment_methods`. |
| **M43f** ✅ | **Struk: catatan item & satuan**: baris item pada struk (layar & cetak) kini menampilkan **catatan khusus item** (✎) dan **satuan** terpilih (mis. "1 dus Air Mineral · @ Rp 100.000 / dus"), keduanya bisa di-*toggle* di **Desain Struk › Tampilkan** (default on). Pratinjau contoh diperbarui memuat item bercatatan & bersatuan. Data dari `transaction_details.unit/unit_qty` + satuan dasar produk. |
| **M43e** ✅ | **Pilih satuan di item transaksi**: item pada **Kasir**, **Saldo Awal**, **Stok Masuk**, & **Stock Opname** kini punya **pemilih satuan** (muncul bila produk punya satuan turunan). Di Kasir harga & stok ikut satuan terpilih — harga = harga khusus satuan (mis. 1 dus = Rp 100.000), stok dipotong dalam **satuan dasar** (1 dus = 24 botol). `transaction_details` menyimpan `quantity` dalam satuan dasar + kolom baru `unit`/`unit_qty` (tampilan), `unit_price` per satuan dasar (stok/refund/laporan tetap konsisten). Modul stok mengonversi input × faktor → satuan dasar di level halaman (repo tak berubah). Helper bersama `buildUnitOptions()`. |
| **M43d** ✅ | **Produk multi-satuan & konversi**: form Produk kini punya bagian **Satuan Turunan & Konversi** — selain satuan dasar (`unit`), tambah satuan lain + **jumlah setaranya** (mis. 1 dus = 24 botol) + **harga jual opsional** per satuan. Disimpan sebagai JSON di kolom baru `products.unit_conversions` (migrasi otomatis); parse/validasi via `parseUnitConversions`/`cleanConversions` (baris tak valid dibuang). |
| **M43c** ✅ | **Produk multi-gambar**: form Produk kini bisa **unggah beberapa gambar** (galeri thumbnail: hapus per gambar, set "Utama"). Disimpan sebagai JSON di kolom baru `products.images` (migrasi otomatis); gambar pertama = **Utama**, dicermin ke `image_path` untuk kartu produk/kasir/tabel (kompatibel mundur). |
| **M43b** ✅ | **Kartu Stock — pencarian barcode/QR**: kolom scan di Kartu Stock; scan/ketik barcode atau SKU + Enter → produk otomatis terpilih (via `findProductByCode`), atau notifikasi "tidak ditemukan". |
| **M43** ✅ | **Gudang (Warehouse) — stok per gudang**: **Data Master › Gudang** (CRUD gudang per outlet + gudang **default**). Tabel `warehouses` (28) + kolom `warehouse_id` pada `outlet_stocks` (stok kini per outlet+gudang; migrasi otomatis me-rebuild & memetakan stok lama ke gudang default) serta pada header `stock_entries`/`stock_opnames`. **Kasir** memotong/mengembalikan stok dari **gudang default** (pre-order/refund idem); tampilan stok = **jumlah lintas gudang**. Seluruh fitur stok (Stok Masuk, Saldo Awal, Stock Opname, Kartu Stock) kini punya **pemilih gudang**. |

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
| `#/warehouses` | Data Master › Gudang (CRUD gudang per outlet) |
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
| `#/stockin` | Stock › Stok Masuk & Supplier |
| `#/stock-opname` | Stock › Stock Opname (hitung stok fisik + scan barcode) |
| `#/stock-opening` | Stock › Saldo Awal (setel stok pembuka/baseline) |
| `#/stock-card` | Stock › Kartu Stock (kardex mutasi stok per produk) |
| `#/history` | Transaksi › Riwayat & Refund |
| `#/drafts` | Transaksi › Draft (bill tersimpan) |
| `#/preorder` | Transaksi › Pre-Order & Uang Muka |
| `#/installments` | Transaksi › Cicilan Internal |
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
