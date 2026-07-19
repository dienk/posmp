import { query } from '../../db/database'
import type { DateRange } from './dateRange'

export interface SalesSummary {
  total_sales: number
  tx_count: number
  items_sold: number
  avg_ticket: number
}

export interface SourceRow {
  order_source: string
  tx_count: number
  total: number
}

export interface TopProduct {
  name: string
  qty: number
  revenue: number
}

/** Rentang default = hari ini (waktu lokal) bila filter tak diberikan. */
const TODAY = `date('now','localtime')`

/** Klausa filter tanggal transaksi; kembalikan SQL + params (from..to inklusif). */
function rangeClause(col: string, range?: DateRange): { sql: string; params: string[] } {
  if (!range) return { sql: `date(${col}) = ${TODAY}`, params: [] }
  return { sql: `date(${col}) BETWEEN ? AND ?`, params: [range.from, range.to] }
}

export function salesSummary(outletId: number, range?: DateRange): SalesSummary {
  const r1 = rangeClause('transaction_date', range)
  const s = query<{ total_sales: number; tx_count: number; avg_ticket: number }>(
    `SELECT COALESCE(SUM(total_amount),0) AS total_sales,
            COUNT(*) AS tx_count,
            COALESCE(AVG(total_amount),0) AS avg_ticket
     FROM transactions
     WHERE outlet_id = ? AND status = 'COMPLETED' AND ${r1.sql}`,
    [outletId, ...r1.params],
  )[0]
  const r2 = rangeClause('t.transaction_date', range)
  const items = query<{ n: number }>(
    `SELECT COALESCE(SUM(d.quantity),0) AS n
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND ${r2.sql}`,
    [outletId, ...r2.params],
  )[0]
  return {
    total_sales: s.total_sales,
    tx_count: s.tx_count,
    items_sold: items.n,
    avg_ticket: Math.round(s.avg_ticket),
  }
}

/** @deprecated pakai salesSummary(outletId, computeRange('day')). */
export const todaySummary = (outletId: number): SalesSummary => salesSummary(outletId)

export function salesBySource(outletId: number, range?: DateRange): SourceRow[] {
  const r = rangeClause('transaction_date', range)
  return query<SourceRow>(
    `SELECT order_source, COUNT(*) AS tx_count, COALESCE(SUM(total_amount),0) AS total
     FROM transactions
     WHERE outlet_id = ? AND status = 'COMPLETED' AND ${r.sql}
     GROUP BY order_source
     ORDER BY total DESC`,
    [outletId, ...r.params],
  )
}

export function topProducts(outletId: number, range?: DateRange, limit = 5): TopProduct[] {
  const r = rangeClause('t.transaction_date', range)
  return query<TopProduct>(
    `SELECT p.name,
            SUM(d.quantity) AS qty,
            SUM(d.subtotal) AS revenue
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN products p ON p.id = d.product_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND ${r.sql}
     GROUP BY p.id
     ORDER BY qty DESC
     LIMIT ?`,
    [outletId, ...r.params, limit],
  )
}

interface ExportRow {
  invoice_number: string
  transaction_date: string
  order_source: string
  facility_type: string
  table_number: string | null
  subtotal_amount: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  status: string
}

/** Bangun string CSV dari seluruh transaksi outlet (Fasilitas Ekspor, PRD 4.8). */
export function exportTransactionsCsv(outletId: number): string {
  const rows = query<ExportRow>(
    `SELECT invoice_number, transaction_date, order_source, facility_type, table_number,
            subtotal_amount, discount_amount, tax_amount, total_amount, status
     FROM transactions
     WHERE outlet_id = ?
     ORDER BY transaction_date DESC`,
    [outletId],
  )
  const header = [
    'Invoice',
    'Tanggal',
    'Sumber',
    'Fasilitas',
    'Meja',
    'Subtotal',
    'Diskon',
    'Pajak',
    'Total',
    'Status',
  ]
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((r) =>
    [
      r.invoice_number,
      r.transaction_date,
      r.order_source,
      r.facility_type,
      r.table_number ?? '',
      r.subtotal_amount,
      r.discount_amount,
      r.tax_amount,
      r.total_amount,
      r.status,
    ]
      .map(esc)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
