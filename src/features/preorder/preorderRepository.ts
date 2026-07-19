import { getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'
import type { PaymentInput } from '../pos/posRepository'
import { defaultWarehouseId } from '../warehouses/warehousesRepository'

export interface Preorder {
  id: number
  invoice_number: string
  transaction_date: string
  preorder_deadline: string | null
  total_amount: number
  down_payment_received: number
  remaining: number
  member_id: number | null
  member_name: string | null
  status: string
}

export interface PreorderItem {
  name: string
  quantity: number
  subtotal: number
}

export function listPreorders(outletId: number): Preorder[] {
  return query<Preorder>(
    `SELECT t.id, t.invoice_number, t.transaction_date, t.preorder_deadline,
            t.total_amount, t.down_payment_received,
            (t.total_amount - t.down_payment_received) AS remaining,
            t.member_id, t.status, m.name AS member_name
     FROM transactions t
     LEFT JOIN members m ON m.id = t.member_id
     WHERE t.outlet_id = ? AND t.is_preorder = 1 AND t.status IN ('PREPARING','READY')
     ORDER BY t.preorder_deadline IS NULL, t.preorder_deadline ASC, t.id DESC`,
    [outletId],
  )
}

export function preorderItems(transactionId: number): PreorderItem[] {
  return query<PreorderItem>(
    `SELECT p.name, d.quantity, d.subtotal
     FROM transaction_details d
     JOIN products p ON p.id = d.product_id
     WHERE d.transaction_id = ?
     ORDER BY d.id`,
    [transactionId],
  )
}

/**
 * Lunasi pre-order saat pengambilan barang:
 *  - potong stok fisik outlet untuk item pesanan,
 *  - catat pembayaran pelunasan ke transaction_payments,
 *  - akumulasi poin member (atas nilai transaksi) + audit,
 *  - tandai transaksi COMPLETED.
 * Semua dalam satu transaksi SQL.
 */
export async function settlePreorder(
  transactionId: number,
  outletId: number,
  payments: PaymentInput[],
  pointsPerAmount: number,
): Promise<{ pointsEarned: number }> {
  const tx = query<{ total_amount: number; member_id: number | null; status: string }>(
    'SELECT total_amount, member_id, status FROM transactions WHERE id = ?',
    [transactionId],
  )[0]
  if (!tx) throw new Error('Pre-order tidak ditemukan.')
  if (tx.status === 'COMPLETED') throw new Error('Pre-order sudah dilunasi.')

  const items = query<{ product_id: number; quantity: number }>(
    'SELECT product_id, quantity FROM transaction_details WHERE transaction_id = ?',
    [transactionId],
  )
  const pointsEarned =
    tx.member_id && pointsPerAmount ? Math.floor(tx.total_amount / pointsPerAmount) : 0

  const db = getDb()
  const whId = defaultWarehouseId(outletId)
  db.run('BEGIN')
  try {
    for (const it of items) {
      db.run(
        `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = stock - ?`,
        [outletId, whId, it.product_id, -it.quantity, it.quantity],
      )
    }
    for (const p of payments) {
      db.run(
        `INSERT INTO transaction_payments
           (transaction_id, payment_method, amount_paid, tendered_amount, change_amount,
            voucher_id, qris_reference_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          p.method,
          p.amountPaid,
          p.tenderedAmount,
          p.changeAmount ?? 0,
          p.voucherId ?? null,
          p.qrisReference ?? null,
        ],
      )
    }
    if (tx.member_id && pointsEarned > 0) {
      db.run('UPDATE members SET points = points + ? WHERE id = ?', [pointsEarned, tx.member_id])
      db.run(
        `INSERT INTO point_logs (member_id, transaction_id, points_change, change_reason)
         VALUES (?, ?, ?, 'TRANSACTION_EARNED')`,
        [tx.member_id, transactionId, pointsEarned],
      )
    }
    db.run(
      `UPDATE transactions SET status = 'COMPLETED', points_earned = ? WHERE id = ?`,
      [pointsEarned, transactionId],
    )
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }

  await persist()
  publish('order:update')
  return { pointsEarned }
}
