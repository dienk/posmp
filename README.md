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

## Roadmap (mengikuti Milestone PRD)

| Milestone | Cakupan |
|-----------|---------|
| **M1** ✅ | Init proyek, SQLite 22 tabel, app_settings, layar kasir inti |
| **M2** 🚧 | Router + shell navigasi, **Canvas Table Layout** (drag-drop, indikator warna, integrasi POS), **Queue** (terbit A/B, monitor TV publik, TTS). _Self-Order menyusul._ |
| **M3** | Kitchen Display System (WebSocket), Voucher Generator massal, pembayaran voucher, integrasi marketplace (Shopee/Tokopedia/TikTok) |
| **M4** | Uji offline-first, performa WebSocket lokal, kompilasi Tauri (desktop) & Capacitor (mobile) |

### Rute aplikasi

| Path | Layar |
|------|-------|
| `#/` | Kasir (POS) |
| `#/tables` | Tata Letak Meja |
| `#/queue` | Sistem Antrean (operator) |
| `#/monitor` | Monitor antrean publik (Smart TV) |

## Catatan teknis

- **Local-first**: engine SQLite dimuat dari `sql.js` (WASM) yang di-_bundle_ lokal,
  bukan CDN — tidak butuh internet untuk operasional dasar.
- Snapshot database disimpan ke IndexedDB setiap operasi tulis (`persist()`).
- Untuk mereset data demo: hapus IndexedDB `posmerahputih` dari DevTools → Application.

---

🤖 Foundation di-scaffold dengan [Claude Code](https://claude.com/claude-code).
