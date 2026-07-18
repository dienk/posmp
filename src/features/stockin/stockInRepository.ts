import { execute, getDb, persist, query } from '../../db/database'

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
  stock: number
}

export interface StockEntrySummary {
  id: number
  reference_number: string
  supplier_name: string | null
  entry_date: string
  total_qty: number
  line_count: number
}

export interface StockLineInput {
  productId: number
  quantity: number
  costPrice: number
}

// --- Supplier ---------------------------------------------------------------

export function listSuppliers(): Supplier[] {
  return query<Supplier>('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name')
}

export async function createSupplier(
  name: string,
  contactName: string | null,
  phone: string | null,
): Promise<number> {
  return execute(
    'INSERT INTO suppliers (name, contact_name, phone, is_active) VALUES (?, ?, ?, 1)',
    [name.trim(), contactName?.trim() || null, phone?.trim() || null],
  )
}

// --- Produk untuk pemilihan --------------------------------------------------

export function listProductsForStock(outletId: number): StockProduct[] {
  return query<StockProduct>(
    `SELECT p.id, p.name, p.sku, COALESCE(os.stock, 0) AS stock
     FROM products p
     LEFT JOIN outlet_stocks os ON os.product_id = p.id AND os.outlet_id = ?
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
): Promise<string> {
  const valid = lines.filter((l) => l.quantity > 0)
  if (valid.length === 0) throw new Error('Tidak ada item untuk diterima.')

  const db = getDb()
  const reference = referenceNumber(new Date())
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO stock_entries (outlet_id, supplier_id, reference_number, notes, status)
       VALUES (?, ?, ?, ?, 'COMPLETED')`,
      [outletId, supplierId, reference, notes.trim() || null],
    )
    const entryId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    for (const l of valid) {
      db.run(
        `INSERT INTO stock_entry_details (stock_entry_id, product_id, quantity, cost_price)
         VALUES (?, ?, ?, ?)`,
        [entryId, l.productId, l.quantity, l.costPrice || null],
      )
      // Upsert stok outlet.
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, product_id, stock) VALUES (?, ?, ?)
         ON CONFLICT(outlet_id, product_id) DO UPDATE SET stock = stock + excluded.stock`,
        [outletId, l.productId, l.quantity],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  return reference
}

export function listStockEntries(outletId: number, limit = 20): StockEntrySummary[] {
  return query<StockEntrySummary>(
    `SELECT e.id, e.reference_number, e.entry_date,
            s.name AS supplier_name,
            COALESCE(SUM(d.quantity), 0) AS total_qty,
            COUNT(d.id) AS line_count
     FROM stock_entries e
     LEFT JOIN suppliers s ON s.id = e.supplier_id
     LEFT JOIN stock_entry_details d ON d.stock_entry_id = e.id
     WHERE e.outlet_id = ?
     GROUP BY e.id
     ORDER BY e.id DESC
     LIMIT ?`,
    [outletId, limit],
  )
}
