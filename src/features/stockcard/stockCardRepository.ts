import { query } from '../../db/database'

export interface StockCardProduct {
  id: number
  name: string
  sku: string | null
  unit: string | null
  system_stock: number
}

/** Produk aktif + stok sistem, untuk pemilih kartu stock. */
export function listStockCardProducts(outletId: number): StockCardProduct[] {
  return query<StockCardProduct>(
    `SELECT p.id, p.name, p.sku, p.unit, COALESCE(os.stock, 0) AS system_stock
     FROM products p
     LEFT JOIN outlet_stocks os ON os.product_id = p.id AND os.outlet_id = ?
     WHERE p.is_active = 1
     ORDER BY p.name`,
    [outletId],
  )
}

export type MovementKind = 'MASUK' | 'JUAL' | 'REFUND' | 'OPNAME'

export interface StockMovement {
  at: string
  ref: string | null
  kind: MovementKind
  qin: number
  qout: number
  balance: number
}

/**
 * Mutasi stok satu produk pada outlet (kartu stok / kardex), urut kronologis:
 * stok masuk (+), penjualan (−), refund (+), dan penyesuaian opname (±).
 * Saldo berjalan dihitung mundur dari stok sistem saat ini agar baris terakhir
 * = stok saat ini, dan baris pertama menunjukkan saldo awal.
 */
export function stockCard(
  productId: number,
  outletId: number,
): { movements: StockMovement[]; openingBalance: number; currentStock: number } {
  const rows = query<Omit<StockMovement, 'balance'>>(
    `SELECT se.entry_date AS at, se.reference_number AS ref, 'MASUK' AS kind,
            sed.quantity AS qin, 0 AS qout
     FROM stock_entry_details sed
     JOIN stock_entries se ON se.id = sed.stock_entry_id
     WHERE sed.product_id = ? AND se.outlet_id = ? AND se.status = 'COMPLETED'
     UNION ALL
     SELECT t.transaction_date, t.invoice_number, 'JUAL', 0, td.quantity
     FROM transaction_details td
     JOIN transactions t ON t.id = td.transaction_id
     WHERE td.product_id = ? AND t.outlet_id = ? AND t.status IN ('COMPLETED', 'REFUNDED')
     UNION ALL
     SELECT r.refunded_at, r.refund_invoice_number, 'REFUND', rd.quantity_returned, 0
     FROM refund_details rd
     JOIN refunds r ON r.id = rd.refund_id
     WHERE rd.product_id = ? AND r.outlet_id = ?
     UNION ALL
     SELECT o.opname_date, o.reference_number, 'OPNAME',
            CASE WHEN sod.difference > 0 THEN sod.difference ELSE 0 END,
            CASE WHEN sod.difference < 0 THEN -sod.difference ELSE 0 END
     FROM stock_opname_details sod
     JOIN stock_opnames o ON o.id = sod.opname_id
     WHERE sod.product_id = ? AND o.outlet_id = ?
     ORDER BY at ASC, ref ASC`,
    [productId, outletId, productId, outletId, productId, outletId, productId, outletId],
  )

  const currentStock =
    query<{ s: number }>(
      'SELECT COALESCE(stock, 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND product_id = ?',
      [outletId, productId],
    )[0]?.s ?? 0

  const net = rows.reduce((s, r) => s + r.qin - r.qout, 0)
  const openingBalance = currentStock - net

  let running = openingBalance
  const movements: StockMovement[] = rows.map((r) => {
    running += r.qin - r.qout
    return { ...r, balance: running }
  })

  return { movements, openingBalance, currentStock }
}
