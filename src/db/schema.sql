-- ============================================================================
-- POSMerahPutih v1.5 — Skema Database SQLite (28 tabel)
-- Local-first: dieksekusi saat inisialisasi database di browser (sql.js).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tabel Outlet (Cabang)
CREATE TABLE IF NOT EXISTS outlets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 2. Tabel Kategori Produk
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color_code TEXT
);

-- 3. Tabel Produk (Katalog Global)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT,                     -- barcode untuk mode scan kasir
    price REAL NOT NULL,
    cost_price REAL DEFAULT 0,        -- harga modal / HPP
    unit TEXT DEFAULT 'pcs',          -- satuan jual (pcs, box, kg, dll)
    min_stock INTEGER DEFAULT 0,      -- stok minimum (titik pemesanan ulang)
    description TEXT,                 -- deskripsi produk
    is_active INTEGER NOT NULL DEFAULT 1,
    image_path TEXT,                  -- gambar utama (= gambar pertama), untuk kartu/kasir
    images TEXT,                      -- JSON array data URL semua gambar produk
    unit_conversions TEXT,            -- JSON [{unit, conversion, price}] satuan turunan (dasar = unit)
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

-- 4. Tabel Stok Produk per Outlet (Multi-Outlet Inventory)
CREATE TABLE IF NOT EXISTS outlet_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL DEFAULT 1,   -- stok dilacak per gudang
    product_id INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id),
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY(product_id) REFERENCES products(id),
    UNIQUE(outlet_id, warehouse_id, product_id)
);

-- 5. Tabel Member (Data Pelanggan, Keanggotaan & Poin Loyalitas)
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    -- Identitas pribadi
    address TEXT,
    birth_date DATE,
    gender TEXT, -- 'L' / 'P'
    occupation TEXT,
    -- Administratif keanggotaan
    member_number TEXT,
    tier TEXT DEFAULT 'SILVER', -- 'SILVER','GOLD','PLATINUM','DIAMOND'
    expiry_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE','INACTIVE','BLOCKED','SUSPENDED'
    -- Loyalti
    balance REAL NOT NULL DEFAULT 0, -- saldo/kredit deposit
    preferences TEXT, -- preferensi produk/kategori
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabel Kampanye Voucher (Voucher Generator Base)
CREATE TABLE IF NOT EXISTS voucher_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_name TEXT NOT NULL,
    prefix TEXT,
    discount_type TEXT NOT NULL, -- 'PERCENTAGE', 'FIXED', 'VALUE_DEPOSIT'
    discount_value REAL NOT NULL,
    min_purchase REAL DEFAULT 0,
    max_discount REAL,
    expiry_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabel Voucher (Promosi & Deposit Pembayaran)
CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL, -- 'PERCENTAGE', 'FIXED', 'VALUE_DEPOSIT'
    discount_value REAL NOT NULL,
    max_discount REAL,
    min_purchase REAL NOT NULL DEFAULT 0,
    expiry_date DATETIME,
    usage_limit INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(campaign_id) REFERENCES voucher_campaigns(id)
);

-- 8. Tabel Struktur Meja Makan (Table Layout)
CREATE TABLE IF NOT EXISTS dining_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    table_number TEXT NOT NULL,
    section_name TEXT DEFAULT 'INDOOR', -- 'INDOOR', 'OUTDOOR', 'VIP'
    grid_x INTEGER DEFAULT 0,
    grid_y INTEGER DEFAULT 0,
    capacity INTEGER DEFAULT 4,       -- kapasitas standar
    max_capacity INTEGER DEFAULT 4,   -- kapasitas maksimum
    status TEXT DEFAULT 'EMPTY', -- 'EMPTY', 'OCCUPIED', 'WAITING_BILL'
    FOREIGN KEY(outlet_id) REFERENCES outlets(id),
    UNIQUE(outlet_id, table_number)
);

-- 9. Tabel Transaksi Penjualan (Header)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    member_id INTEGER,
    voucher_id INTEGER,
    parent_transaction_id INTEGER, -- Split Bill
    table_number TEXT,
    queue_number TEXT,
    facility_type TEXT DEFAULT 'DINE_IN', -- 'DINE_IN', 'TAKEAWAY', 'DELIVERY'
    order_source TEXT DEFAULT 'POS_OFFLINE', -- 'POS_OFFLINE','SELF_ORDER','SHOPEE','TOKOPEDIA','TIKTOK'
    is_preorder INTEGER NOT NULL DEFAULT 0,
    preorder_deadline DATETIME,
    down_payment_received REAL DEFAULT 0,
    subtotal_amount REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT','PREPARING','READY','COMPLETED','REFUNDED'
    note TEXT, -- catatan khusus transaksi (mis. permintaan pelanggan)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id),
    FOREIGN KEY(member_id) REFERENCES members(id),
    FOREIGN KEY(voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY(parent_transaction_id) REFERENCES transactions(id)
);

