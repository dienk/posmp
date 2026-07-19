import { useEffect, useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import {
  applyOpeningBalances,
  listOpeningProducts,
  type OpeningProduct,
} from './stockOpeningRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'

export default function StockOpeningPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [products, setProducts] = useState<OpeningProduct[]>([])
  const [balances, setBalances] = useState<Record<number, number>>({})
  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const ws = listWarehouses(outletId)
    setWarehouses(ws)
    setWarehouseId((prev) => (ws.some((w) => w.id === prev) ? prev : ws[0]?.id ?? 0))
  }, [outletId])

  const reload = () => {
    if (warehouseId) setProducts(listOpeningProducts(outletId, warehouseId))
  }
  useEffect(reload, [outletId, warehouseId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const setBalance = (productId: number, value: string) =>
    setBalances((prev) => {
      const next = { ...prev }
      if (value === '') delete next[productId]
      else next[productId] = Math.max(0, Math.floor(Number(value) || 0))
      return next
    })

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(k) || (p.sku ?? '').toLowerCase().includes(k),
    )
  }, [products, keyword])

  const countedIds = Object.keys(balances)

  const save = async () => {
    if (saving) return
    const items = Object.entries(balances).map(([id, qty]) => ({ productId: Number(id), qty }))
    if (items.length === 0) return showToast('Belum ada saldo awal yang diisi.')
    setSaving(true)
    try {
      const n = await applyOpeningBalances(outletId, warehouseId, items)
      setBalances({})
      reload()
      showToast(`Saldo awal ${n} produk tersimpan.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Saldo Awal</h1>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(Number(e.target.value))}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              🏭 {w.name}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            🔍
          </span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari nama / SKU…"
            className="w-64 rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="overflow-hidden rounded-card bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                <th className="px-4 py-3 text-center">Saldo Awal</th>
                <th className="px-4 py-3 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const b = balances[p.id]
                const set = b != null
                const diff = set ? b - p.system_stock : null
                return (
                  <tr
                    key={p.id}
                    className={'border-b border-black/5 ' + (set ? 'bg-brand-soft/40' : 'hover:bg-background')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-soft">
                        {p.sku ?? '—'} · {p.unit ?? 'pcs'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">{p.system_stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min={0}
                          value={b ?? ''}
                          onChange={(e) => setBalance(p.id, e.target.value)}
                          placeholder={String(p.system_stock)}
                          className="w-24 rounded-lg border border-black/10 px-2 py-1.5 text-center text-sm outline-none focus:border-brand-strong"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {diff == null ? (
                        <span className="text-ink-soft">—</span>
                      ) : diff === 0 ? (
                        <span className="text-status-empty">0</span>
                      ) : (
                        <span className={diff > 0 ? 'text-status-empty' : 'text-status-occupied'}>
                          {diff > 0 ? '+' : ''}
                          {diff}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Tidak ada produk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-black/5 bg-white/70 px-5 py-3 backdrop-blur">
        <span className="text-sm text-ink-soft">
          {countedIds.length} produk diisi · Saldo awal menyetel stok ke nilai ini (baseline).
        </span>
        <button
          onClick={save}
          disabled={saving || countedIds.length === 0}
          className="ml-auto rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
        >
          {saving ? 'Menyimpan…' : 'Simpan Saldo Awal'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
