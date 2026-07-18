import { getDb, persist, query } from '../../db/database'

export interface TxSummary {
  id: number
  invoice_number: string
  transaction_date: string
  order_source: string
  facility_type: string
  table_number: string | null
  total_amount: number
  points_earned: number
  member_id: number | null
  member_name: string | null
  status: string
}

export interface TxItem {
  product_id: number
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export function listTransactions(outletId: number, limit = 40): TxSummary[] {
  return query<TxSummary>(
    `SELECT t.id, t.invoice_number, t.transaction_date, t.order_source, t.facility_type,
            t.table_number, t.total_amount, t.points_earned, t.member_id, t.status,
            m.name AS member_name
     FROM transactions t
     LEFT JOIN members m ON m.id = t.member_id
     WHERE t.outlet_id = ? AND t.status IN ('COMPLETED','REFUNDED')
     ORDER BY t.id DESC
     LIMIT ?`,
    [outletId, limit],
  )
}

export interface TxPayment {
  payment_method: string
  amount_paid: number
  tendered_amount: number
  change_amount: number
  qris_reference_number: string | null
}

export function transactionPayments(transactionId: number): TxPayment[] {
  return query<TxPayment>(
    `SELECT payment_method, amount_paid, tendered_amount, change_amount, qris_reference_number
     FROM transaction_payments WHERE transaction_id = ? ORDER BY id`,
    [transactionId],
  )
}

export function transactionItems(transactionId: number): TxItem[] {
  return query<TxItem>(
    `SELECT d.product_id, p.name, d.quantity, d.unit_price, d.subtotal
     FROM transaction_details d
     JOIN products p ON p.id = d.product_id
     WHERE d.transaction_id = ?
     ORDER BY d.id`,
    [transactionId],
  )
}

function refundNumber(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `RF-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(
    now.getMinutes(),
  )}${p(now.getSeconds())}`
}

export interface RefundResult {
  refundInvoice: string
  totalRefund: number
  pointsReverted: number
}

/**
 * Refund penuh sebuah transaksi lunas:
 *  - catat refunds + refund_details,
 *  - kembalikan stok fisik outlet,
 *  - tandai transaksi REFUNDED,
 *  - koreksi poin member (jika ada) + audit point_logs.
 * Semua dalam satu transaksi SQL.
 */
export async function processRefund(
  transactionId: number,
  outletId: number,
  reason: string,
): Promise<RefundResult> {
  const tx = query<TxSummary>(
    `SELECT id, total_amount, points_earned, member_id, status FROM transactions WHERE id = ?`,
    [transactionId],
  )[0]
  if (!tx) throw new Error('Transaksi tidak ditemukan.')
  if (tx.status !== 'COMPLETED') throw new Error('Hanya transaksi lunas yang dapat direfund.')

  const items = transactionItems(transactionId)
  const db = getDb()
  const refundInvoice = refundNumber(new Date())
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO refunds (transaction_id, outlet_id, refund_invoice_number, refund_reason, total_refund_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [transactionId, outletId, refundInvoice, reason.trim() || null, tx.total_amount],
    )
    const refundId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    for (const it of items) {
      db.run(
        `INSERT INTO refund_details (refund_id, product_id, quantity_returned, refund_unit_price)
         VALUES (?, ?, ?, ?)`,
        [refundId, it.product_id, it.quantity, it.unit_price],
      )
      // Kembalikan stok fisik.
      db.run(
        `UPDATE outlet_stocks SET stock = stock + ? WHERE outlet_id = ? AND product_id = ?`,
        [it.quantity, outletId, it.product_id],
      )
    }

    db.run(`UPDATE transactions SET status = 'REFUNDED' WHERE id = ?`, [transactionId])

    // Koreksi poin member yang sempat diperoleh dari transaksi ini.
    let pointsReverted = 0
    if (tx.member_id && tx.points_earned > 0) {
      pointsReverted = tx.points_earned
      db.run('UPDATE members SET points = points - ? WHERE id = ?', [pointsReverted, tx.member_id])
      db.run(
        `INSERT INTO point_logs (member_id, transaction_id, refund_id, points_change, change_reason)
         VALUES (?, ?, ?, ?, 'REFUND_DEDUCTION')`,
        [tx.member_id, transactionId, refundId, -pointsReverted],
      )
    }
    db.run('COMMIT')

    await persist()
    return { refundInvoice, totalRefund: tx.total_amount, pointsReverted }
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}
