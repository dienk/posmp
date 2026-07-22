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
    schema.sql          # 29 tabel (sumber kebenaran skema)
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
`installments`, `settings`, `products`, `contacts`, `outlets`, `cashiers`,
`access`, `theme`, `membercard`, `backup` (cadangan otomatis terjadwal),
`stocktransfer` (transfer stok antar gudang), `approvals` (persetujuan aksi
sensitif), `errors` (halaman error/404 branded).

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
- **Satuan transaksi disimpan dalam satuan DASAR.** Produk bisa punya satuan
  turunan (`products.unit_conversions`). Di kasir/stok, item boleh dipilih satuannya
  (`buildUnitOptions()` di `productsRepository`), tapi `transaction_details.quantity`
  & `outlet_stocks.stock` **selalu** satuan dasar (qty × faktor) agar stok, refund,
  pre-order, laporan, & kartu stok tetap konsisten tanpa perubahan. `transaction_details`
  menyimpan tampilan satuan terpilih di `unit`/`unit_qty`, dan `unit_price` per satuan
  dasar (= subtotal ÷ qty dasar) agar refund/laporan faithful. Modul stok (Saldo Awal,
  Stok Masuk, Opname) mengonversi di level halaman; repo-nya tetap satuan dasar.
- **Koneksi Database (Setelan › Koneksi Database).** DB lokal = SQLite (sql.js)
  di IndexedDB `posmerahputih`. Cadangan/pulihkan/reset lewat `exportDatabase`/
  `importDatabase`/`resetDatabase` (database.ts); pulihkan & reset **memuat ulang
  halaman** (`location.reload`) agar seluruh cache in-memory (SettingsContext, dll)
  ikut segar. **Konfigurasi relay** (`realtime.ts`) disimpan di **localStorage**
  (bukan app_settings) karena `realtime.ts` tersambung saat modul dimuat, sebelum
  DB siap; ubah via `setRelayConfig()` (memicu `reconnectRelay()`).
- **Stok dilacak per gudang.** `outlet_stocks` berkunci `(outlet_id, warehouse_id,
  product_id)`. Tampilan stok produk (kasir/katalog) = **SUM lintas gudang** —
  jangan `LEFT JOIN outlet_stocks` (duplikat baris); pakai subquery SUM. Kasir,
  pre-order, & refund menyentuh **gudang default** outlet (`defaultWarehouseId`).
  Fitur stok (Stok Masuk/Opname/Saldo Awal/Kartu) beroperasi pada gudang terpilih.
- **Tiap tab punya salinan sql.js in-memory sendiri.** `dbInstance` singleton per
  tab dimuat sekali saat boot; tulisan tab lain (yang `persist()` ke IndexedDB)
  **tidak** otomatis terlihat. Tampilan read-only lintas-tab (Monitor TV,
  Self-Order) **harus** panggil `reloadDatabase()` (memuat ulang snapshot dari
  IndexedDB) sebelum query, dipicu event realtime + polling. Pastikan pula mutasi
  memicu `publish(...)` agar tab lain dapat event. Tab penulis tak perlu reload.
- **Skema inti (22 tabel PRD v1.5) bersifat tetap**; penambahan hanya bila fitur
  baru benar-benar butuh (mis. tabel ke-23 `cashiers`). Selain itu, fitur baru
  sedapat mungkin
  memanfaatkan kolom yang ada (mis. `parent_transaction_id`, `is_preorder`,
  `transaction_payments.voucher_id`) alih-alih menambah tabel.
- **Diskon (item & transaksi).** Diaktifkan via toggle `pos_enable_discount`
  (Setelan › Fitur Kasir). **Diskon item** = `CartItem.discount` (Rp) → dilipat ke
  `lineTotal` (`useCart`/`saveOrder`) sehingga masuk ke subtotal & disimpan di
  kolom `transaction_details.discount`; `transactions.subtotal_amount` = subtotal
  **bersih** setelah diskon item. **Diskon transaksi** (Rp/%) = voucher + diskon
  manual, disimpan di `transactions.discount_amount` (dipotong sebelum service &
  pajak). Kartu kasir menampilkan subtotal kotor + rincian (diskon item / diskon
  transaksi); struk menampilkan subtotal bersih + baris Diskon. Kedua tempat
  memakai rumus sama (lihat `CartPanel` recompute vs `saveOrder`).
