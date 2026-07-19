import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import {
  salesBySource,
  salesSummary,
  topProducts,
  type SalesSummary,
  type SourceRow,
  type TopProduct,
} from './reportsRepository'
import {
  computeRange,
  formatRangeLabel,
  RANGE_PRESETS,
  type RangePreset,
} from './dateRange'

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}

export default function DashboardPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [top, setTop] = useState<TopProduct[]>([])

  // Filter tanggal.
  const [preset, setPreset] = useState<RangePreset>('day')
  const today = useMemo(() => computeRange('day').from, [])
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const range = useMemo(
    () => computeRange(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  )

  const reload = useCallback(() => {
    setSummary(salesSummary(outletId, range))
    setSources(salesBySource(outletId, range))
    setTop(topProducts(outletId, range))
  }, [outletId, range])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  const maxQty = useMemo(() => Math.max(1, ...top.map((t) => t.qty)), [top])
  const maxSource = useMemo(() => Math.max(1, ...sources.map((s) => s.total)), [sources])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Dashboard</h1>
        <span className="hidden text-xs text-ink-soft sm:inline">
          Ringkasan · {formatRangeLabel(range)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-soft">📅 Periode</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
              />
              <span className="text-xs text-ink-soft">s/d</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
              />
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Penjualan" value={formatRupiah(summary?.total_sales ?? 0)} accent />
          <Kpi label="Transaksi" value={String(summary?.tx_count ?? 0)} />
          <Kpi label="Item Terjual" value={String(summary?.items_sold ?? 0)} />
          <Kpi label="Rata-rata / Nota" value={formatRupiah(summary?.avg_ticket ?? 0)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Penjualan per Sumber
            </h2>
            {sources.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">
                Belum ada penjualan pada periode ini.
              </p>
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
