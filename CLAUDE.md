# CLAUDE.md

Panduan untuk Claude Code (dan developer) saat bekerja di repo **POSMerahPutih** —
aplikasi Point of Sale local-first untuk UMKM retail & F&B.

## Perintah

```bash
npm install            # instal dependensi
npm run dev            # dev server Vite (http://localhost:5173)
npm run build          # tsc -b && vite build (WAJIB lolos sebelum commit)
npm run preview        # serve hasil build (dipakai untuk verifikasi browser)
npm run relay          # relay WebSocket LAN (ws://0.0.0.0:7071) — opsional
```

Belum ada test runner. **Verifikasi = `npm run build` lolos + jalankan `npm run preview`
lalu uji alur di browser.** Tidak ada linter yang di-wire selain `tsc` (strict).

## Arsitektur (gambaran besar)

- **Local-first, tanpa backend.** Seluruh data hidup di **SQLite di browser** via
  `sql.js` (WASM di-bundle lokal, bukan CDN). Snapshot database dipersist ke
  **IndexedDB** (`posmerahputih`) setiap operasi tulis.
- **React (Vite) + TypeScript + Tailwind CSS.** Hash router (`createHashRouter`)
  agar berfungsi juga di wrapper native (Tauri/Capacitor).
- **Real-time lokal**: `src/lib/realtime.ts` — berlapis
  `local listeners → BroadcastChannel → WebSocket relay LAN`. Idempoten.
- **Offline-first**: `src/lib/syncQueue.ts` — outbox operasi eksternal (sinkron
  marketplace), auto-flush saat `online`.

### Alur data (pola repository)

UI **tidak** memanggil SQL langsung. Setiap fitur punya `*Repository.ts` yang
membungkus akses DB lewat helper di `src/db/database.ts`:

- `query<T>(sql, params)` — SELECT, kembalikan array objek bertipe.
- `execute(sql, params)` — satu statement tulis + `persist()`, kembalikan lastInsertRowid.
- `getDb()` + `db.run('BEGIN'/'COMMIT'/'ROLLBACK')` — untuk operasi multi-statement.

**Konvensi penting untuk operasi tulis kompleks** (mis. `saveOrder`, `processRefund`,
`settlePreorder`, `createStockEntry`, `createPlan`): bungkus semua `db.run` dalam
**satu transaksi SQL** (`BEGIN`…`COMMIT`/`ROLLBACK`), panggil `persist()` **sekali**
di akhir, lalu `publish('...')` event realtime yang relevan.

## Peta direktori

```
src/
  db/
    schema.sql          # 22 tabel (sumber kebenaran skema)
    database.ts         # init sql.js + IndexedDB persist + query/execute
    seed.ts             # data awal (outlet, kategori, produk, meja, app_settings)
  lib/
    realtime.ts         # bus event (local + BroadcastChannel + WS relay)
    syncQueue.ts        # outbox offline-first
    settings.ts         # loadSettings / getNumberSetting / isModuleEnabled
    SettingsContext.tsx # provider app_settings + reloadSettings()
    useConnection.ts    # status online/relay/antrean
    format.ts           # formatRupiah, generateInvoiceNumber (suffix -NN unik)
    tts.ts              # panggilan suara antrean (Web Speech API)
  components/AppShell.tsx  # sidebar nav (di-gate app_settings) + ConnectionBadge
  features/<modul>/        # tiap modul: *Repository.ts + *Page.tsx (+ modal/komponen)
server/relay.mjs           # relay WebSocket LAN tanpa dependensi
src-tauri/                 # konfigurasi desktop (Tauri v2)
capacitor.config.ts        # konfigurasi mobile (Capacitor)
```

Modul di `src/features/`: `pos`, `tables`, `kds`, `queue`, `selforder`, `vouchers`,
`marketplace`, `members`, `reports`, `stockin`, `history` (refund), `preorder`,
`installments`, `settings`.

## Menambah rute/modul baru

1. Buat `src/features/<modul>/<Modul>Repository.ts` + `<Modul>Page.tsx`.
2. Daftarkan route di `src/App.tsx` (child dari `AppShell`, atau top-level untuk
   layar publik seperti `/monitor`, `/order/:tableNumber`).
3. Tambah entri nav di `src/components/AppShell.tsx` (`NAV`). Beri `moduleKey`
   bila ingin di-gate oleh toggle di Pengaturan.

## Konvensi & gotcha (penting)

- **`generateInvoiceNumber` presisi detik + suffix urut `-NN`.** Jangan hapus
  suffix: beberapa penyimpanan dalam 1 detik (mis. Split Bill) akan bentrok di
  `UNIQUE invoice_number` tanpa itu.
- **BroadcastChannel tidak mengirim balik ke pengirimnya.** Karena itu `publish()`
  di `realtime.ts` juga men-deliver ke listener lokal. Halaman yang memicu
  perubahan **harus** ikut tersegar dari sini — jangan bergantung hanya pada BC.
- **IndexedDB ter-scope per origin termasuk PORT.** Saat verifikasi dengan
  `npm run preview` di port berbeda, database mulai kosong (seed ulang) — ini
  ekspektasi, bukan bug.
- **Skema 22 tabel bersifat tetap** (acuan PRD v1.5). Fitur baru sedapat mungkin
  memanfaatkan kolom yang ada (mis. `parent_transaction_id`, `is_preorder`,
  `transaction_payments.voucher_id`) alih-alih menambah tabel.
- **Status transaksi**: `DRAFT` (bill tersimpan) · `PREPARING` (pre-order/antre
  aktif) · `READY` (siap) · `COMPLETED` (lunas) · `REFUNDED`. Laporan/dashboard
  hanya menghitung `COMPLETED`.
- **Stok**: dipotong saat `COMPLETED` (atau saat pelunasan pre-order), dikembalikan
  saat refund. Draft/pre-order belum memotong stok.
- **Poin loyalitas**: hanya untuk transaksi `COMPLETED` bermember; audit di
  `point_logs`; refund menariknya kembali (`REFUND_DEDUCTION`).

## Palet & UI

Warna brand didefinisikan di `tailwind.config.js` (`brand`, `background`, `surface`,
`ink`, `status.{empty,occupied,waiting}`). Setiap halaman mengikuti pola: header
`bg-white/70`, kartu `rounded-card bg-white shadow-card`, toast fixed di bawah-tengah.

## Native (butuh toolchain lokal)

Konfigurasi sudah ada; kompilasi butuh Rust (Tauri) atau Android SDK/Xcode (Capacitor):

```bash
npm i -D @tauri-apps/cli && npm run tauri:build      # desktop
npm i -D @capacitor/cli && npx cap add android && npm run cap:sync   # mobile
```

## Status

Seluruh spesifikasi fungsional PRD v1.5 (M1–M11) telah diimplementasikan &
diverifikasi di browser. Lihat tabel milestone & daftar rute di `README.md`.
Yang tersisa bersifat integrasi eksternal: adapter API marketplace nyata (butuh
kredensial) dan kompilasi native (butuh toolchain).