- **Bundling (paket produk).** Paket = produk `is_bundle=1` **tanpa baris stok
  sendiri**; komponennya di `product_bundle_items` (bundle→komponen×qty). Paket
  dijual seperti produk biasa (1 baris `transaction_details`), tapi stok yang
  dipotong/dikembalikan adalah **stok komponen** — selalu lewat
  `stockTargets(productId, baseQty)` (`bundlesRepository`) di **ketiga** titik
  mutasi stok: `posRepository.saveOrder`, `preorderRepository` (pelunasan), dan
  `historyRepository.processRefund`. Stok paket di katalog **diturunkan** dari
  komponen via `bundleAvailability` (min ⌊stok÷qty⌋), bukan `outlet_stocks`. Paket
  **dikecualikan dari SELURUH manajemen/laporan stok** (paket tak berstok sendiri):
  `listProducts` (Produk), `listProductsForStock` (Stok Masuk), `listOpnameProducts`
  + `findOpnameProduct` (Opname), `listOpeningProducts` (Saldo Awal),
  `listStockCardProducts` (Kartu Stok), serta laporan/KPI **Stok Menipis**
  (`reportDefs` + `dashboardData`). Paket **tetap** muncul di POS (katalog & scan
  barcode) karena dijual. **Jalur baca** juga mengatribusikan
  pergerakan paket ke komponen: **Kartu Stok** (`stockCardRepository`) menambah
  baris JUAL/REFUND komponen dari penjualan paket, dan **Laporan** `sales_items_real`
  / `top_products_real` memecah paket ke komponennya — bukan menampilkan produk paket.
- **Laba Rugi / HPP (dashboard).** Widget `profit_loss` menghubungkan modal
  (`products.cost_price`) dengan harga jual. HPP = Σ(`transaction_details.quantity`
  × modal/unit); **paket bundling dipecah ke modal komponen** via `UNIT_COST_SQL`
  di `reportsRepository` (bundle tak bermodal sendiri). Memakai `cost_price` produk
  **saat ini** (bukan historis — detail transaksi tak menyimpan modal). Laba kotor =
  (Σ`subtotal` − Σ`discount_amount` transaksi) − HPP; belum termasuk pajak/servis/opex.
- **Cadangan otomatis (`features/backup`).** Snapshot `.sqlite` disimpan di store
  IndexedDB yang sama (kunci `backup:<dbId>:<id>`, via helper blob generik
  `idbSaveBlob`/`idbLoadBlob`/`idbDeleteBlob` di `database.ts`). Metadata + waktu
  cadangan terakhir di **localStorage** (per-slot DB), konfigurasi
  (`backup_auto_enabled`/`backup_interval_hours`/`backup_keep`) di **app_settings**.
  Hook `BackupScheduler` di `App.tsx` menjalankan `runScheduledBackup` saat muat &
  tiap 5 menit (due-check ringan via timestamp). Retensi memangkas cadangan
  **otomatis** terlama; cadangan **manual** tak dipangkas. Pulihkan = `importDatabase`
  + `location.reload`.
- **Prefix nomor invoice.** `generateInvoiceNumber` memakai prefix modul-level di
  `lib/format.ts` (`setInvoicePrefix`/`sanitizeInvoicePrefix`, default `INV`, huruf/
  angka maks 8). Disinkron dari `app_settings.invoice_prefix` via `ThemeApplier`
  di `App.tsx` agar repositori (yang tak punya akses SettingsContext) tetap memakai
  prefix terkini. Setel di Setelan › Pengaturan.
- **Harga modal (cost_price) = harga beli terakhir.** Saat penerimaan Stok Masuk
  disimpan, `products.cost_price` di-update ke modal baris (>0). `lastPurchaseCosts()`
  (`stockinRepository`) mengisi otomatis kolom Harga Modal saat menambah item.
  Penerimaan dengan item qty>0 tapi modal 0 memicu konfirmasi.
- **Approval (persetujuan).** Modul `approvals` (tabel `approvals`: type/payload JSON/
  status). Aksi sensitif membuat permintaan `createApproval(...)` alih-alih langsung
  dijalankan; `approveApproval` **menjalankan** payload via dispatcher per tipe
  (`OPNAME`→`applyOpname`, `STOCK_TRANSFER`→`applyStockTransfer`) lebih dulu (bila
  gagal, status tetap PENDING), lalu menandai APPROVED. Diaktifkan per aksi lewat
  setelan `require_opname_approval` (default ON) & `require_transfer_approval`
  (default off) — helper `isOpnameApprovalRequired`/`isTransferApprovalRequired` di
  `lib/settings.ts`. Approver = persona aktif.
