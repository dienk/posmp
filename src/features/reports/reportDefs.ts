import { query } from '../../db/database'

export type ColType = 'text' | 'money' | 'number' | 'date'

export interface ReportColumn {
  key: string
  label: string
  type?: ColType // default 'text'
}

export interface ReportDef {
  key: string
  label: string
  group: string
  desc: string
  columns: ReportColumn[]
  /** Kolom tanggal untuk filter rentang (kosong = tanpa filter tanggal). */
  dateField?: string
  fetch: (outletId: number) => Row[]
}

type Row = Record<string, unknown>

const q = (sql: string, params: (string | number)[] = []): Row[] => query<Row>(sql, params)

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}
const withLabel = (rows: Row[], key: string, map: Record<string, string>): Row[] =>
  rows.map((r) => ({ ...r, [key]: map[String(r[key])] ?? r[key] }))

// ── Registry ────────────────────────────────────────────────────────────────

export const REPORTS: ReportDef[] = [
  // Penjualan
  {
    key: 'sales_tx',
    label: 'Transaksi Penjualan',
    group: 'Penjualan',
    desc: 'Daftar nota penjualan (subtotal, diskon, service, pajak, total).',
    dateField: 'transaction_date',
    columns: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'transaction_date', label: 'Tanggal', type: 'date' },
      { key: 'order_source', label: 'Sumber' },
      { key: 'table_number', label: 'Meja' },
      { key: 'subtotal_amount', label: 'Subtotal', type: 'money' },
      { key: 'discount_amount', label: 'Diskon', type: 'money' },
      { key: 'service_charge_amount', label: 'Service', type: 'money' },
      { key: 'tax_amount', label: 'Pajak', type: 'money' },
      { key: 'total_amount', label: 'Total', type: 'money' },
      { key: 'status', label: 'Status' },
    ],
    fetch: (o) =>
      withLabel(
        q(
          `SELECT invoice_number, transaction_date, order_source, table_number, subtotal_amount,
                  discount_amount, COALESCE(service_charge_amount,0) AS service_charge_amount,
                  tax_amount, total_amount, status
           FROM transactions WHERE outlet_id = ? AND status IN ('COMPLETED','REFUNDED')
           ORDER BY id DESC`,
          [o],
        ),
        'order_source',
        SOURCE_LABEL,
      ),
  },
  {
    key: 'sales_items',
    label: 'Item Terjual',
    group: 'Penjualan',
    desc: 'Rincian item per nota (produk, qty, harga, subtotal).',
    dateField: 'transaction_date',
    columns: [
      { key: 'transaction_date', label: 'Tanggal', type: 'date' },
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'name', label: 'Produk' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'unit_price', label: 'Harga', type: 'money' },
      { key: 'subtotal', label: 'Subtotal', type: 'money' },
    ],
    fetch: (o) =>
      q(
        `SELECT t.transaction_date, t.invoice_number, p.name, d.quantity, d.unit_price, d.subtotal
         FROM transaction_details d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN products p ON p.id = d.product_id
         WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         ORDER BY t.id DESC, d.id`,
        [o],
      ),
  },
  {
    key: 'sales_items_real',
    label: 'Item Terjual (Real)',
    group: 'Penjualan',
    desc: 'Item terjual dengan paket bundling dipecah ke komponen aslinya (qty real yang keluar).',
    dateField: 'transaction_date',
    columns: [
      { key: 'transaction_date', label: 'Tanggal', type: 'date' },
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'name', label: 'Produk (Real)' },
      { key: 'source_bundle', label: 'Asal Paket' },
      { key: 'quantity', label: 'Qty Real', type: 'number' },
      { key: 'unit', label: 'Satuan' },
    ],
    // Baris produk biasa apa adanya + baris paket dipecah jadi komponennya
    // (qty = qty paket × qty komponen per paket). Produk paket sendiri tak muncul.
    fetch: (o) =>
      q(
        `SELECT t.transaction_date, t.invoice_number, p.name, '—' AS source_bundle,
                d.quantity AS quantity, p.unit
         FROM transaction_details d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN products p ON p.id = d.product_id
         WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND COALESCE(p.is_bundle,0) = 0
         UNION ALL
         SELECT t.transaction_date, t.invoice_number, cp.name, bp.name AS source_bundle,
                d.quantity * bi.quantity AS quantity, cp.unit
         FROM transaction_details d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN products bp ON bp.id = d.product_id AND bp.is_bundle = 1
         JOIN product_bundle_items bi ON bi.bundle_product_id = d.product_id
         JOIN products cp ON cp.id = bi.component_product_id
         WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         ORDER BY transaction_date DESC, invoice_number, name`,
        [o, o],
      ),
  },
  {
    key: 'top_products',
    label: 'Produk Terlaris',
    group: 'Penjualan',
    desc: 'Peringkat produk berdasarkan kuantitas & pendapatan.',
    columns: [
      { key: 'name', label: 'Produk' },
      { key: 'qty', label: 'Qty Terjual', type: 'number' },
      { key: 'revenue', label: 'Pendapatan', type: 'money' },
    ],
    fetch: (o) =>
      q(
        `SELECT p.name, SUM(d.quantity) AS qty, SUM(d.subtotal) AS revenue
         FROM transaction_details d
         JOIN transactions t ON t.id = d.transaction_id
         JOIN products p ON p.id = d.product_id
         WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         GROUP BY p.id ORDER BY qty DESC`,
        [o],
      ),
  },
  {
    key: 'top_products_real',
    label: 'Produk Terjual — Real (Rekap)',
    group: 'Penjualan',
    desc: 'Total kuantitas real per item; paket bundling dipecah ke komponennya. (Seluruh waktu.)',
    columns: [
      { key: 'name', label: 'Produk' },
      { key: 'qty_direct', label: 'Terjual Langsung', type: 'number' },
      { key: 'qty_bundle', label: 'Dari Paket', type: 'number' },
      { key: 'qty_real', label: 'Total Real', type: 'number' },
    ],
    fetch: (o) =>
      q(
        `SELECT p.name,
                SUM(CASE WHEN x.src = 'direct' THEN x.qty ELSE 0 END) AS qty_direct,
                SUM(CASE WHEN x.src = 'bundle' THEN x.qty ELSE 0 END) AS qty_bundle,
                SUM(x.qty) AS qty_real
         FROM (
           SELECT d.product_id AS pid, d.quantity AS qty, 'direct' AS src
           FROM transaction_details d
           JOIN transactions t ON t.id = d.transaction_id
           JOIN products pr ON pr.id = d.product_id
           WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND COALESCE(pr.is_bundle,0) = 0
           UNION ALL
           SELECT bi.component_product_id AS pid, d.quantity * bi.quantity AS qty, 'bundle' AS src
           FROM transaction_details d
           JOIN transactions t ON t.id = d.transaction_id
           JOIN products bp ON bp.id = d.product_id AND bp.is_bundle = 1
           JOIN product_bundle_items bi ON bi.bundle_product_id = d.product_id
           WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         ) x
         JOIN products p ON p.id = x.pid
         GROUP BY p.id ORDER BY qty_real DESC`,
        [o, o],
      ),
  },
  {
    key: 'sales_by_source',
    label: 'Penjualan per Sumber',
    group: 'Penjualan',
    desc: 'Total penjualan dikelompokkan per kanal.',
    columns: [
      { key: 'order_source', label: 'Sumber' },
      { key: 'tx_count', label: 'Transaksi', type: 'number' },
      { key: 'total', label: 'Total', type: 'money' },
    ],
    fetch: (o) =>
      withLabel(
        q(
          `SELECT order_source, COUNT(*) AS tx_count, COALESCE(SUM(total_amount),0) AS total
           FROM transactions WHERE outlet_id = ? AND status = 'COMPLETED'
           GROUP BY order_source ORDER BY total DESC`,
          [o],
        ),
        'order_source',
        SOURCE_LABEL,
      ),
  },
  {
    key: 'payments',
    label: 'Rincian Pembayaran',
    group: 'Penjualan',
    desc: 'Total per metode pembayaran.',
    columns: [
      { key: 'payment_method', label: 'Metode' },
      { key: 'tx_count', label: 'Transaksi', type: 'number' },
      { key: 'total', label: 'Total', type: 'money' },
    ],
    fetch: (o) =>
      q(
        `SELECT tp.payment_method, COUNT(*) AS tx_count, COALESCE(SUM(tp.amount_paid),0) AS total
         FROM transaction_payments tp
         JOIN transactions t ON t.id = tp.transaction_id
         WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         GROUP BY tp.payment_method ORDER BY total DESC`,
        [o],
      ),
  },
  // Produk & Stok
  {
    key: 'products',
    label: 'Katalog Produk',
    group: 'Produk & Stok',
    desc: 'Daftar produk beserta harga, modal, & stok total.',
    columns: [
      { key: 'name', label: 'Produk' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Kategori' },
      { key: 'unit', label: 'Satuan' },
      { key: 'price', label: 'Harga Jual', type: 'money' },
      { key: 'cost_price', label: 'Harga Modal', type: 'money' },
      { key: 'stock', label: 'Stok', type: 'number' },
    ],
    fetch: (o) =>
      q(
        `SELECT p.name, p.sku, c.name AS category, p.unit, p.price, p.cost_price,
                COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                          WHERE os.product_id = p.id AND os.outlet_id = ?),0) AS stock
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
         ORDER BY p.name`,
        [o],
      ),
  },
  {
    key: 'stock',
    label: 'Stok per Gudang',
    group: 'Produk & Stok',
    desc: 'Kartu stok per produk per gudang.',
    columns: [
      { key: 'name', label: 'Produk' },
      { key: 'warehouse', label: 'Gudang' },
      { key: 'stock', label: 'Stok', type: 'number' },
    ],
    fetch: (o) =>
      q(
        `SELECT p.name, w.name AS warehouse, os.stock
         FROM outlet_stocks os
         JOIN products p ON p.id = os.product_id
         LEFT JOIN warehouses w ON w.id = os.warehouse_id
         WHERE os.outlet_id = ? ORDER BY p.name, w.name`,
        [o],
      ),
  },
  {
    key: 'low_stock',
    label: 'Stok Menipis',
    group: 'Produk & Stok',
    desc: 'Produk dengan stok total ≤ stok minimum.',
    columns: [
      { key: 'name', label: 'Produk' },
      { key: 'stock', label: 'Stok', type: 'number' },
      { key: 'min_stock', label: 'Min', type: 'number' },
    ],
    fetch: (o) =>
      q(
        `SELECT p.name, COALESCE(s.stock,0) AS stock, p.min_stock
         FROM products p
         LEFT JOIN (SELECT product_id, SUM(stock) AS stock FROM outlet_stocks WHERE outlet_id = ? GROUP BY product_id) s
           ON s.product_id = p.id
         WHERE p.is_active = 1 AND COALESCE(s.stock,0) <= p.min_stock
         ORDER BY stock ASC`,
        [o],
      ),
  },
  {
    key: 'stock_in',
    label: 'Penerimaan Stok',
    group: 'Produk & Stok',
    desc: 'Riwayat penerimaan barang dari supplier.',
    dateField: 'entry_date',
    columns: [
      { key: 'reference_number', label: 'No. Referensi' },
      { key: 'entry_date', label: 'Tanggal', type: 'date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'warehouse', label: 'Gudang' },
      { key: 'total_qty', label: 'Qty', type: 'number' },
      { key: 'total_cost', label: 'Total Modal', type: 'money' },
    ],
    fetch: (o) =>
      q(
        `SELECT e.reference_number, e.entry_date, s.name AS supplier, w.name AS warehouse,
                COALESCE(SUM(d.quantity),0) AS total_qty,
                COALESCE(SUM(d.quantity * COALESCE(d.cost_price,0)),0) AS total_cost
         FROM stock_entries e
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN warehouses w ON w.id = e.warehouse_id
         LEFT JOIN stock_entry_details d ON d.stock_entry_id = e.id
         WHERE e.outlet_id = ? GROUP BY e.id ORDER BY e.id DESC`,
        [o],
      ),
  },
  {
    key: 'stock_opname',
    label: 'Riwayat Opname',
    group: 'Produk & Stok',
    desc: 'Sesi stock opname (jumlah item disesuaikan).',
    dateField: 'opname_date',
    columns: [
      { key: 'reference_number', label: 'No. Referensi' },
      { key: 'opname_date', label: 'Tanggal', type: 'date' },
      { key: 'warehouse', label: 'Gudang' },
      { key: 'line_count', label: 'Item', type: 'number' },
      { key: 'note', label: 'Catatan' },
    ],
    fetch: (o) =>
      q(
        `SELECT op.reference_number, op.opname_date, w.name AS warehouse,
                (SELECT COUNT(*) FROM stock_opname_details d WHERE d.opname_id = op.id) AS line_count,
                op.note
         FROM stock_opnames op LEFT JOIN warehouses w ON w.id = op.warehouse_id
         WHERE op.outlet_id = ? ORDER BY op.id DESC`,
        [o],
      ),
  },
  // Pelanggan & Loyalitas
  {
    key: 'members',
    label: 'Daftar Member',
    group: 'Pelanggan & Loyalitas',
    desc: 'Data member, tier, poin, & saldo.',
    columns: [
      { key: 'name', label: 'Nama' },
      { key: 'phone', label: 'No. HP' },
      { key: 'member_number', label: 'No. Kartu' },
      { key: 'tier', label: 'Tier' },
      { key: 'status', label: 'Status' },
      { key: 'points', label: 'Poin', type: 'number' },
      { key: 'balance', label: 'Saldo', type: 'money' },
    ],
    fetch: () =>
      q(
        `SELECT name, phone, member_number, tier, status, points, balance FROM members ORDER BY name`,
      ),
  },
  {
    key: 'points',
    label: 'Log Poin',
    group: 'Pelanggan & Loyalitas',
    desc: 'Riwayat perolehan/penukaran poin member.',
    dateField: 'logged_at',
    columns: [
      { key: 'logged_at', label: 'Waktu', type: 'date' },
      { key: 'member', label: 'Member' },
      { key: 'points_change', label: 'Poin', type: 'number' },
      { key: 'change_reason', label: 'Alasan' },
    ],
    fetch: () =>
      q(
        `SELECT l.logged_at, m.name AS member, l.points_change, l.change_reason
         FROM point_logs l JOIN members m ON m.id = l.member_id ORDER BY l.id DESC`,
      ),
  },
  {
    key: 'vouchers',
    label: 'Voucher',
    group: 'Pelanggan & Loyalitas',
    desc: 'Daftar voucher & pemakaiannya.',
    columns: [
      { key: 'code', label: 'Kode' },
      { key: 'discount_type', label: 'Tipe' },
      { key: 'discount_value', label: 'Nilai', type: 'number' },
      { key: 'used_count', label: 'Terpakai', type: 'number' },
      { key: 'usage_limit', label: 'Batas', type: 'number' },
      { key: 'expiry_date', label: 'Kadaluarsa', type: 'date' },
      { key: 'is_active', label: 'Aktif' },
    ],
    fetch: () =>
      q(
        `SELECT code, discount_type, discount_value, used_count, usage_limit, expiry_date,
                CASE is_active WHEN 1 THEN 'Ya' ELSE 'Tidak' END AS is_active
         FROM vouchers ORDER BY id DESC`,
      ),
  },
  // Keuangan
  {
    key: 'cash_sessions',
    label: 'Saldo Kas',
    group: 'Keuangan',
    desc: 'Sesi buka/tutup kas & selisih.',
    dateField: 'opened_at',
    columns: [
      { key: 'opened_at', label: 'Buka', type: 'date' },
      { key: 'closed_at', label: 'Tutup', type: 'date' },
      { key: 'shift_name', label: 'Shift' },
      { key: 'opening_balance', label: 'Saldo Awal', type: 'money' },
      { key: 'cash_sales', label: 'Tunai', type: 'money' },
      { key: 'expected_balance', label: 'Ekspektasi', type: 'money' },
      { key: 'closing_balance', label: 'Saldo Tutup', type: 'money' },
      { key: 'difference', label: 'Selisih', type: 'money' },
      { key: 'status', label: 'Status' },
    ],
    fetch: (o) =>
      q(
        `SELECT opened_at, closed_at, shift_name, opening_balance, cash_sales, expected_balance,
                closing_balance, difference, status
         FROM cash_sessions WHERE outlet_id = ? ORDER BY id DESC`,
        [o],
      ),
  },
  {
    key: 'refunds',
    label: 'Refund',
    group: 'Keuangan',
    desc: 'Riwayat pengembalian dana.',
    dateField: 'refunded_at',
    columns: [
      { key: 'refund_invoice_number', label: 'No. Refund' },
      { key: 'refunded_at', label: 'Tanggal', type: 'date' },
      { key: 'invoice_number', label: 'Invoice Asal' },
      { key: 'refund_reason', label: 'Alasan' },
      { key: 'total_refund_amount', label: 'Nilai', type: 'money' },
    ],
    fetch: (o) =>
      q(
        `SELECT r.refund_invoice_number, r.refunded_at, t.invoice_number, r.refund_reason,
                r.total_refund_amount
         FROM refunds r LEFT JOIN transactions t ON t.id = r.transaction_id
         WHERE r.outlet_id = ? ORDER BY r.id DESC`,
        [o],
      ),
  },
  {
    key: 'installments',
    label: 'Cicilan',
    group: 'Keuangan',
    desc: 'Rencana cicilan member & sisa tagihan.',
    dateField: 'due_date',
    columns: [
      { key: 'member', label: 'Member' },
      { key: 'monthly_installment', label: 'Angsuran/bln', type: 'money' },
      { key: 'total_tenure', label: 'Tenor', type: 'number' },
      { key: 'remaining_balance', label: 'Sisa', type: 'money' },
      { key: 'due_date', label: 'Jatuh Tempo', type: 'date' },
      { key: 'status', label: 'Status' },
    ],
    fetch: () =>
      q(
        `SELECT m.name AS member, i.monthly_installment, i.total_tenure, i.remaining_balance,
                i.due_date, i.status
         FROM transaction_installments i JOIN members m ON m.id = i.member_id ORDER BY i.id DESC`,
      ),
  },
  {
    key: 'preorders',
    label: 'Pre-Order',
    group: 'Keuangan',
    desc: 'Pesanan di muka & uang muka.',
    dateField: 'transaction_date',
    columns: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'transaction_date', label: 'Tanggal', type: 'date' },
      { key: 'preorder_deadline', label: 'Tenggat', type: 'date' },
      { key: 'down_payment_received', label: 'DP', type: 'money' },
      { key: 'total_amount', label: 'Total', type: 'money' },
      { key: 'status', label: 'Status' },
    ],
    fetch: (o) =>
      q(
        `SELECT invoice_number, transaction_date, preorder_deadline, down_payment_received,
                total_amount, status
         FROM transactions WHERE outlet_id = ? AND is_preorder = 1 ORDER BY id DESC`,
        [o],
      ),
  },
  // Master
  {
    key: 'suppliers',
    label: 'Supplier',
    group: 'Master',
    desc: 'Daftar pemasok.',
    columns: [
      { key: 'name', label: 'Nama' },
      { key: 'contact_name', label: 'Kontak' },
      { key: 'phone', label: 'Telepon' },
      { key: 'address', label: 'Alamat' },
      { key: 'is_active', label: 'Aktif' },
    ],
    fetch: () =>
      q(
        `SELECT name, contact_name, phone, address,
                CASE is_active WHEN 1 THEN 'Ya' ELSE 'Tidak' END AS is_active
         FROM suppliers ORDER BY name`,
      ),
  },
]

export const REPORT_GROUPS = [...new Set(REPORTS.map((r) => r.group))]

export function getReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key)
}
