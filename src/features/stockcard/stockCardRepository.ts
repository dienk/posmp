import { query } from '../../db/database'
import { defaultWarehouseId } from '../warehouses/warehousesRepository'

export interface StockCardProduct {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  unit: string | null
  min_stock: number
  system_stock: number
}

/** Produk aktif + stok total (lintas gudang) + stok minimum, untuk pemilih kartu stock. */
export function listStockCardProducts(outletId: number): StockCardProduct[] {
  return query<StockCardProduct>(
    `SELECT p.id, p.name, p.sku, p.barcode, p.unit, COALESCE(p.min_stock, 0) AS min_stock,
            COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS system_stock
     FROM products p
     WHERE p.is_active = 1 AND COALESCE(p.is_bundle, 0) = 0
     ORDER BY p.name`,
    [outletId],
  )
}

/** Cari produk aktif via barcode/SKU/QR persis — untuk pencarian scan di kartu stok. */
export function findProductByCode(code: string): { id: number; name: string } | null {
  const c = code.trim()
  if (!c) return null
  return (
    query<{ id: number; name: string }>(
      `SELECT id, name FROM products WHERE is_active = 1 AND (barcode = ? OR sku = ?) LIMIT 1`,
      [c, c],
    )[0] ?? null
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
 * Mutasi stok satu produk (kartu stok / kardex). Bila `warehouseId` diisi,
 * kartu difilter untuk gudang tsb: stok masuk & opname sesuai gudang, sedangkan
 * penjualan/refund hanya ikut bila gudang = gudang default (kasir memotong dari
 * gudang default). Tanpa `warehouseId` = total outlet (semua gudang).
 * Saldo berjalan dihitung mundur dari stok saat ini.
 */
export function stockCard(
  productId: number,
  outletId: number,
  warehouseId?: number,
): { movements: StockMovement[]; openingBalance: number; currentStock: number } {
  const allWh = warehouseId == null
  const includeSales = allWh || warehouseId === defaultWarehouseId(outletId)

  const parts: string[] = []
  const params: number[] = []

  parts.push(`SELECT se.entry_date AS at, se.reference_number AS ref, 'MASUK' AS kind,
       sed.quantity AS qin, 0 AS qout
     FROM stock_entry_details sed
     JOIN stock_entries se ON se.id = sed.stock_entry_id
     WHERE sed.product_id = ? AND se.outlet_id = ? AND se.status = 'COMPLETED'
       ${allWh ? '' : 'AND se.warehouse_id = ?'}`)
  params.push(productId, outletId)
  if (!allWh) params.push(warehouseId!)

  parts.push(`SELECT o.opname_date, o.reference_number, 'OPNAME',
       CASE WHEN sod.difference > 0 THEN sod.difference ELSE 0 END,
       CASE WHEN sod.difference < 0 THEN -sod.difference ELSE 0 END
     FROM stock_opname_details sod
     JOIN stock_opnames o ON o.id = sod.opname_id
     WHERE sod.product_id = ? AND o.outlet_id = ?
       ${allWh ? '' : 'AND o.warehouse_id = ?'}`)
  params.push(productId, outletId)
  if (!allWh) params.push(warehouseId!)

  if (includeSales) {
    parts.push(`SELECT t.transaction_date, t.invoice_number, 'JUAL', 0, td.quantity
       FROM transaction_details td
       JOIN transactions t ON t.id = td.transaction_id
       WHERE td.product_id = ? AND t.outlet_id = ? AND t.status IN ('COMPLETED', 'REFUNDED')`)
    params.push(productId, outletId)
    parts.push(`SELECT r.refunded_at, r.refund_invoice_number, 'REFUND', rd.quantity_returned, 0
       FROM refund_details rd
       JOIN refunds r ON r.id = rd.refund_id
       WHERE rd.product_id = ? AND r.outlet_id = ?`)
    params.push(productId, outletId)

    // Penjualan/refund saat produk ini menjadi KOMPONEN paket bundling. Qty =
    // qty paket × qty komponen per paket (stok komponen yang benar-benar keluar).
    // Baris paket sendiri tak berstok, jadi mutasi dicatat pada komponennya.
    parts.push(`SELECT t.transaction_date, t.invoice_number || ' · paket ' || bp.name, 'JUAL',
       0, td.quantity * bi.quantity
       FROM transaction_details td
       JOIN transactions t ON t.id = td.transaction_id
       JOIN product_bundle_items bi ON bi.bundle_product_id = td.product_id
       JOIN products bp ON bp.id = td.product_id
       WHERE bi.component_product_id = ? AND t.outlet_id = ? AND t.status IN ('COMPLETED', 'REFUNDED')`)
    params.push(productId, outletId)
    parts.push(`SELECT r.refunded_at, r.refund_invoice_number || ' · paket ' || bp.name, 'REFUND',
       rd.quantity_returned * bi.quantity, 0
       FROM refund_details rd
       JOIN refunds r ON r.id = rd.refund_id
       JOIN product_bundle_items bi ON bi.bundle_product_id = rd.product_id
       JOIN products bp ON bp.id = rd.product_id
       WHERE bi.component_product_id = ? AND r.outlet_id = ?`)
    params.push(productId, outletId)
  }

  const rows = query<Omit<StockMovement, 'balance'>>(
    parts.join('\n     UNION ALL\n') + '\n     ORDER BY at ASC, ref ASC',
    params,
  )

  const currentStock = allWh
    ? (query<{ s: number }>(
        'SELECT COALESCE(SUM(stock), 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND product_id = ?',
        [outletId, productId],
      )[0]?.s ?? 0)
    : (query<{ s: number }>(
        'SELECT COALESCE(stock, 0) AS s FROM outlet_stocks WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [outletId, warehouseId!, productId],
      )[0]?.s ?? 0)

  const net = rows.reduce((s, r) => s + r.qin - r.qout, 0)
  const openingBalance = currentStock - net

  let running = openingBalance
  const movements: StockMovement[] = rows.map((r) => {
    running += r.qin - r.qout
    return { ...r, balance: running }
  })

  return { movements, openingBalance, currentStock }
}
