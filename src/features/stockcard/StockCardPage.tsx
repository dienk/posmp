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
  const [search, setSearch] = useState('') // cari produk via nama/SKU
  const [onlyLow, setOnlyLow] = useState(false) // hanya produk stok ≤ minimum
  const [open, setOpen] = useState(false)
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
  const isLow = (p: StockCardProduct) => p.system_stock <= p.min_stock
  const lowCount = useMemo(() => products.filter(isLow).length, [products])
  const results = useMemo(() => {
    const k = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        (!onlyLow || isLow(p)) &&
        (!k ||
          p.name.toLowerCase().includes(k) ||
          (p.sku ?? '').toLowerCase().includes(k) ||
          (p.barcode ?? '').toLowerCase().includes(k)),
    )
  }, [products, search, onlyLow])
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
            className="w-56 rounded-lg border border-line/10 bg-panel py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong"
          />
        </div>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(Number(e.target.value))}
          className="rounded-lg border border-line/10 bg-panel px-3 py-2 text-sm outline-none focus:border-brand-strong"
        >
          <option value={0}>Semua Gudang</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              🏭 {w.name}
            </option>
          ))}
        </select>
        {/* Filter: hanya produk dengan stok ≤ minimum (stok menipis) */}
        <button
          onClick={() => {
            setOnlyLow((v) => !v)
            setOpen(true)
          }}
          title="Tampilkan hanya produk dengan stok ≤ stok minimum"
          className={
            'rounded-lg px-3 py-2 text-sm font-semibold transition ' +
            (onlyLow
              ? 'bg-status-occupied text-white'
              : 'border border-line/10 text-ink hover:bg-background')
          }
        >
          ⚠️ Stok Menipis{lowCount > 0 ? ` · ${lowCount}` : ''}
        </button>
        {/* Cari produk via nama atau SKU (combobox) */}
        <div className="relative min-w-64">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder={
              product
                ? `${product.name}${product.sku ? ` · ${product.sku}` : ''}`
                : 'Cari nama / SKU / barcode…'
            }
            className="w-full rounded-lg border border-line/10 bg-panel py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink placeholder:opacity-100 focus:border-brand-strong focus:placeholder:opacity-50"
          />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line/10 bg-panel py-1 shadow-card">
              {results.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-soft">Tidak ada produk cocok.</li>
              )}
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setProductId(p.id)
                      setSearch('')
                      setOpen(false)
                    }}
                    className={
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-background ' +
                      (p.id === productId ? 'bg-brand-soft' : '')
                    }
                  >
                    <span className="truncate font-medium text-ink">
                      {p.name}
                      {isLow(p) && (
                        <span className="ml-2 rounded-full bg-status-occupied/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-occupied">
                          ≤ min
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {p.sku ?? '—'} · stok{' '}
                      <b className={isLow(p) ? 'text-status-occupied' : 'text-ink'}>
                        {p.system_stock}
                      </b>
                      {p.min_stock > 0 ? ` / min ${p.min_stock}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              <tr className="border-b border-line/5 text-left text-xs uppercase text-ink-soft">
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
                <tr className="border-b border-line/5 bg-background/50">
                  <td className="px-4 py-2.5 text-ink-soft" colSpan={5}>
                    Saldo awal
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-ink">{card.openingBalance}</td>
                </tr>
              )}
              {card?.movements.map((m, i) => (
                <tr key={i} className="border-b border-line/5 hover:bg-background">
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
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-panel shadow-lg">
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
