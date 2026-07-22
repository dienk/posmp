import { getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'

export interface TransferProduct {
  id: number
  name: string
  sku: string | null
  unit: string | null
  stock: number // stok pada gudang asal
}

export interface TransferLineInput {
  productId: number
  quantity: number
}

export interface StockTransferSummary {
  id: number
  reference_number: string
  from_warehouse_id: number
  to_warehouse_id: number
  from_warehouse_name: string | null
  to_warehouse_name: string | null
  note: string | null
  transfer_date: string
  total_qty: number
  line_count: number
}

export interface StockTransferLine {
  product_id: number
  product_name: string
  sku: string | null
  quantity: number
}

export interface StockTransferDetail extends StockTransferSummary {
  lines: StockTransferLine[]
}

/** Produk aktif + stok pada gudang asal (>0 boleh ditransfer). */
export function listTransferProducts(outletId: number, warehouseId: number): TransferProduct[] {
  return query<TransferProduct>(
    `SELECT p.id, p.name, p.sku, p.unit,
            COALESCE((SELECT os.stock FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ? AND os.warehouse_id = ?), 0) AS stock
     FROM products p
     WHERE p.is_active = 1 AND p.is_bundle = 0
     ORDER BY p.name`,
    [outletId, warehouseId],
  )
}

function transferRef(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `TRF-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

/**
 * Pindahkan stok antar gudang dalam outlet yang sama: kurangi gudang asal,
 * tambah gudang tujuan, catat header + detail. Divalidasi agar stok asal cukup.
 * Satu transaksi SQL.
 */
export async function applyStockTransfer(
  outletId: number,
  fromWarehouseId: number,
  toWarehouseId: number,
  lines: TransferLineInput[],
  note?: string,
): Promise<{ reference: string; moved: number }> {
  if (fromWarehouseId === toWarehouseId)
    throw new Error('Gudang asal dan tujuan tidak boleh sama.')
  const valid = lines.filter((l) => l.quantity > 0)
  if (valid.length === 0) throw new Error('Tidak ada item untuk ditransfer.')

  // Guard stok asal cukup.
  for (const l of valid) {
    const cur =
      query<{ s: number }>(
        'SELECT COALESCE(stock,0) AS s FROM outlet_stocks WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [outletId, fromWarehouseId, l.productId],
      )[0]?.s ?? 0
    if (cur < l.quantity)
      throw new Error('Stok gudang asal tidak cukup untuk sebagian item.')
  }

  const db = getDb()
  const reference = transferRef(new Date())
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO stock_transfers (outlet_id, reference_number, from_warehouse_id, to_warehouse_id, note, status)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED')`,
      [outletId, reference, fromWarehouseId, toWarehouseId, note?.trim() || null],
    )
    const transferId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    for (const l of valid) {
      db.run(
        'INSERT INTO stock_transfer_details (transfer_id, product_id, quantity) VALUES (?, ?, ?)',
        [transferId, l.productId, l.quantity],
      )
      db.run(
        'UPDATE outlet_stocks SET stock = stock - ? WHERE outlet_id = ? AND warehouse_id = ? AND product_id = ?',
        [l.quantity, outletId, fromWarehouseId, l.productId],
      )
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = stock + excluded.stock`,
        [outletId, toWarehouseId, l.productId, l.quantity],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
  return { reference, moved: valid.length }
}

export function listStockTransfers(outletId: number, limit = 30): StockTransferSummary[] {
  return query<StockTransferSummary>(
    `SELECT t.id, t.reference_number, t.from_warehouse_id, t.to_warehouse_id, t.note, t.transfer_date,
            wf.name AS from_warehouse_name, wt.name AS to_warehouse_name,
            COALESCE(SUM(d.quantity), 0) AS total_qty,
            COUNT(d.id) AS line_count
     FROM stock_transfers t
     LEFT JOIN warehouses wf ON wf.id = t.from_warehouse_id
     LEFT JOIN warehouses wt ON wt.id = t.to_warehouse_id
     LEFT JOIN stock_transfer_details d ON d.transfer_id = t.id
     WHERE t.outlet_id = ?
     GROUP BY t.id
     ORDER BY t.id DESC
     LIMIT ?`,
    [outletId, limit],
  )
}

export function stockTransferDetail(id: number): StockTransferDetail | null {
  const head = query<StockTransferSummary>(
    `SELECT t.id, t.reference_number, t.from_warehouse_id, t.to_warehouse_id, t.note, t.transfer_date,
            wf.name AS from_warehouse_name, wt.name AS to_warehouse_name,
            COALESCE(SUM(d.quantity), 0) AS total_qty,
            COUNT(d.id) AS line_count
     FROM stock_transfers t
     LEFT JOIN warehouses wf ON wf.id = t.from_warehouse_id
     LEFT JOIN warehouses wt ON wt.id = t.to_warehouse_id
     LEFT JOIN stock_transfer_details d ON d.transfer_id = t.id
     WHERE t.id = ?
     GROUP BY t.id`,
    [id],
  )[0]
  if (!head) return null
  const lines = query<StockTransferLine>(
    `SELECT d.product_id, p.name AS product_name, p.sku, d.quantity
     FROM stock_transfer_details d JOIN products p ON p.id = d.product_id
     WHERE d.transfer_id = ? ORDER BY d.id`,
    [id],
  )
  return { ...head, lines }
}
