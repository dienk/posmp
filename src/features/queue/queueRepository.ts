import { execute, query } from '../../db/database'
import { generateInvoiceNumber } from '../../lib/format'
import { publish } from '../../lib/realtime'
import type { FacilityType } from '../../types'

export type QueueStatus = 'PREPARING' | 'READY' | 'COMPLETED'

export interface QueueTicket {
  id: number
  queue_number: string
  facility_type: FacilityType
  status: QueueStatus
  created_at: string
}

/** Prefix antrean berdasarkan tipe pesanan: A=Dine-in, B=Takeaway, C=Delivery. */
const PREFIX: Record<FacilityType, string> = {
  DINE_IN: 'A',
  TAKEAWAY: 'B',
  DELIVERY: 'C',
}

/**
 * Terbitkan nomor antrean baru untuk hari ini.
 * Nomor tersimpan sebagai transaksi ringan (queue_number + status PREPARING),
 * sesuai skema PRD di mana antrean melekat pada transaksi.
 */
export async function issueQueue(outletId: number, facility: FacilityType): Promise<string> {
  const prefix = PREFIX[facility]
  const todayCount = query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions
     WHERE outlet_id = ? AND queue_number LIKE ?
       AND date(transaction_date) = date('now','localtime')`,
    [outletId, `${prefix}-%`],
  )[0].n
  const queueNumber = `${prefix}-${String(todayCount + 1).padStart(2, '0')}`

  await execute(
    `INSERT INTO transactions
       (outlet_id, invoice_number, facility_type, order_source, queue_number,
        subtotal_amount, total_amount, status)
     VALUES (?, ?, ?, 'POS_OFFLINE', ?, 0, 0, 'PREPARING')`,
    [outletId, generateInvoiceNumber(), facility, queueNumber],
  )
  publish('queue:update')
  return queueNumber
}

export function fetchActiveQueue(outletId: number): QueueTicket[] {
  return query<QueueTicket>(
    `SELECT id, queue_number, facility_type, status, created_at
     FROM transactions
     WHERE outlet_id = ? AND queue_number IS NOT NULL
       AND status IN ('PREPARING','READY')
       AND date(transaction_date) = date('now','localtime')
     ORDER BY id`,
    [outletId],
  )
}

export async function setQueueStatus(id: number, status: QueueStatus): Promise<void> {
  await execute('UPDATE transactions SET status = ? WHERE id = ?', [status, id])
  publish('queue:update')
}