-- 10. Tabel Detail Transaksi (Lines & KDS Status)
CREATE TABLE IF NOT EXISTS transaction_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    notes TEXT,
    cooking_status TEXT DEFAULT 'PENDING', -- 'PENDING','COOKING','COOKED','SERVED'
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 11. Tabel Multi-Payment Detail
CREATE TABLE IF NOT EXISTS transaction_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    payment_method TEXT NOT NULL, -- 'CASH','DEBIT_CARD','CREDIT_CARD','QRIS','INSTALLMENT','VOUCHER'
    amount_paid REAL NOT NULL,
    tendered_amount REAL NOT NULL,
    change_amount REAL DEFAULT 0,
    voucher_id INTEGER,
    qris_reference_number TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(voucher_id) REFERENCES vouchers(id)
);

-- 12. Tabel Log Pengembalian Dana (Refund Header)
CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    outlet_id INTEGER NOT NULL,
    refund_invoice_number TEXT UNIQUE NOT NULL,
    refund_reason TEXT,
    total_refund_amount REAL NOT NULL,
    refunded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(outlet_id) REFERENCES outlets(id)
);

-- 13. Tabel Detail Item Pengembalian Dana (Refund Lines)
CREATE TABLE IF NOT EXISTS refund_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity_returned INTEGER NOT NULL,
    refund_unit_price REAL NOT NULL,
    FOREIGN KEY(refund_id) REFERENCES refunds(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 14. Tabel Riwayat Penukaran Poin (Log Audit Poin)
CREATE TABLE IF NOT EXISTS point_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    transaction_id INTEGER,
    refund_id INTEGER,
    points_change INTEGER NOT NULL,
    change_reason TEXT, -- 'TRANSACTION_EARNED','TRANSACTION_REDEEMED','REFUND_DEDUCTION'
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(member_id) REFERENCES members(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(refund_id) REFERENCES refunds(id)
);

-- 15. Tabel Supplier (Pemasok Barang)
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 16. Tabel Penerimaan Stok Masuk (Stock In Header)
CREATE TABLE IF NOT EXISTS stock_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    warehouse_id INTEGER,
    supplier_id INTEGER,
    reference_number TEXT UNIQUE NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'DRAFT','COMPLETED'
    entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id),
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);

-- 17. Tabel Detail Item Penerimaan Stok (Stock In Lines)
CREATE TABLE IF NOT EXISTS stock_entry_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_entry_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price REAL,
    FOREIGN KEY(stock_entry_id) REFERENCES stock_entries(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 18. Tabel Detail Jadwal Cicilan Internal (In-House Installments)
CREATE TABLE IF NOT EXISTS transaction_installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    total_tenure INTEGER NOT NULL,
    interest_rate REAL DEFAULT 0,
    monthly_installment REAL NOT NULL,
    remaining_balance REAL NOT NULL,
    due_date DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNPAID', -- 'UNPAID','PARTIALLY_PAID','PAID','OVERDUE'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
);

-- 19. Tabel Integrasi Saluran Marketplace (Omnichannel Configuration)
CREATE TABLE IF NOT EXISTS marketplace_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_name TEXT NOT NULL, -- 'SHOPEE','TOKOPEDIA','TIKTOK'
    shop_id TEXT NOT NULL,
    shop_name TEXT,
    api_key TEXT,
    api_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    is_active INTEGER DEFAULT 1,
    last_synced_at DATETIME
);

-- 20. Pemetaan Hubungan SKU Produk POS dan Marketplace
CREATE TABLE IF NOT EXISTS product_marketplace_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    external_sku TEXT NOT NULL,
    external_product_id TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(channel_id) REFERENCES marketplace_channels(id),
    UNIQUE(product_id, channel_id)
);

-- 21. Tabel Antrean Pesanan KDS
CREATE TABLE IF NOT EXISTS kds_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    outlet_id INTEGER NOT NULL,
    table_number TEXT,
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cooking_duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PREPARING', -- 'PREPARING','READY','SERVED'
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(outlet_id) REFERENCES outlets(id)
);

-- 22. Tabel Pengaturan Fasilitas Sistem (App Configuration)
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
);

-- 23. Tabel Kasir (Titik/Mesin Kasir per Outlet)
CREATE TABLE IF NOT EXISTS cashiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id)
);

-- 24. Tabel Satuan Produk (Unit of Measure)
CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 25. Tabel Pajak (Tax Rates)
CREATE TABLE IF NOT EXISTS taxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 0,        -- persen, mis. 10 = 10%
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 26. Tabel Stock Opname (Header sesi penghitungan stok fisik)
CREATE TABLE IF NOT EXISTS stock_opnames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    warehouse_id INTEGER,
    reference_number TEXT,
    opname_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id)
);

-- 27. Tabel Detail Stock Opname (stok sistem vs fisik per produk)
CREATE TABLE IF NOT EXISTS stock_opname_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opname_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    system_qty INTEGER NOT NULL,
    physical_qty INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    FOREIGN KEY(opname_id) REFERENCES stock_opnames(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 28. Tabel Gudang (Warehouse per Outlet)
CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(outlet_id) REFERENCES outlets(id)
);
