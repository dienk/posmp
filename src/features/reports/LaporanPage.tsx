import { useCallback, useEffect, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { listTransactions, type TxSummary } from '../history/historyRepository'
import { exportTransactionsCsv, todaySummary, type SalesSummary } from './reportsRepository'

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}

export default function LaporanPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [rows, setRows] = useState<TxSummary[]>([])
  const [summary, setSummary] = useState<SalesSummary | null>(null)

  const reload = useCallback(() => {
    setRows(listTransactions(outletId, 100))
    setSummary(todaySummary(outletId))
  }, [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  const handleExport = () => {
    const csv = exportTransactionsCsv(outletId)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-transaksi-outlet${outletId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Laporan</h1>
        <span className="text-xs text-ink-soft">
          Penjualan hari ini: {formatRupiah(summary?.total_sales ?? 0)} · {summary?.tx_count ?? 0} tx
        </span>
        <button
          onClick={handleExport}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          ⬇ Ekspor CSV
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="overflow-hidden rounded-card bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-black/5 hover:bg-background">
                  <td className="px-4 py-3 font-semibold text-ink">{t.invoice_number}</td>
                  <td className="px-4 py-3 text-ink-soft">{t.transaction_date}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {SOURCE_LABEL[t.order_source] ?? t.order_source}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{t.member_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {formatRupiah(t.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                        (t.status === 'REFUNDED'
                          ? 'bg-status-occupied/15 text-status-occupied'
                          : 'bg-status-empty/15 text-status-empty')
                      }
                    >
                      {t.status === 'REFUNDED' ? 'Refunded' : 'Lunas'}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Belum ada transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
