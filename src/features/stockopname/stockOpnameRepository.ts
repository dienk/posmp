import { getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'

export interface OpnameProduct {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  unit: string | null
  system_stock: number
}

const SELECT_COLS = `p.id, p.name, p.sku, p.barcode, p.unit,
       COALESCE((SELECT stock FROM outlet_stocks os
                 WHERE os.product_id = p.id AND os.outlet_id = ? AND os.warehouse_id = ?), 0) AS system_stock`

/** Produk aktif + stok sistem pada gudang, untuk lembar opname. */
export function listOpnameProducts(outletId: number, warehouseId: number): OpnameProduct[] {
  return query<OpnameProduct>(
    `SELECT ${SELECT_COLS}
     FROM products p
     WHERE p.is_active = 1
     ORDER BY p.name`,
    [outletId, warehouseId],
  )
}

/** Cari satu produk aktif via barcode/SKU persis (untuk scan opname). */
export function findOpnameProduct(
  code: string,
  outletId: number,
  warehouseId: number,
): OpnameProduct | null {
  const c = code.trim()
  if (!c) return null
  return (
    query<OpnameProduct>(
      `SELECT ${SELECT_COLS}
       FROM products p
       WHERE p.is_active = 1 AND (p.barcode = ? OR p.sku = ?)
       LIMIT 1`,
      [outletId, warehouseId, c, c],
    )[0] ?? null
  )
}

export interface OpnameCount {
  productId: number
  physical: number
}

function opnameRef(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `OPN-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

/**
 * Terapkan hasil opname pada satu gudang: catat header + detail (stok sistem vs
 * fisik + selisih) lalu setel `outlet_stocks.stock` gudang ke jumlah fisik.
 * Satu transaksi SQL.
 */
export async function applyOpname(
  outletId: number,
  warehouseId: number,
  counts: OpnameCount[],
  note?: string,
): Promise<{ id: number; adjusted: number; totalDiff: number }> {
  const items = counts.filter((c) => Number.isFinite(c.physical) && c.physical >= 0)
  if (items.length === 0) throw new Error('Belum ada item yang dihitung.')

  const db = getDb()
  let opnameId = 0
  let totalDiff = 0
  db.run('BEGIN')
  try {
    db.run(
      'INSERT INTO stock_opnames (outlet_id, warehouse_id, reference_number, note) VALUES (?, ?, ?, ?)',
      [outletId, warehouseId, opnameRef(new Date()), note?.trim() || null],
    )
    opnameId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    for (const c of items) {
      const sys =
        query<{ s: number }>(
          'SELECT COALESCE(stock, 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
          [outletId, warehouseId, c.productId],
        )[0]?.s ?? 0
      const diff = c.physical - sys
      totalDiff += diff
      db.run(
        `INSERT INTO stock_opname_details
           (opname_id, product_id, system_qty, physical_qty, difference)
         VALUES (?, ?, ?, ?, ?)`,
        [opnameId, c.productId, sys, c.physical, diff],
      )
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = excluded.stock`,
        [outletId, warehouseId, c.productId, c.physical],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
  return { id: opnameId, adjusted: items.length, totalDiff }
}

export interface OpnameSummary {
  reference_number: string | null
  opname_date: string
  line_count: number
}

/** Ringkasan opname terakhir pada gudang (untuk info di halaman). */
export function lastOpname(outletId: number, warehouseId: number): OpnameSummary | null {
  return (
    query<OpnameSummary>(
      `SELECT o.reference_number, o.opname_date,
              (SELECT COUNT(*) FROM stock_opname_details d WHERE d.opname_id = o.id) AS line_count
       FROM stock_opnames o
       WHERE o.outlet_id = ? AND o.warehouse_id = ?
       ORDER BY o.id DESC
       LIMIT 1`,
      [outletId, warehouseId],
    )[0] ?? null
  )
}
