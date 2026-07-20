import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { fetchCategories, fetchProducts, saveOrder } from '../pos/posRepository'
import { useCart } from '../pos/useCart'
import type { Category, Product } from '../../types'

/**
 * Menu digital Self-Order untuk pelanggan (dibuka via QR di meja).
 * Pesanan dikirim sebagai DRAFT dengan order_source SELF_ORDER lalu diteruskan
 * ke KDS/Kasir melalui bus real-time lokal.
 */
export default function SelfOrderPage() {
  const { tableNumber = '-' } = useParams()
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const taxRate = getNumberSetting(settings, 'tax_rate', 0.1)
  const taxEnabled = settings.tax_enabled === '1'

  const cart = useCart()
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCat, setActiveCat] = useState<number | undefined>()
  const [products, setProducts] = useState<Product[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => setCategories(fetchCategories()), [])
  useEffect(() => setProducts(fetchProducts(outletId, activeCat)), [outletId, activeCat])

  const pills = useMemo(
    () => [{ id: undefined, name: 'Semua' } as const, ...categories],
    [categories],
  )
  const tax = taxEnabled ? Math.round(cart.subtotal * taxRate) : 0
  const total = cart.subtotal + tax

  const handleSubmit = async () => {
    if (cart.items.length === 0 || busy) return
    setBusy(true)
    try {
      const res = await saveOrder({
        outletId,
        items: cart.items,
        facilityType: 'DINE_IN',
        orderSource: 'SELF_ORDER',
        tableNumber,
        taxRate,
        taxEnabled,
        status: 'DRAFT',
        sendToKitchen: true,
      })
      cart.clear()
      setSubmitted(res.invoiceNumber)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-empty text-3xl text-white">
          ✓
        </div>
        <h1 className="text-xl font-bold text-ink">Pesanan Terkirim!</h1>
        <p className="text-sm text-ink-soft">
          Meja {tableNumber} · {submitted}
          <br />
          Pesanan Anda diteruskan ke dapur. Terima kasih 🙏
        </p>
        <button
          onClick={() => setSubmitted(null)}
          className="mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-strong"
        >
          Pesan Lagi
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 bg-status-occupied px-4 py-4 text-white">
        <img
          src="/logo-mark.png"
          alt="POS Merah Putih"
          className="h-11 w-11 rounded-lg bg-panel p-0.5"
        />
        <div>
          <p className="text-xs opacity-90">POSMerahPutih · Self-Order</p>
          <h1 className="text-lg font-bold">Meja {tableNumber}</h1>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {pills.map((c) => (
          <button
            key={c.name}
            onClick={() => setActiveCat(c.id)}
            className={
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ' +
              (activeCat === c.id ? 'bg-status-occupied text-white' : 'bg-panel text-ink')
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-40">
        {products.map((p) => {
          const qty = cart.items.find((i) => i.product.id === p.id)?.quantity ?? 0
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-card bg-panel p-3 shadow-card">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface/60 text-lg font-bold text-white">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                <p className="text-sm font-bold text-status-occupied">{formatRupiah(p.price)}</p>
              </div>
              {qty > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cart.setQuantity(p.id, qty - 1)}
                    className="h-8 w-8 rounded-full bg-background text-ink"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{qty}</span>
                  <button
                    onClick={() => cart.addProduct(p)}
                    className="h-8 w-8 rounded-full bg-status-occupied text-white"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => cart.addProduct(p)}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-strong"
                >
                  Tambah
                </button>
              )}
            </div>
          )
        })}
      </div>

      {cart.items.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md border-t border-black/10 bg-panel p-4 shadow-panel">
          <div className="mb-2 flex justify-between text-sm text-ink-soft">
            <span>{cart.items.reduce((s, i) => s + i.quantity, 0)} item · Pajak {formatRupiah(tax)}</span>
            <span className="text-base font-bold text-ink">{formatRupiah(total)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="w-full rounded-xl bg-status-occupied py-3.5 text-base font-bold text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? 'Mengirim…' : 'Kirim Pesanan ke Dapur'}
          </button>
        </div>
      )}
    </div>
  )
}
