import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import {
  exportTransactionsCsv,
  salesBySource,
  todaySummary,
  topProducts,
  type SalesSummary,
  type SourceRow,
  type TopProduct,
} from './reportsRepository'

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}

export default function ReportsPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [top, setTop] = useState<TopProduct[]>([])

  const reload = useCallback(() => {
    setSummary(todaySummary(outletId))
    setSources(salesBySource(outletId))
    setTop(topProducts(outletId))
  }, [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  const maxQty = useMemo(() => Math.max(1, ...top.map((t) => t.qty)), [top])
  const maxSource = useMemo(() => Math.max(1, ...sources.map((s) => s.total)), [sources])

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
        <h1 className="text-lg font-bold text-ink">Dashboard & Laporan</h1>
        <span className="text-xs text-ink-soft">Ringkasan hari ini</span>
        <button
          onClick={handleExport}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          ⬇ Ekspor CSV
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Penjualan Hari Ini" value={formatRupiah(summary?.total_sales ?? 0)} accent />
          <Kpi label="Transaksi" value={String(summary?.tx_count ?? 0)} />
          <Kpi label="Item Terjual" value={String(summary?.items_sold ?? 0)} />
          <Kpi label="Rata-rata / Nota" value={formatRupiah(summary?.avg_ticket ?? 0)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Penjualan per sumber */}
          <section className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Penjualan per Sumber
            </h2>
            {sources.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Belum ada penjualan hari ini.</p>
            ) : (
              <ul className="space-y-3">
                {sources.map((s) => (
                  <li key={s.order_source}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-ink">
                        {SOURCE_LABEL[s.order_source] ?? s.order_source}
                        <span className="ml-2 text-xs text-ink-soft">{s.tx_count} tx</span>
                      </span>
                      <span className="font-semibold text-ink">{formatRupiah(s.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-brand-strong"
                        style={{ width: `${(s.total / maxSource) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Produk terlaris */}
          <section className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Produk Terlaris
            </h2>
            {top.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Belum ada data.</p>
            ) : (
              <ul className="space-y-3">
                {top.map((p) => (
                  <li key={p.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-ink-soft">
                        {p.qty} pcs · {formatRupiah(p.revenue)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-surface"
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-card p-4 shadow-card ${accent ? 'bg-status-occupied text-white' : 'bg-white'}`}>
      <p className={`text-xs ${accent ? 'text-white/80' : 'text-ink-soft'}`}>{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${accent ? 'text-white' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
