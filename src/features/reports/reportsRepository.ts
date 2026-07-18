import { query } from '../../db/database'

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

const TODAY = `date(transaction_date) = date('now','localtime')`

export function todaySummary(outletId: number): SalesSummary {
  const s = query<{ total_sales: number; tx_count: number; avg_ticket: number }>(
    `SELECT COALESCE(SUM(total_amount),0) AS total_sales,
            COUNT(*) AS tx_count,
            COALESCE(AVG(total_amount),0) AS avg_ticket
     FROM transactions
     WHERE outlet_id = ? AND status = 'COMPLETED' AND ${TODAY}`,
    [outletId],
  )[0]
  const items = query<{ n: number }>(
    `SELECT COALESCE(SUM(d.quantity),0) AS n
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND date(t.transaction_date) = date('now','localtime')`,
    [outletId],
  )[0]
  return {
    total_sales: s.total_sales,
    tx_count: s.tx_count,
    items_sold: items.n,
    avg_ticket: Math.round(s.avg_ticket),
  }
}

export function salesBySource(outletId: number): SourceRow[] {
  return query<SourceRow>(
    `SELECT order_source, COUNT(*) AS tx_count, COALESCE(SUM(total_amount),0) AS total
     FROM transactions
     WHERE outlet_id = ? AND status = 'COMPLETED' AND ${TODAY}
     GROUP BY order_source
     ORDER BY total DESC`,
    [outletId],
  )
}

export function topProducts(outletId: number, limit = 5): TopProduct[] {
  return query<TopProduct>(
    `SELECT p.name,
            SUM(d.quantity) AS qty,
            SUM(d.subtotal) AS revenue
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN products p ON p.id = d.product_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED'
       AND date(t.transaction_date) = date('now','localtime')
     GROUP BY p.id
     ORDER BY qty DESC
     LIMIT ?`,
    [outletId, limit],
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
