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
| **M2** ✅ | Router + shell navigasi, **Canvas Table Layout** (drag-drop, indikator warna, integrasi POS), **Queue** (terbit A/B, monitor TV publik, TTS) |
| **M3** ✅ | Bus real-time lokal (BroadcastChannel), **KDS** (aging timer, check-off item), **Self-Order** (menu QR pelanggan → dapur), **Voucher Generator** massal + diskon voucher di POS, **Marketplace** config scaffold |
| **M4** | Uji offline-first, **relay WebSocket LAN** (menggantikan BroadcastChannel untuk sinkron lintas-perangkat), sinkronisasi marketplace nyata via API, kompilasi Tauri (desktop) & Capacitor (mobile) |

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
| `#/vouchers` | Voucher Generator |
| `#/marketplace` | Integrasi Marketplace (config) |
| `#/monitor` | Monitor antrean publik (Smart TV) |
| `#/order/:tableNumber` | Self-Order pelanggan (QR meja) |

## Catatan teknis

- **Local-first**: engine SQLite dimuat dari `sql.js` (WASM) yang di-_bundle_ lokal,
  bukan CDN — tidak butuh internet untuk operasional dasar.
- Snapshot database disimpan ke IndexedDB setiap operasi tulis (`persist()`).
- Untuk mereset data demo: hapus IndexedDB `posmerahputih` dari DevTools → Application.

---

🤖 Foundation di-scaffold dengan [Claude Code](https://claude.com/claude-code).