- **Transfer stok (`stocktransfer`).** Pindah stok antar gudang dalam outlet:
  `applyStockTransfer` mengurangi gudang asal & menambah gudang tujuan dalam satu
  transaksi, divalidasi stok asal cukup & asal≠tujuan. Tabel `stock_transfers`+
  `stock_transfer_details`. Bisa lewat approval bila disetel.
- **Lampiran bukti Stok Masuk.** `stock_entries.attachments` = JSON array data-URI
  (foto nota/surat jalan), dikompres kanvas (maks 1280px, JPEG) di `StockInPage`
  sebelum disimpan — tetap local-first.
- **Halaman error/404.** `features/errors/ErrorPage` dipakai sebagai `errorElement`
  root router (menangkap error render/loader) & rute catch-all `*` (404), memakai
  logo + token tema agar konsisten branding.
- **Status transaksi**: `DRAFT` (bill tersimpan) · `PREPARING` (pre-order/antre
  aktif) · `READY` (siap) · `COMPLETED` (lunas) · `REFUNDED`. Laporan/dashboard
  hanya menghitung `COMPLETED`.
- **Stok**: dipotong saat `COMPLETED` (atau saat pelunasan pre-order), dikembalikan
  saat refund. Draft/pre-order belum memotong stok.
- **Poin loyalitas**: hanya untuk transaksi `COMPLETED` bermember; audit di
  `point_logs`; refund menariknya kembali (`REFUND_DEDUCTION`).

## Palet & UI

Warna dari token tema (CSS vars → `tailwind.config.js`): `brand{,-soft,-strong}`,
`background`, `surface`, `panel`, `line`, `ink{,-soft}`, `status.{empty,occupied,waiting}`.
Nilai tiap token diganti per-tema (`src/lib/themes.ts` + `[data-theme]` di `index.css`).

- **`panel`** = permukaan kartu/header/modal (putih di tema terang, gelap di Oniks) —
  **pakai `bg-panel`, JANGAN `bg-white`** agar ikut mode gelap. Header `bg-panel/70`,
  kartu `rounded-card bg-panel shadow-card`.
- **`line`** = warna garis/divider (`border-line/10`, `divide-line/5`) — **JANGAN
  `border-black/*`** agar terlihat di mode gelap.
- **`status.occupied`** (merah) hanya untuk **aksi destruktif/status**, bukan CTA umum.
- **Zebra striping** otomatis untuk semua daftar data via aturan base di `index.css`
  (`tbody tr:nth-child(even)` & `[class*='divide-y'] > *:nth-child(even)` → overlay
  `rgb(var(--c-ink)/0.05)`, ikut tema). Baris `:hover`/latar khusus pakai utility
  Tailwind sehingga tetap menang. Daftar non-data (nav, dropdown/combobox) sengaja
  **tidak** pakai `divide-y` agar tak ikut ter-strip.

### Sistem komponen ui-ux-pro-max (wajib untuk UI baru)

Tombol & field mengikuti standar terstandar (target sentuh ≥44px, transisi 150ms +
`active:scale`, `:focus-visible`, warna dari token tema):

- **Tombol** → komponen `Button` (`src/components/ui/Button.tsx`; impor relatif, mis.
  dari `src/features/<modul>/` → `import Button from '../../components/ui/Button'`),
  props `variant` & `size`:
  - `variant`: `primary` (CTA, `brand-strong` **adaptif tema**), `secondary` (isian
    `brand`), `ghost` (bergaris netral, mis. Batal), `quiet` (tanpa garis, mis. Edit
    inline), `danger` (teks merah, Hapus inline), `danger-outline` (destruktif menonjol).
  - `size`: `md` (default, 44px), `sm` (36px inline), `icon` (persegi 44px).
  - Kelas mentah juga tersedia (`.btn-primary` dst.) bila perlu di elemen non-`<button>`.
- **Field** → kelas `field-label` (label), `field-input` (textbox/textarea),
  `field-select` (combobox). Textbox & combobox juga di-tema global via base-layer
  `index.css` (latar `panel`, teks `ink`, placeholder `ink-soft`).
- **JANGAN konversi**: toggle/switch, tab/segmented, pil filter, kartu selektor
  (tema/produk/list-row), swatch warna, stepper, tombol ikon `✕`, tombol berwarna
  **status semantik** (KDS/antrean "Siap"/"Minta Tagihan"), input berlayout khusus
  (lebar kompak/ikon), dan tombol besar layar **Kiosk/Self-Order/Monitor** (sengaja
  oversized). Toast tetap fixed di bawah-tengah.

Referensi migrasi bersih: `src/features/units/UnitsPage.tsx`.

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
