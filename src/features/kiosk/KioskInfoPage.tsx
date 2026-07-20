import { useEffect, useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { getOutlet } from '../settings/settingsRepository'
import { listCategoriesWithCount, type CategoryWithCount } from '../products/productsRepository'
import { getReceiptConfig } from '../receipt/receiptConfig'
import { currentShift, getScheduleConfig, isOpenNow } from '../schedule/scheduleConfig'
import { listPromos, type Promo } from './kioskRepository'
import { formatRupiah } from '../../lib/format'
import { FullscreenButton } from './FullscreenButton'

function promoText(p: Promo): string {
  if (p.discount_type === 'PERCENTAGE') return `Diskon ${p.discount_value}%`
  if (p.discount_type === 'VALUE_DEPOSIT') return `Saldo ${formatRupiah(p.discount_value)}`
  return `Potongan ${formatRupiah(p.discount_value)}`
}

export default function KioskInfoPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const outlet = useMemo(() => getOutlet(outletId), [outletId])
  const cfg = useMemo(() => getReceiptConfig(settings), [settings])
  const schedule = useMemo(() => getScheduleConfig(settings), [settings])

  const [cats, setCats] = useState<CategoryWithCount[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [now, setNow] = useState(() => new Date())

  const reload = () => {
    setCats(listCategoriesWithCount())
    setPromos(listPromos())
  }
  useEffect(reload, [])
  useRealtime('order:update', reload)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const open = isOpenNow(schedule, now)
  const shift = currentShift(schedule, now)

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-soft to-background">
      <header className="flex flex-wrap items-center gap-4 px-8 py-5">
        {cfg.logo && <img src={cfg.logo} alt="logo" className="h-16 w-16 rounded-xl object-contain" />}
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-extrabold text-ink">{outlet?.name ?? 'POSMerahPutih'}</h1>
          <p className="text-sm text-ink-soft">
            {cfg.tagline || outlet?.address || 'Selamat datang'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-ink">
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-ink-soft">
              {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span
            className={
              'rounded-full px-4 py-1.5 text-sm font-bold ' +
              (open ? 'bg-status-empty/15 text-status-empty' : 'bg-status-occupied/15 text-status-occupied')
            }
          >
            ● {open ? 'BUKA' : 'TUTUP'}
            {schedule.shiftEnabled && shift ? ` · ${shift.name}` : ''}
          </span>
          <FullscreenButton />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto px-8 pb-8 lg:grid-cols-3">
        {/* Direktori */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-ink-soft">📍 Direktori</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cats.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl bg-white p-5 shadow-card"
                style={c.color_code ? { borderTop: `4px solid ${c.color_code}` } : undefined}
              >
                <p className="text-xl font-extrabold text-ink">{c.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{c.product_count} item</p>
              </div>
            ))}
            {cats.length === 0 && (
              <p className="col-span-full py-10 text-center text-ink-soft">Belum ada kategori.</p>
            )}
          </div>

          {(outlet?.address || outlet?.phone) && (
            <div className="mt-6 rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">🗺️ Lokasi</h3>
              {outlet?.address && <p className="text-lg font-semibold text-ink">{outlet.address}</p>}
              {outlet?.phone && <p className="text-sm text-ink-soft">☎ {outlet.phone}</p>}
            </div>
          )}
        </section>

        {/* Promosi */}
        <section>
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-ink-soft">🎉 Promosi</h2>
          <div className="space-y-4">
            {promos.map((p) => (
              <div
                key={p.code}
                className="rounded-2xl bg-status-occupied p-5 text-white shadow-card"
              >
                <p className="text-2xl font-extrabold">{promoText(p)}</p>
                <p className="mt-1 font-mono text-lg tracking-widest">{p.code}</p>
                {p.min_purchase > 0 && (
                  <p className="mt-1 text-xs text-white/80">Min. belanja {formatRupiah(p.min_purchase)}</p>
                )}
                {p.expiry_date && (
                  <p className="text-xs text-white/80">Berlaku s/d {p.expiry_date.slice(0, 10)}</p>
                )}
              </div>
            ))}
            {promos.length === 0 && (
              <div className="rounded-2xl bg-white p-6 text-center text-ink-soft shadow-card">
                Belum ada promo aktif.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
