# POSMerahPutih

Aplikasi **Point of Sale (POS)** modern & _local-first_ untuk UMKM retail dan F&B.
Berjalan 100% offline menggunakan database **SQLite** di browser (sql.js), dengan
roadmap menuju omnichannel marketplace, KDS, Table Layout, Self-Order, dan wrapper
native (Tauri / Capacitor).

> Versi PRD acuan: **1.5** · Stack: **React (Vite) + SQLite (local-first) + Tailwind CSS**

## Fitur pada foundation ini (Milestone 1)

- ⚙️ Inisialisasi database SQLite lokal dengan **22 tabel** (lihat `src/db/schema.sql`),
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
  db/            # schema.sql (22 tabel), database.ts (sql.js + IndexedDB), seed.ts
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
| `#/reports` | Dashboard & Laporan (+ Ekspor CSV) |
| `#/settings` | Setelan › Pengaturan (outlet, pajak, poin, modul) |
| `#/personas` | Setelan › Persona (pengguna aplikasi) |
| `#/roles` | Setelan › Peran & Hak Akses |
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
