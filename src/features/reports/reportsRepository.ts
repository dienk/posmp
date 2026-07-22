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

export interface ProfitLoss {
  revenue: number // penjualan item (SUM subtotal, sudah dikurangi diskon item)
  discount: number // diskon transaksi (voucher + manual)
  netRevenue: number // penjualan bersih = revenue − discount (belum termasuk pajak/servis)
  cogs: number // HPP / modal barang terjual (dari cost_price; paket dipecah ke komponen)
  grossProfit: number // laba kotor = netRevenue − cogs
  margin: number // grossProfit / netRevenue × 100 (%)
}

export interface ProductProfit {
  name: string
  qty: number
  revenue: number
  cogs: number
  profit: number
  margin: number
}

/**
 * Ekspresi SQL HPP per satu unit produk (dasar). Untuk paket (is_bundle=1),
 * modal = Σ(qty komponen × cost_price komponen); selain itu = cost_price produk.
 * Dipakai bersama alias tabel `p` (products) pada query detail transaksi.
 */
const UNIT_COST_SQL = `CASE WHEN COALESCE(p.is_bundle,0) = 1
  THEN COALESCE((SELECT SUM(bi.quantity * COALESCE(cp.cost_price,0))
                 FROM product_bundle_items bi
                 JOIN products cp ON cp.id = bi.component_product_id
                 WHERE bi.bundle_product_id = p.id), 0)
  ELSE COALESCE(p.cost_price,0) END`

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

/**
 * Laporan laba rugi (estimasi) untuk rentang tanggal: menghubungkan modal
 * produk (cost_price) dengan harga jual. Hanya transaksi COMPLETED. HPP memakai
 * cost_price produk saat ini (paket dipecah ke komponen).
 */
export function profitLoss(outletId: number, range?: DateRange): ProfitLoss {
  const rd = rangeClause('t.transaction_date', range)
  const line = query<{ revenue: number; cogs: number }>(
    `SELECT COALESCE(SUM(d.subtotal),0) AS revenue,
            COALESCE(SUM(d.quantity * (${UNIT_COST_SQL})),0) AS cogs
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN products p ON p.id = d.product_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND ${rd.sql}`,
    [outletId, ...rd.params],
  )[0]
  const rt = rangeClause('transaction_date', range)
  const disc = query<{ discount: number }>(
    `SELECT COALESCE(SUM(discount_amount),0) AS discount
     FROM transactions
     WHERE outlet_id = ? AND status = 'COMPLETED' AND ${rt.sql}`,
    [outletId, ...rt.params],
  )[0]
  const revenue = line?.revenue ?? 0
  const cogs = line?.cogs ?? 0
  const discount = disc?.discount ?? 0
  const netRevenue = revenue - discount
  const grossProfit = netRevenue - cogs
  return {
    revenue,
    discount,
    netRevenue,
    cogs,
    grossProfit,
    margin: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
  }
}

/** Produk paling menguntungkan (laba = penjualan − HPP) untuk rentang tanggal. */
export function topProfitProducts(outletId: number, range?: DateRange, limit = 5): ProductProfit[] {
  const r = rangeClause('t.transaction_date', range)
  const rows = query<{ name: string; qty: number; revenue: number; cogs: number }>(
    `SELECT p.name,
            SUM(d.quantity) AS qty,
            SUM(d.subtotal) AS revenue,
            SUM(d.quantity * (${UNIT_COST_SQL})) AS cogs
     FROM transaction_details d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN products p ON p.id = d.product_id
     WHERE t.outlet_id = ? AND t.status = 'COMPLETED' AND ${r.sql}
     GROUP BY p.id
     ORDER BY (SUM(d.subtotal) - SUM(d.quantity * (${UNIT_COST_SQL}))) DESC
     LIMIT ?`,
    [outletId, ...r.params, limit],
  )
  return rows.map((x) => {
    const profit = x.revenue - x.cogs
    return {
      name: x.name,
      qty: x.qty,
      revenue: x.revenue,
      cogs: x.cogs,
      profit,
      margin: x.revenue > 0 ? (profit / x.revenue) * 100 : 0,
    }
  })
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
