import { execute, query } from '../../db/database'
import { publish } from '../../lib/realtime'

export type CookStatus = 'PENDING' | 'COOKING' | 'COOKED' | 'SERVED'

export interface KdsItem {
  detail_id: number
  name: string
  quantity: number
  notes: string | null
  cooking_status: CookStatus
}

export interface KdsTicket {
  id: number
  transaction_id: number
  invoice_number: string
  table_number: string | null
  order_source: string
  ordered_at: string
  items: KdsItem[]
}

/** Ambil semua tiket dapur aktif (PREPARING) beserta itemnya, urut FIFO. */
export function fetchKdsTickets(outletId: number): KdsTicket[] {
  const tickets = query<Omit<KdsTicket, 'items'>>(
    `SELECT k.id, k.transaction_id, k.ordered_at, k.table_number,
            t.invoice_number, t.order_source
     FROM kds_tickets k
     JOIN transactions t ON t.id = k.transaction_id
     WHERE k.outlet_id = ? AND k.status = 'PREPARING'
     ORDER BY k.ordered_at ASC, k.id ASC`,
    [outletId],
  )

  return tickets.map((t) => ({
    ...t,
    items: query<KdsItem>(
      `SELECT d.id AS detail_id, p.name, d.quantity, d.notes, d.cooking_status
       FROM transaction_details d
       JOIN products p ON p.id = d.product_id
       WHERE d.transaction_id = ?
       ORDER BY d.id`,
      [t.transaction_id],
    ),
  }))
}

/** Coret / batalkan coret satu item (COOKING <-> COOKED). */
export async function toggleItemCooked(detailId: number, done: boolean): Promise<void> {
  await execute('UPDATE transaction_details SET cooking_status = ? WHERE id = ?', [
    done ? 'COOKED' : 'COOKING',
    detailId,
  ])
  publish('kds:update')
}

/** Tandai seluruh tiket siap saji: item -> SERVED, tiket -> READY, transaksi -> READY. */
export async function markTicketReady(ticketId: number, transactionId: number): Promise<void> {
  await execute(
    `UPDATE transaction_details SET cooking_status = 'SERVED' WHERE transaction_id = ?`,
    [transactionId],
  )
  await execute(`UPDATE kds_tickets SET status = 'READY' WHERE id = ?`, [ticketId])
  await execute(`UPDATE transactions SET status = 'READY' WHERE id = ? AND status <> 'COMPLETED'`, [
    transactionId,
  ])
  publish('kds:update')
  publish('queue:update')
}
