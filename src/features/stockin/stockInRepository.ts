import { execute, getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'
import { defaultWarehouseId } from '../warehouses/warehousesRepository'

export interface Supplier {
  id: number
  name: string
  contact_name: string | null
  phone: string | null
  address: string | null
  is_active: number
}

export interface StockProduct {
  id: number
  name: string
  sku: string | null
  unit: string | null
  unit_conversions: string | null
  stock: number
}

export interface SupplierWithUsage extends Supplier {
  entry_count: number
}

export interface SupplierInput {
  name: string
  contactName: string | null
  phone: string | null
  address: string | null
  isActive: number
}

export interface StockEntrySummary {
  id: number
  reference_number: string
  supplier_name: string | null
  warehouse_id: number | null
  warehouse_name: string | null
  entry_date: string
  notes: string | null
  total_qty: number
  line_count: number
  total_cost: number
}

export interface StockEntryLine {
  product_id: number
  product_name: string
  sku: string | null
  quantity: number
  cost_price: number | null
  subtotal: number
}

export interface StockEntryDetail extends StockEntrySummary {
  status: string
  lines: StockEntryLine[]
}

export interface StockLineInput {
  productId: number
  quantity: number
  costPrice: number
}

// --- Supplier (CRUD) --------------------------------------------------------

/** Supplier aktif saja (untuk pemilihan di form penerimaan). */
export function listSuppliers(): Supplier[] {
  return query<Supplier>('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name')
}

/** Semua supplier + jumlah penerimaan yang memakainya (untuk pengelolaan). */
export function listSuppliersWithUsage(): SupplierWithUsage[] {
  return query<SupplierWithUsage>(
    `SELECT s.*, (SELECT COUNT(*) FROM stock_entries e WHERE e.supplier_id = s.id) AS entry_count
     FROM suppliers s
     ORDER BY s.is_active DESC, s.name`,
  )
}

export async function createSupplier(input: SupplierInput): Promise<number> {
  return execute(
    'INSERT INTO suppliers (name, contact_name, phone, address, is_active) VALUES (?, ?, ?, ?, ?)',
    [
      input.name.trim(),
      input.contactName?.trim() || null,
      input.phone?.trim() || null,
      input.address?.trim() || null,
      input.isActive,
    ],
  )
}

export async function updateSupplier(id: number, input: SupplierInput): Promise<void> {
  await execute(
    'UPDATE suppliers SET name = ?, contact_name = ?, phone = ?, address = ?, is_active = ? WHERE id = ?',
    [
      input.name.trim(),
      input.contactName?.trim() || null,
      input.phone?.trim() || null,
      input.address?.trim() || null,
      input.isActive,
      id,
    ],
  )
}

/** Hapus supplier; ditolak bila sudah dipakai di penerimaan (sarankan nonaktifkan). */
export async function deleteSupplier(id: number): Promise<void> {
  const used = query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM stock_entries WHERE supplier_id = ?',
    [id],
  )[0].n
  if (used > 0)
    throw new Error('Supplier dipakai di penerimaan — nonaktifkan saja, tidak bisa dihapus.')
  await execute('DELETE FROM suppliers WHERE id = ?', [id])
}

// --- Produk untuk pemilihan --------------------------------------------------

export function listProductsForStock(outletId: number): StockProduct[] {
  return query<StockProduct>(
    `SELECT p.id, p.name, p.sku, p.unit, p.unit_conversions,
            COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS stock
     FROM products p
     WHERE p.is_active = 1 AND p.is_bundle = 0
     ORDER BY p.name`,
    [outletId],
  )
}

// --- Penerimaan stok ---------------------------------------------------------

function referenceNumber(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `SI-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(
    now.getMinutes(),
  )}${p(now.getSeconds())}`
}

/**
 * Catat penerimaan stok masuk: header + baris item, sekaligus menambah stok
 * fisik outlet. Cost price disimpan untuk kalkulasi harga modal (HPP).
 * Semua dalam satu transaksi SQL.
 */
