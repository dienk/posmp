import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting, isModuleEnabled } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { updateAppSettings } from '../settings/settingsRepository'
import { currentShift, getScheduleConfig, isOpenNow } from '../schedule/scheduleConfig'
import {
  profitLoss,
  salesBySource,
  salesSummary,
  topProducts,
  topProfitProducts,
  type ProductProfit,
  type ProfitLoss,
  type SalesSummary,
  type SourceRow,
  type TopProduct,
} from './reportsRepository'
import { computeRange, formatRangeLabel, RANGE_PRESETS, type RangePreset } from './dateRange'
import {
  DASHBOARD_WIDGETS,
  dashboardWidgetsToSettings,
  getDashboardWidgets,
} from './dashboardConfig'
import {
  cashStatus,
  memberStats,
  opsStats,
  otherTxStats,
  paymentsBreakdown,
  recentTransactions,
  stockStats,
  voucherStats,
  type CashStatus,
  type MemberStats,
  type OpsStats,
  type OtherTxStats,
  type PaymentRow,
  type RecentTx,
  type StockStats,
  type VoucherStats,
} from './dashboardData'

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}
const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  DEBIT_CARD: 'Debit',
  CREDIT_CARD: 'Kredit',
  VOUCHER: 'Voucher',
}

export default function DashboardPage() {
  const { settings, reloadSettings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const schedule = useMemo(() => getScheduleConfig(settings), [settings])

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [pl, setPl] = useState<ProfitLoss | null>(null)
  const [topProfit, setTopProfit] = useState<ProductProfit[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [top, setTop] = useState<TopProduct[]>([])
  const [pays, setPays] = useState<PaymentRow[]>([])
  const [members, setMembers] = useState<MemberStats | null>(null)
  const [stock, setStock] = useState<StockStats | null>(null)
  const [cash, setCash] = useState<CashStatus | null>(null)
  const [vouchers, setVouchers] = useState<VoucherStats | null>(null)
  const [other, setOther] = useState<OtherTxStats | null>(null)
  const [ops, setOps] = useState<OpsStats | null>(null)
  const [recent, setRecent] = useState<RecentTx[]>([])

  // Widget show/hide.
  const [enabled, setEnabled] = useState<Set<string>>(() => getDashboardWidgets(settings))
  const [showConfig, setShowConfig] = useState(false)

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
    setPl(profitLoss(outletId, range))
    setTopProfit(topProfitProducts(outletId, range))
    setSources(salesBySource(outletId, range))
    setTop(topProducts(outletId, range))
    setPays(paymentsBreakdown(outletId, range))
    setMembers(memberStats())
    setStock(stockStats(outletId))
    setCash(cashStatus(outletId))
    setVouchers(voucherStats())
    setOther(otherTxStats(outletId, range))
    setOps(opsStats(outletId))
    setRecent(recentTransactions(outletId))
  }, [outletId, range])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  const maxQty = useMemo(() => Math.max(1, ...top.map((t) => t.qty)), [top])
  const maxSource = useMemo(() => Math.max(1, ...sources.map((s) => s.total)), [sources])
  const maxPay = useMemo(() => Math.max(1, ...pays.map((p) => p.total)), [pays])
  const now = useMemo(() => new Date(), [])

  // Tampil bila widget aktif & modulnya (jika ada) aktif.
  const has = (key: string): boolean => {
    if (!enabled.has(key)) return false
    const w = DASHBOARD_WIDGETS.find((d) => d.key === key)
    if (w?.moduleKey && !isModuleEnabled(settings, w.moduleKey)) return false
    return true
  }

  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const saveConfig = async () => {
    await updateAppSettings(dashboardWidgetsToSettings([...enabled]))
    reloadSettings()
    setShowConfig(false)
  }

  const storeOpen = isOpenNow(schedule, now)
  const shift = currentShift(schedule, now)
  const anyStat = has('store_status') || has('cash') || has('members') || has('stock') || has('vouchers') || has('other_tx') || has('operations')
  const anyChart = has('by_source') || has('top_products') || has('payments')

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Dashboard</h1>
        <span className="hidden text-xs text-ink-soft sm:inline">
          Ringkasan · {formatRangeLabel(range)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowConfig(true)}>
            ⚙ Atur Widget
          </Button>
          <span className="text-xs font-medium text-ink-soft">📅 Periode</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className="rounded-lg border border-line/10 bg-panel px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
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
                className="rounded-lg border border-line/10 bg-panel px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
              />
              <span className="text-xs text-ink-soft">s/d</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-line/10 bg-panel px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
              />
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* KPI penjualan */}
        {has('kpi_sales') && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Penjualan" value={formatRupiah(summary?.total_sales ?? 0)} accent />
            <Kpi label="Transaksi" value={String(summary?.tx_count ?? 0)} />
            <Kpi label="Item Terjual" value={String(summary?.items_sold ?? 0)} />
            <Kpi label="Rata-rata / Nota" value={formatRupiah(summary?.avg_ticket ?? 0)} />
          </div>
        )}

        {/* Laba Rugi — modal vs harga jual */}
        {has('profit_loss') && pl && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* Ringkasan laba rugi */}
            <div className="rounded-card bg-panel p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                  Laba Rugi (Estimasi)
                </h2>
                <span
                  className={
                    'rounded-full px-2.5 py-0.5 text-xs font-bold ' +
                    (pl.grossProfit >= 0
                      ? 'bg-status-empty/15 text-status-empty'
                      : 'bg-status-occupied/15 text-status-occupied')
                  }
                >
                  Margin {pl.margin.toFixed(1)}%
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                <PlRow label="Penjualan (item)" value={formatRupiah(pl.revenue)} />
                {pl.discount > 0 && (
                  <PlRow label="Diskon transaksi" value={`− ${formatRupiah(pl.discount)}`} soft />
                )}
                <PlRow label="Penjualan bersih" value={formatRupiah(pl.netRevenue)} />
                <PlRow label="HPP / Modal" value={`− ${formatRupiah(pl.cogs)}`} soft />
                <div className="mt-1 flex items-baseline justify-between border-t border-line/10 pt-2">
                  <dt className="text-sm font-bold text-ink">Laba Kotor</dt>
                  <dd
                    className={
                      'text-xl font-extrabold ' +
                      (pl.grossProfit >= 0 ? 'text-status-empty' : 'text-status-occupied')
                    }
                  >
                    {formatRupiah(pl.grossProfit)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-ink-soft">
                Estimasi memakai modal (cost_price) produk saat ini. Paket bundling dihitung dari
                modal komponennya. Belum termasuk pajak, biaya layanan & biaya operasional.
              </p>
            </div>

            {/* Produk paling menguntungkan */}
            <div className="rounded-card bg-panel p-5 shadow-card">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Produk Paling Menguntungkan
              </h2>
              {topProfit.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-soft">Belum ada data.</p>
              ) : (
                <ul className="divide-y divide-line/5">
                  {topProfit.map((p) => (
                    <li key={p.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-ink-soft">
                          {p.qty} terjual · omzet {formatRupiah(p.revenue)}
                        </p>
                      </div>
                      <div className="whitespace-nowrap text-right">
                        <p
                          className={
                            'font-semibold ' +
                            (p.profit >= 0 ? 'text-status-empty' : 'text-status-occupied')
                          }
                        >
                          {formatRupiah(p.profit)}
                        </p>
                        <p className="text-xs text-ink-soft">margin {p.margin.toFixed(0)}%</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Kartu ringkasan modul */}
        {anyStat && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {has('store_status') && (
              <StatCard icon="🕒" title="Status Toko">
                <span
                  className={
                    'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ' +
                    (storeOpen ? 'bg-status-empty/15 text-status-empty' : 'bg-status-occupied/15 text-status-occupied')
                  }
                >
                  {storeOpen ? 'Buka' : 'Tutup'}
                </span>
                {schedule.shiftEnabled && (
                  <p className="mt-2 text-sm text-ink-soft">Shift: {shift?.name ?? '—'}</p>
                )}
              </StatCard>
            )}
            {has('cash') && cash && (
              <StatCard icon="💵" title="Saldo Kas">
                <span
                  className={
                    'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ' +
                    (cash.open ? 'bg-status-empty/15 text-status-empty' : 'bg-ink/10 text-ink-soft')
                  }
                >
                  {cash.open ? `Buka${cash.shift ? ' · ' + cash.shift : ''}` : 'Tertutup'}
                </span>
                <MiniStat label="Tunai hari ini" value={formatRupiah(cash.cashSalesToday)} />
              </StatCard>
            )}
            {has('members') && members && (
              <StatCard icon="⭐" title="Member">
                <p className="text-2xl font-extrabold text-ink">{members.total}</p>
                <MiniStat label="Aktif" value={String(members.active)} />
                <MiniStat label="Total poin" value={members.points.toLocaleString('id-ID')} />
              </StatCard>
            )}
            {has('stock') && stock && (
              <StatCard icon="📦" title="Stok">
                <p className="text-2xl font-extrabold text-ink">{stock.products}<span className="text-sm font-medium text-ink-soft"> produk</span></p>
                <MiniStat label="Stok menipis" value={String(stock.lowStock)} warn={stock.lowStock > 0} />
                <MiniStat label="Nilai stok" value={formatRupiah(stock.stockValue)} />
              </StatCard>
            )}
            {has('vouchers') && vouchers && (
              <StatCard icon="🎟️" title="Voucher">
                <p className="text-2xl font-extrabold text-ink">{vouchers.active}<span className="text-sm font-medium text-ink-soft"> aktif</span></p>
                <MiniStat label="Terpakai" value={String(vouchers.used)} />
              </StatCard>
            )}
            {has('other_tx') && other && (
              <StatCard icon="↩️" title="Refund · PO · Cicilan">
                <MiniStat label="Refund" value={`${other.refundCount} · ${formatRupiah(other.refundTotal)}`} />
                <MiniStat label="Pre-Order" value={`${other.preorderPending} pending`} />
                <MiniStat label="Cicilan sisa" value={formatRupiah(other.installmentRemaining)} />
              </StatCard>
            )}
            {has('operations') && ops && (
              <StatCard icon="🍽️" title="Operasional">
                <MiniStat label="Meja terisi" value={`${ops.occupied}`} />
                <MiniStat label="Antrean" value={`${ops.queue}`} />
                <MiniStat label="Tiket dapur" value={`${ops.kds}`} />
              </StatCard>
            )}
          </div>
        )}

        {/* Grafik */}
        {anyChart && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {has('by_source') && (
              <BarCard title="Penjualan per Sumber" empty={sources.length === 0}>
                {sources.map((s) => (
                  <Bar
                    key={s.order_source}
                    label={SOURCE_LABEL[s.order_source] ?? s.order_source}
                    hint={`${s.tx_count} tx`}
                    right={formatRupiah(s.total)}
                    pct={(s.total / maxSource) * 100}
                    color="bg-brand-strong"
                  />
                ))}
              </BarCard>
            )}
            {has('top_products') && (
              <BarCard title="Produk Terlaris" empty={top.length === 0}>
                {top.map((p) => (
                  <Bar
                    key={p.name}
                    label={p.name}
                    right={`${p.qty} · ${formatRupiah(p.revenue)}`}
                    pct={(p.qty / maxQty) * 100}
                    color="bg-surface"
                  />
                ))}
              </BarCard>
            )}
            {has('payments') && (
              <BarCard title="Metode Pembayaran" empty={pays.length === 0}>
                {pays.map((p) => (
                  <Bar
                    key={p.method}
                    label={METHOD_LABEL[p.method] ?? p.method}
                    right={formatRupiah(p.total)}
                    pct={(p.total / maxPay) * 100}
                    color="bg-status-empty"
                  />
                ))}
              </BarCard>
            )}
          </div>
        )}

        {/* Transaksi terkini */}
        {has('recent') && (
          <section className="overflow-hidden rounded-card bg-panel shadow-card">
            <h2 className="border-b border-line/5 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Transaksi Terkini
            </h2>
            <ul className="divide-y divide-line/5">
              {recent.map((t) => (
                <li key={t.invoice_number} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="font-semibold text-ink">{t.invoice_number}</span>
                  <span className="text-xs text-ink-soft">{t.transaction_date}</span>
                  <span className="font-semibold text-ink">{formatRupiah(t.total_amount)}</span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                      (t.status === 'REFUNDED'
                        ? 'bg-status-occupied/15 text-status-occupied'
                        : 'bg-status-empty/15 text-status-empty')
                    }
                  >
                    {t.status === 'REFUNDED' ? 'Refund' : 'Lunas'}
                  </span>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-ink-soft">Belum ada transaksi.</li>
              )}
            </ul>
          </section>
        )}
      </div>

      {/* Dialog atur widget */}
      {showConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setShowConfig(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-panel p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-ink">Atur Widget Dashboard</p>
              <button onClick={() => setShowConfig(false)} className="text-xl leading-none text-ink-soft hover:text-ink">
                ×
              </button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {DASHBOARD_WIDGETS.map((w) => (
                <label
                  key={w.key}
                  className="flex items-center justify-between rounded-lg bg-background px-3 py-2"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink">{w.label}</span>
                    <span className="block text-[11px] text-ink-soft">{w.desc}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled.has(w.key)}
                    onChange={() => toggle(w.key)}
                    className="h-5 w-5 accent-status-empty"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => setEnabled(new Set(DASHBOARD_WIDGETS.map((w) => w.key)))}
              >
                Pilih Semua
              </Button>
              <Button onClick={saveConfig}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-card p-4 shadow-card ${accent ? 'bg-status-occupied text-white' : 'bg-panel'}`}>
      <p className={`text-xs ${accent ? 'text-white/80' : 'text-ink-soft'}`}>{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${accent ? 'text-white' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function PlRow({ label, value, soft }: { label: string; value: string; soft?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={soft ? 'text-ink-soft' : 'font-semibold text-ink'}>{value}</dd>
    </div>
  )
}

function StatCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-panel p-4 shadow-card">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
        <span className="text-base">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  )
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={'font-semibold ' + (warn ? 'text-status-occupied' : 'text-ink')}>{value}</span>
    </div>
  )
}

function BarCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card bg-panel p-5 shadow-card">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
      {empty ? (
        <p className="py-6 text-center text-sm text-ink-soft">Belum ada data.</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  )
}

function Bar({
  label,
  hint,
  right,
  pct,
  color,
}: {
  label: string
  hint?: string
  right: string
  pct: number
  color: string
}) {
  return (
    <li>
      <div className="mb-1 flex justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium text-ink">
          {label}
          {hint && <span className="ml-2 text-xs text-ink-soft">{hint}</span>}
        </span>
        <span className="whitespace-nowrap font-semibold text-ink">{right}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className={'h-full rounded-full ' + color} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </li>
  )
}
