import { execute, query } from '../../db/database'
import { publish } from '../../lib/realtime'

export interface CashSession {
  id: number
  outlet_id: number
  shift_name: string | null
  opened_at: string
  opening_balance: number
  closed_at: string | null
  closing_balance: number | null
  cash_sales: number | null
  expected_balance: number | null
  difference: number | null
  note: string | null
  status: 'OPEN' | 'CLOSED'
}

/** Sesi kas yang sedang terbuka pada outlet (maks. satu). */
export function getOpenSession(outletId: number): CashSession | null {
  return (
    query<CashSession>(
      "SELECT * FROM cash_sessions WHERE outlet_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1",
      [outletId],
    )[0] ?? null
  )
}

/** Penjualan tunai (pembayaran CASH pada transaksi COMPLETED) sejak `openedAt`. */
export function cashSalesSince(outletId: number, openedAt: string): number {
  return (
    query<{ s: number }>(
      `SELECT COALESCE(SUM(tp.amount_paid), 0) AS s
       FROM transaction_payments tp
       JOIN transactions t ON t.id = tp.transaction_id
       WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
         AND tp.payment_method = 'CASH'
         AND t.transaction_date >= ?`,
      [outletId, openedAt],
    )[0]?.s ?? 0
  )
}

/** Buka kas (catat saldo awal). Ditolak bila masih ada sesi terbuka. */
export async function openCash(
  outletId: number,
  openingBalance: number,
  shiftName?: string | null,
  note?: string | null,
): Promise<number> {
  if (getOpenSession(outletId)) {
    throw new Error('Masih ada sesi kas yang terbuka. Tutup kas dahulu.')
  }
  const id = await execute(
    `INSERT INTO cash_sessions (outlet_id, shift_name, opening_balance, note, status)
     VALUES (?, ?, ?, ?, 'OPEN')`,
    [outletId, shiftName?.trim() || null, Math.max(0, openingBalance), note?.trim() || null],
  )
  publish('order:update')
  return id
}

export interface CloseResult {
  cashSales: number
  expected: number
  difference: number
}

/** Tutup kas: hitung ekspektasi (saldo awal + penjualan tunai) & selisih. */
export async function closeCash(
  sessionId: number,
  closingBalance: number,
  note?: string | null,
): Promise<CloseResult> {
  const s = query<CashSession>('SELECT * FROM cash_sessions WHERE id = ?', [sessionId])[0]
  if (!s) throw new Error('Sesi kas tidak ditemukan.')
  if (s.status === 'CLOSED') throw new Error('Sesi kas sudah ditutup.')
  const cashSales = cashSalesSince(s.outlet_id, s.opened_at)
  const expected = s.opening_balance + cashSales
  const difference = closingBalance - expected
  await execute(
    `UPDATE cash_sessions
     SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, closing_balance = ?,
         cash_sales = ?, expected_balance = ?, difference = ?, note = COALESCE(?, note)
     WHERE id = ?`,
    [closingBalance, cashSales, expected, difference, note?.trim() || null, sessionId],
  )
  publish('order:update')
  return { cashSales, expected, difference }
}

/** Riwayat sesi kas outlet (terbaru dulu). */
export function listSessions(outletId: number, limit = 30): CashSession[] {
  return query<CashSession>(
    'SELECT * FROM cash_sessions WHERE outlet_id = ? ORDER BY id DESC LIMIT ?',
    [outletId, limit],
  )
}