export async function createStockEntry(
  outletId: number,
  supplierId: number | null,
  notes: string,
  lines: StockLineInput[],
  entryDate?: string, // "YYYY-MM-DD HH:MM:SS"; kosong = waktu saat ini
  warehouseId?: number,
): Promise<string> {
  const valid = lines.filter((l) => l.quantity > 0)
  if (valid.length === 0) throw new Error('Tidak ada item untuk diterima.')

  const db = getDb()
  const reference = referenceNumber(new Date())
  const whId = warehouseId ?? defaultWarehouseId(outletId)
  db.run('BEGIN')
  try {
    if (entryDate) {
      db.run(
        `INSERT INTO stock_entries (outlet_id, warehouse_id, supplier_id, reference_number, notes, status, entry_date)
         VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?)`,
        [outletId, whId, supplierId, reference, notes.trim() || null, entryDate],
      )
    } else {
      db.run(
        `INSERT INTO stock_entries (outlet_id, warehouse_id, supplier_id, reference_number, notes, status)
         VALUES (?, ?, ?, ?, ?, 'COMPLETED')`,
        [outletId, whId, supplierId, reference, notes.trim() || null],
      )
    }
    const entryId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    for (const l of valid) {
      db.run(
        `INSERT INTO stock_entry_details (stock_entry_id, product_id, quantity, cost_price)
         VALUES (?, ?, ?, ?)`,
        [entryId, l.productId, l.quantity, l.costPrice || null],
      )
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = stock + excluded.stock`,
        [outletId, whId, l.productId, l.quantity],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
  return reference
}

export interface StockEntryUpdate {
  supplierId: number | null
  notes: string
  entryDate: string
  warehouseId: number
  lines: StockLineInput[]
}

function entryWarehouseId(id: number, outletId: number): number {
  const w = query<{ warehouse_id: number | null }>(
    'SELECT warehouse_id FROM stock_entries WHERE id = ?',
    [id],
  )[0]?.warehouse_id
  return w ?? defaultWarehouseId(outletId)
}

/**
 * Perbarui satu penerimaan: setel header + ganti baris item; kembalikan stok
 * qty lama ke gudang lama lalu tambahkan qty baru ke gudang baru (bisa pindah
 * gudang). Ditolak bila pengembalian membuat stok gudang lama minus.
 */
export async function updateStockEntry(
  id: number,
  outletId: number,
  input: StockEntryUpdate,
): Promise<void> {
  const valid = input.lines.filter((l) => l.quantity > 0)
  if (valid.length === 0) throw new Error('Tidak ada item untuk diterima.')

  const db = getDb()
  const oldWh = entryWarehouseId(id, outletId)
  const newWh = input.warehouseId
  const oldMap = new Map<number, number>()
  for (const r of query<{ product_id: number; quantity: number }>(
    'SELECT product_id, quantity FROM stock_entry_details WHERE stock_entry_id = ?',
    [id],
  )) {
    oldMap.set(r.product_id, (oldMap.get(r.product_id) ?? 0) + r.quantity)
  }

  // Guard: pengembalian qty lama tak boleh membuat stok gudang lama minus.
  for (const [pid, qty] of oldMap) {
    const cur =
      query<{ s: number }>(
        'SELECT COALESCE(stock, 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [outletId, oldWh, pid],
      )[0]?.s ?? 0
    if (cur - qty < 0)
      throw new Error('Perubahan membuat stok minus — sebagian barang sudah terpakai.')
  }

  db.run('BEGIN')
  try {
    db.run(
      'UPDATE stock_entries SET supplier_id = ?, warehouse_id = ?, notes = ?, entry_date = ? WHERE id = ?',
      [input.supplierId, newWh, input.notes.trim() || null, input.entryDate, id],
    )
    // Kembalikan qty lama dari gudang lama.
    for (const [pid, qty] of oldMap) {
      db.run(
        'UPDATE outlet_stocks SET stock = stock - ? WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [qty, outletId, oldWh, pid],
      )
    }
    db.run('DELETE FROM stock_entry_details WHERE stock_entry_id = ?', [id])
    // Tambahkan qty baru ke gudang baru.
    for (const l of valid) {
      db.run(
        `INSERT INTO stock_entry_details (stock_entry_id, product_id, quantity, cost_price)
         VALUES (?, ?, ?, ?)`,
        [id, l.productId, l.quantity, l.costPrice || null],
      )
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = stock + excluded.stock`,
        [outletId, newWh, l.productId, l.quantity],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
}

/**
 * Hapus penerimaan + kembalikan (kurangi) stok gudang terkait.
 * Ditolak bila pengembalian membuat stok minus. Satu transaksi SQL.
 */
export async function deleteStockEntry(id: number, outletId: number): Promise<void> {
  const db = getDb()
  const wh = entryWarehouseId(id, outletId)
  const map = new Map<number, number>()
  for (const r of query<{ product_id: number; quantity: number }>(
    'SELECT product_id, quantity FROM stock_entry_details WHERE stock_entry_id = ?',
    [id],
  )) {
    map.set(r.product_id, (map.get(r.product_id) ?? 0) + r.quantity)
  }
  for (const [pid, qty] of map) {
    const cur =
      query<{ s: number }>(
        'SELECT COALESCE(stock, 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [outletId, wh, pid],
      )[0]?.s ?? 0
    if (cur - qty < 0)
      throw new Error('Tidak bisa dihapus — sebagian barang sudah terpakai (stok akan minus).')
  }

  db.run('BEGIN')
  try {
    for (const [pid, qty] of map) {
      db.run(
        'UPDATE outlet_stocks SET stock = stock - ? WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [qty, outletId, wh, pid],
      )
    }
    db.run('DELETE FROM stock_entry_details WHERE stock_entry_id = ?', [id])
    db.run('DELETE FROM stock_entries WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
}

export function listStockEntries(outletId: number, limit = 30): StockEntrySummary[] {
  return query<StockEntrySummary>(
    `SELECT e.id, e.reference_number, e.entry_date, e.notes, e.warehouse_id,
            s.name AS supplier_name, w.name AS warehouse_name,
            COALESCE(SUM(d.quantity), 0) AS total_qty,
            COUNT(d.id) AS line_count,
            COALESCE(SUM(d.quantity * COALESCE(d.cost_price, 0)), 0) AS total_cost
     FROM stock_entries e
     LEFT JOIN suppliers s ON s.id = e.supplier_id
     LEFT JOIN warehouses w ON w.id = e.warehouse_id
     LEFT JOIN stock_entry_details d ON d.stock_entry_id = e.id
     WHERE e.outlet_id = ?
     GROUP BY e.id
     ORDER BY e.id DESC
     LIMIT ?`,
    [outletId, limit],
  )
}

/** Detail satu penerimaan: header + baris item (produk, qty, modal, subtotal). */
export function stockEntryDetail(id: number): StockEntryDetail | null {
  const head = query<StockEntrySummary & { status: string }>(
    `SELECT e.id, e.reference_number, e.entry_date, e.notes, e.status, e.warehouse_id,
            s.name AS supplier_name, w.name AS warehouse_name,
            COALESCE(SUM(d.quantity), 0) AS total_qty,
            COUNT(d.id) AS line_count,
            COALESCE(SUM(d.quantity * COALESCE(d.cost_price, 0)), 0) AS total_cost
     FROM stock_entries e
     LEFT JOIN suppliers s ON s.id = e.supplier_id
     LEFT JOIN warehouses w ON w.id = e.warehouse_id
     LEFT JOIN stock_entry_details d ON d.stock_entry_id = e.id
     WHERE e.id = ?
     GROUP BY e.id`,
    [id],
  )[0]
  if (!head) return null

  const lines = query<StockEntryLine>(
    `SELECT d.product_id, p.name AS product_name, p.sku, d.quantity, d.cost_price,
            (d.quantity * COALESCE(d.cost_price, 0)) AS subtotal
     FROM stock_entry_details d
     JOIN products p ON p.id = d.product_id
     WHERE d.stock_entry_id = ?
     ORDER BY d.id`,
    [id],
  )
  return { ...head, lines }
}
