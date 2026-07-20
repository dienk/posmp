import { useEffect, useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import {
  findProductByCode,
  listStockCardProducts,
  stockCard,
  type MovementKind,
  type StockCardProduct,
} from './stockCardRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'

const KIND_LABEL: Record<MovementKind, string> = {
  MASUK: 'Stok Masuk',
  JUAL: 'Penjualan',
  REFUND: 'Refund',
  OPNAME: 'Opname',
}
const KIND_STYLE: Record<MovementKind, string> = {
  MASUK: 'bg-status-empty/15 text-status-empty',
  JUAL: 'bg-status-occupied/15 text-status-occupied',
  REFUND: 'bg-brand-soft text-ink',
  OPNAME: 'bg-status-waiting/15 text-status-waiting',
}

export default function StockCardPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [products, setProducts] = useState<StockCardProduct[]>([])
  const [productId, setProductId] = useState<number | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState<number>(0) // 0 = semua gudang
  const [scanCode, setScanCode] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const handleScan = () => {
    const code = scanCode.trim()
    if (!code) return
    const found = findProductByCode(code)
    setScanCode('')
    if (found) {
      setProductId(found.id)
    } else {
      setToast(`Barcode "${code}" tidak ditemukan.`)
      window.setTimeout(() => setToast(null), 2500)
    }
  }

  useEffect(() => {
    const list = listStockCardProducts(outletId)
    setProducts(list)
    setProductId((prev) => prev ?? list[0]?.id ?? null)
    setWarehouses(listWarehouses(outletId))
  }, [outletId])

  // Segarkan kartu saat ada transaksi/opname (order:update).
  useRealtime('order:update', () => setTick((t) => t + 1))

  const card = useMemo(
    () => (productId ? stockCard(productId, outletId, warehouseId || undefined) : null),
    [productId, outletId, warehouseId, tick],
  )
  const product = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId])
  const totals = useMemo(() => {
    if (!card) return { in: 0, out: 0 }
    return {
      in: card.movements.reduce((s, m) => s + m.qin, 0),
      out: card.movements.reduce((s, m) => s + m.qout, 0),
    }
  }, [card])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Kartu Stock</h1>
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            🔦
          </span>
          <input
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Scan barcode / QR lalu Enter…"
            className="w-56 rounded-lg border border-black/10 bg-panel py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong"
          />
        </div>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(Number(e.target.value))}
          className="rounded-lg border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-brand-strong"
        >
          <option value={0}>Semua Gudang</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              🏭 {w.name}
            </option>
          ))}
        </select>
        <select
          value={productId ?? ''}
          onChange={(e) => setProductId(Number(e.target.value))}
          className="min-w-56 rounded-lg border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-brand-strong"
        >
          {products.length === 0 && <option value="">Tidak ada produk</option>}
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.sku ? ` · ${p.sku}` : ''}
            </option>
          ))}
        </select>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Ringkasan */}
        {product && card && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Saldo Awal" value={String(card.openingBalance)} />
            <Kpi label="Total Masuk" value={`+${totals.in}`} tone="in" />
            <Kpi label="Total Keluar" value={`−${totals.out}`} tone="out" />
            <Kpi label="Stok Saat Ini" value={`${card.currentStock} ${product.unit ?? 'pcs'}`} accent />
          </div>
        )}

        {/* Kartu / kardex */}
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Referensi</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Keluar</th>
                <th className="px-4 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {card && (
                <tr className="border-b border-black/5 bg-background/50">
                  <td className="px-4 py-2.5 text-ink-soft" colSpan={5}>
                    Saldo awal
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-ink">{card.openingBalance}</td>
                </tr>
              )}
              {card?.movements.map((m, i) => (
                <tr key={i} className="border-b border-black/5 hover:bg-background">
                  <td className="px-4 py-2.5 text-ink-soft">{m.at}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{m.ref ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + KIND_STYLE[m.kind]}>
                      {KIND_LABEL[m.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-status-empty">{m.qin > 0 ? `+${m.qin}` : ''}</td>
                  <td className="px-4 py-2.5 text-right text-status-occupied">
                    {m.qout > 0 ? `−${m.qout}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-ink">{m.balance}</td>
                </tr>
              ))}
              {card && card.movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Belum ada mutasi stok untuk produk ini.
                  </td>
                </tr>
              )}
              {!card && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Pilih produk untuk melihat kartu stock.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  accent,
}: {
  label: string
  value: string
  tone?: 'in' | 'out'
  accent?: boolean
}) {
  const valueColor = accent
    ? 'text-white'
    : tone === 'in'
      ? 'text-status-empty'
      : tone === 'out'
        ? 'text-status-occupied'
        : 'text-ink'
  return (
    <div className={`rounded-card p-4 shadow-card ${accent ? 'bg-status-occupied' : 'bg-panel'}`}>
      <p className={`text-xs ${accent ? 'text-white/80' : 'text-ink-soft'}`}>{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${valueColor}`}>{value}</p>
    </div>
  )
}
