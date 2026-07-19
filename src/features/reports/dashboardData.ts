import { query } from '../../db/database'
import type { DateRange } from './dateRange'

type Num = { n: number }
const n = (rows: { n: number }[]): number => rows[0]?.n ?? 0

/** Klausa filter tanggal (BETWEEN from AND to) untuk kolom transaksi. */
function range(col: string, r?: DateRange): { sql: string; params: string[] } {
  if (!r) return { sql: `date(${col}) = date('now','localtime')`, params: [] }
  return { sql: `date(${col}) BETWEEN ? AND ?`, params: [r.from, r.to] }
}

export interface PaymentRow {
  method: string
  total: number
}
export function paymentsBreakdown(outletId: number, r?: DateRange): PaymentRow[] {
  const rc = range('t.transaction_date', r)
  return query<PaymentRow>(
    `SELECT tp.payment_method AS method, COALESCE(SUM(tp.amount_paid),0) AS total
     FROM transaction_payments tp JOIN transactions t ON t.id = tp.transaction_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND ${rc.sql}
     GROUP BY tp.payment_method ORDER BY total DESC`,
    [outletId, ...rc.params],
  )
}

export interface MemberStats {
  total: number
  active: number
  points: number
  balance: number
}
export function memberStats(): MemberStats {
  return {
    total: n(query<Num>('SELECT COUNT(*) AS n FROM members')),
    active: n(query<Num>("SELECT COUNT(*) AS n FROM members WHERE status = 'ACTIVE'")),
    points: n(query<Num>('SELECT COALESCE(SUM(points),0) AS n FROM members')),
    balance: n(query<Num>('SELECT COALESCE(SUM(balance),0) AS n FROM members')),
  }
}

export interface StockStats {
  products: number
  lowStock: number
  stockValue: number
  units: number
}
export function stockStats(outletId: number): StockStats {
  return {
    products: n(query<Num>('SELECT COUNT(*) AS n FROM products WHERE is_active = 1')),
    units: n(
      query<Num>('SELECT COALESCE(SUM(stock),0) AS n FROM outlet_stocks WHERE outlet_id = ?', [
        outletId,
      ]),
    ),
    stockValue: n(
      query<Num>(
        `SELECT COALESCE(SUM(os.stock * p.cost_price),0) AS n
         FROM outlet_stocks os JOIN products p ON p.id = os.product_id
         WHERE os.outlet_id = ?`,
        [outletId],
      ),
    ),
    lowStock: n(
      query<Num>(
        `SELECT COUNT(*) AS n FROM products p WHERE p.is_active = 1 AND
           COALESCE((SELECT SUM(stock) FROM outlet_stocks WHERE outlet_id = ? AND product_id = p.id),0) <= p.min_stock`,
        [outletId],
      ),
    ),
  }
}

export interface CashStatus {
  open: boolean
  shift: string | null
  openingBalance: number
  cashSalesToday: number
}
export function cashStatus(outletId: number): CashStatus {
  const s = query<{ shift_name: string | null; opening_balance: number; opened_at: string }>(
    "SELECT shift_name, opening_balance, opened_at FROM cash_sessions WHERE outlet_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1",
    [outletId],
  )[0]
  const cashToday = n(
    query<Num>(
      `SELECT COALESCE(SUM(tp.amount_paid),0) AS n
       FROM transaction_payments tp JOIN transactions t ON t.id = tp.transaction_id
       WHERE t.outlet_id = ? AND t.status='COMPLETED' AND tp.payment_method='CASH'
         AND date(t.transaction_date) = date('now','localtime')`,
      [outletId],
    ),
  )
  return {
    open: !!s,
    shift: s?.shift_name ?? null,
    openingBalance: s?.opening_balance ?? 0,
    cashSalesToday: cashToday,
  }
}

export interface VoucherStats {
  active: number
  used: number
  total: number
}
export function voucherStats(): VoucherStats {
  return {
    total: n(query<Num>('SELECT COUNT(*) AS n FROM vouchers')),
    active: n(query<Num>('SELECT COUNT(*) AS n FROM vouchers WHERE is_active = 1')),
    used: n(query<Num>('SELECT COALESCE(SUM(used_count),0) AS n FROM vouchers')),
  }
}

export interface OtherTxStats {
  refundCount: number
  refundTotal: number
  preorderPending: number
  preorderDp: number
  installmentCount: number
  installmentRemaining: number
}
export function otherTxStats(outletId: number, r?: DateRange): OtherTxStats {
  const rc = range('refunded_at', r)
  return {
    refundCount: n(
      query<Num>(`SELECT COUNT(*) AS n FROM refunds WHERE outlet_id = ? AND ${rc.sql}`, [
        outletId,
        ...rc.params,
      ]),
    ),
    refundTotal: n(
      query<Num>(
        `SELECT COALESCE(SUM(total_refund_amount),0) AS n FROM refunds WHERE outlet_id = ? AND ${rc.sql}`,
        [outletId, ...rc.params],
      ),
    ),
    preorderPending: n(
      query<Num>(
        "SELECT COUNT(*) AS n FROM transactions WHERE outlet_id = ? AND is_preorder = 1 AND status != 'COMPLETED'",
        [outletId],
      ),
    ),
    preorderDp: n(
      query<Num>(
        "SELECT COALESCE(SUM(down_payment_received),0) AS n FROM transactions WHERE outlet_id = ? AND is_preorder = 1 AND status != 'COMPLETED'",
        [outletId],
      ),
    ),
    installmentCount: n(
      query<Num>("SELECT COUNT(*) AS n FROM transaction_installments WHERE status != 'PAID'"),
    ),
    installmentRemaining: n(
      query<Num>(
        "SELECT COALESCE(SUM(remaining_balance),0) AS n FROM transaction_installments WHERE status != 'PAID'",
      ),
    ),
  }
}

export interface OpsStats {
  occupied: number
  empty: number
  waitingBill: number
  queue: number
  kds: number
}
export function opsStats(outletId: number): OpsStats {
  return {
    occupied: n(
      query<Num>(
        "SELECT COUNT(*) AS n FROM dining_tables WHERE outlet_id = ? AND status = 'OCCUPIED'",
        [outletId],
      ),
    ),
    empty: n(
      query<Num>("SELECT COUNT(*) AS n FROM dining_tables WHERE outlet_id = ? AND status = 'EMPTY'", [
        outletId,
      ]),
    ),
    waitingBill: n(
      query<Num>(
        "SELECT COUNT(*) AS n FROM dining_tables WHERE outlet_id = ? AND status = 'WAITING_BILL'",
        [outletId],
      ),
    ),
    queue: n(
      query<Num>(
        "SELECT COUNT(*) AS n FROM transactions WHERE outlet_id = ? AND queue_number IS NOT NULL AND status IN ('PREPARING','READY')",
        [outletId],
      ),
    ),
    kds: n(
      query<Num>(
        "SELECT COUNT(*) AS n FROM kds_tickets WHERE outlet_id = ? AND status IN ('PREPARING','READY')",
        [outletId],
      ),
    ),
  }
}

export interface RecentTx {
  invoice_number: string
  transaction_date: string
  total_amount: number
  status: string
}
export function recentTransactions(outletId: number, limit = 6): RecentTx[] {
  return query<RecentTx>(
    `SELECT invoice_number, transaction_date, total_amount, status
     FROM transactions WHERE outlet_id = ? AND status IN ('COMPLETED','REFUNDED')
     ORDER BY id DESC LIMIT ?`,
    [outletId, limit],
  )
}
