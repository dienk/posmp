import { getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'

export interface OpeningProduct {
  id: number
  name: string
  sku: string | null
  unit: string | null
  unit_conversions: string | null
  system_stock: number
}

/** Produk aktif + stok saat ini pada gudang, untuk lembar saldo awal. */
export function listOpeningProducts(outletId: number, warehouseId: number): OpeningProduct[] {
  return query<OpeningProduct>(
    `SELECT p.id, p.name, p.sku, p.unit, p.unit_conversions,
            COALESCE((SELECT stock FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ? AND os.warehouse_id = ?), 0) AS system_stock
     FROM products p
     WHERE p.is_active = 1 AND p.is_bundle = 0
     ORDER BY p.name`,
    [outletId, warehouseId],
  )
}

export interface OpeningBalance {
  productId: number
  qty: number
}

/**
 * Setel saldo awal (stok pembuka) produk pada outlet: `outlet_stocks.stock`
 * di-set langsung ke nilai yang diisi (bukan penambahan). Menjadi baseline
 * stok; berbeda dari Stock Opname yang mencatat selisih. Satu transaksi SQL.
 */
export async function applyOpeningBalances(
  outletId: number,
  warehouseId: number,
  balances: OpeningBalance[],
): Promise<number> {
  const items = balances.filter((b) => Number.isFinite(b.qty) && b.qty >= 0)
  if (items.length === 0) throw new Error('Belum ada saldo awal yang diisi.')

  const db = getDb()
  db.run('BEGIN')
  try {
    for (const b of items) {
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = excluded.stock`,
        [outletId, warehouseId, b.productId, b.qty],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
  return items.length
}
