import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import type { Category, FacilityType, Product } from '../../types'
import { fetchCategories, fetchProducts, saveOrder } from '../pos/posRepository'
import { itemUnitPrice, useCart } from '../pos/useCart'
import PaymentModal from '../pos/PaymentModal'
import type { PaymentInput } from '../pos/posRepository'
import { nextQueueNumber } from './kioskRepository'
import { FullscreenButton } from './FullscreenButton'

const FACILITIES: { value: FacilityType; label: string; icon: string }[] = [
  { value: 'DINE_IN', label: 'Makan di Tempat', icon: '🍽️' },
  { value: 'TAKEAWAY', label: 'Bawa Pulang', icon: '🥡' },
]

export default function KioskOrderPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const taxRate = getNumberSetting(settings, 'tax_rate', 0.1)
  const taxEnabled = settings.tax_enabled === '1'
  const serviceRate = getNumberSetting(settings, 'service_charge_rate', 0)
  const serviceEnabled = settings.service_charge_enabled === '1'

  const cart = useCart()
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCat, setActiveCat] = useState<number | undefined>()
  const [products, setProducts] = useState<Product[]>([])
  const [facility, setFacility] = useState<FacilityType>('DINE_IN')
  const [showPay, setShowPay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ queue: string; total: number } | null>(null)

  useEffect(() => setCategories(fetchCategories()), [])
  useEffect(() => setProducts(fetchProducts(outletId, activeCat)), [outletId, activeCat])

  const pills = useMemo(() => [{ id: undefined, name: 'Semua' } as const, ...categories], [categories])

  const subtotal = cart.items.reduce((s, it) => s + itemUnitPrice(it) * it.quantity, 0)
  const service = serviceEnabled ? Math.round(subtotal * serviceRate) : 0
  const tax = taxEnabled ? Math.round((subtotal + service) * taxRate) : 0
  const total = subtotal + service + tax

  const handlePay = async (payments: PaymentInput[]) => {
    if (saving) return
    setSaving(true)
    try {
      const queue = nextQueueNumber(outletId, facility)
      await saveOrder({
        outletId,
        items: cart.items,
        facilityType: facility,
        orderSource: 'SELF_ORDER',
        queueNumber: queue,
        taxRate,
        taxEnabled,
        serviceRate,
        serviceEnabled,
        status: 'COMPLETED',
        payments,
        sendToKitchen: true,
      })
      setShowPay(false)
      cart.clear()
      setDone({ queue, total })
      window.setTimeout(() => setDone(null), 10000)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-brand-soft to-background p-8 text-center">
        <p className="text-6xl">✅</p>
        <p className="mt-4 text-2xl font-bold text-ink">Pesanan Diterima!</p>
        <p className="mt-1 text-ink-soft">Tunjukkan nomor ini saat pengambilan.</p>
        <p className="my-4 text-8xl font-black text-status-occupied">{done.queue}</p>
        <p className="text-lg font-semibold text-ink">Total dibayar {formatRupiah(done.total)}</p>
        <button
          onClick={() => setDone(null)}
          className="mt-8 rounded-2xl bg-ink px-8 py-3 text-lg font-bold text-white hover:brightness-110"
        >
          Pesan Lagi
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Katalog */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-3 bg-white/70 px-6 py-4 backdrop-blur">
          <h1 className="text-xl font-extrabold text-ink">Pesan Sendiri</h1>
          <div className="ml-auto">
            <FullscreenButton />
          </div>
        </header>
        <div className="flex flex-wrap gap-2 px-6 py-3">
          {pills.map((c) => (
            <button
              key={c.id ?? 'all'}
              onClick={() => setActiveCat(c.id)}
              className={
                'rounded-full px-4 py-2 text-sm font-semibold transition ' +
                (activeCat === c.id ? 'bg-brand text-ink shadow' : 'bg-white text-ink-soft hover:bg-brand-soft')
              }
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto px-6 pb-6 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => cart.addProduct(p)}
              className="flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card transition hover:shadow-panel"
            >
              <div className="flex h-28 items-center justify-center bg-brand-soft/40 text-4xl">
                {p.image_path ? (
                  <img src={p.image_path} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  '🍽️'
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-bold text-ink">{p.name}</p>
                <p className="mt-1 font-extrabold text-status-occupied">{formatRupiah(p.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Keranjang */}
      <aside className="flex w-96 shrink-0 flex-col bg-white shadow-panel">
        <div className="flex gap-2 border-b border-black/5 p-4">
          {FACILITIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setFacility(f.value)}
              className={
                'flex-1 rounded-xl py-2.5 text-sm font-bold transition ' +
                (facility === f.value ? 'bg-status-occupied text-white' : 'bg-background text-ink')
              }
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {cart.items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-ink-soft">
              Ketuk menu untuk memulai pesanan
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {cart.items.map((it) => (
                <li key={it.product.id} className="flex items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{it.product.name}</p>
                    <p className="text-xs text-ink-soft">{formatRupiah(itemUnitPrice(it))}</p>
                  </div>
                  <button
                    onClick={() => cart.setQuantity(it.product.id, it.quantity - 1)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{it.quantity}</span>
                  <button
                    onClick={() => cart.setQuantity(it.product.id, it.quantity + 1)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-lg font-bold"
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-black/5 p-4">
          <dl className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between text-ink-soft">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(subtotal)}</dd>
            </div>
            {serviceEnabled && service > 0 && (
              <div className="flex justify-between text-ink-soft">
                <dt>Service ({Math.round(serviceRate * 100)}%)</dt>
                <dd>{formatRupiah(service)}</dd>
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between text-ink-soft">
                <dt>Pajak ({Math.round(taxRate * 100)}%)</dt>
                <dd>{formatRupiah(tax)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-semibold text-ink">TOTAL</dt>
              <dd className="text-2xl font-extrabold text-status-occupied">{formatRupiah(total)}</dd>
            </div>
          </dl>
          <button
            onClick={() => setShowPay(true)}
            disabled={cart.items.length === 0 || saving}
            className="w-full rounded-2xl bg-status-occupied py-4 text-lg font-bold text-white shadow transition hover:brightness-95 disabled:opacity-40"
          >
            Bayar · {formatRupiah(total)}
          </button>
        </div>
      </aside>

      {showPay && (
        <PaymentModal total={total} onCancel={() => setShowPay(false)} onConfirm={handlePay} />
      )}
    </div>
  )
}
