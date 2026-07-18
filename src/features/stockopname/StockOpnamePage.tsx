import { useEffect, useMemo, useRef, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import {
  applyOpname,
  findOpnameProduct,
  lastOpname,
  listOpnameProducts,
  type OpnameProduct,
  type OpnameSummary,
} from './stockOpnameRepository'

export default function StockOpnamePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [products, setProducts] = useState<OpnameProduct[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [keyword, setKeyword] = useState('')
  const [scanMode, setScanMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<OpnameSummary | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  const reload = () => {
    setProducts(listOpnameProducts(outletId))
    setLast(lastOpname(outletId))
  }
  useEffect(reload, [outletId])

  useEffect(() => {
    if (scanMode) scanRef.current?.focus()
  }, [scanMode])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const setCount = (productId: number, value: string) => {
    setCounts((prev) => {
      const next = { ...prev }
      if (value === '') delete next[productId]
      else next[productId] = Math.max(0, Math.floor(Number(value) || 0))
      return next
    })
  }

  const bump = (productId: number, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) + delta),
    }))
  }

  const handleScan = () => {
    const code = keyword.trim()
    if (!code) return
    const found = findOpnameProduct(code, outletId)
    if (!found) {
      showToast(`Barcode "${code}" tidak ditemukan.`)
    } else {
      bump(found.id, 1)
      const now = (counts[found.id] ?? 0) + 1
      showToast(`${found.name} · fisik ${now}`)
    }
    setKeyword('')
    scanRef.current?.focus()
  }

  const visible = useMemo(() => {
    if (scanMode) return products
    const k = keyword.trim().toLowerCase()
    if (!k) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(k) ||
        (p.sku ?? '').toLowerCase().includes(k) ||
        (p.barcode ?? '').toLowerCase().includes(k),
    )
  }, [products, keyword, scanMode])

  const countedIds = Object.keys(counts)
  const totalDiff = useMemo(
    () =>
      products.reduce((s, p) => {
        const c = counts[p.id]
        return c == null ? s : s + (c - p.system_stock)
      }, 0),
    [products, counts],
  )

  const save = async () => {
    if (saving) return
    const items = Object.entries(counts).map(([id, physical]) => ({
      productId: Number(id),
      physical,
    }))
    if (items.length === 0) {
      showToast('Belum ada item yang dihitung.')
      return
    }
    setSaving(true)
    try {
      const res = await applyOpname(outletId, items)
      setCounts({})
      reload()
      showToast(`Opname disimpan · ${res.adjusted} item · selisih ${res.totalDiff >= 0 ? '+' : ''}${res.totalDiff}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan opname')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Stock Opname</h1>
        {last && (
          <span className="text-xs text-ink-soft">
            Terakhir: {last.reference_number ?? '—'} · {last.opname_date}
          </span>
        )}
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            {scanMode ? '🔦' : '🔍'}
          </span>
          <input
            ref={scanRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && scanMode && handleScan()}
            placeholder={scanMode ? 'Scan barcode produk lalu Enter…' : 'Cari nama / SKU / barcode…'}
            className={
              'w-64 rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong ' +
              (scanMode ? 'border-status-occupied ring-1 ring-status-occupied/30' : 'border-black/10')
            }
          />
        </div>
        <button
          onClick={() => setScanMode((v) => !v)}
          title="Mode scan barcode: tambah hitungan fisik dengan memindai"
          className={
            'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ' +
            (scanMode
              ? 'bg-status-occupied text-white shadow'
              : 'border border-black/10 bg-white text-ink hover:bg-brand-soft')
          }
        >
          <span className="text-base leading-none">▮▮▮</span>
          {scanMode ? 'Scan: ON' : 'Scan'}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="overflow-hidden rounded-card bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-right">Stok Sistem</th>
                <th className="px-4 py-3 text-center">Stok Fisik</th>
                <th className="px-4 py-3 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const c = counts[p.id]
                const counted = c != null
                const diff = counted ? c - p.system_stock : null
                return (
                  <tr
                    key={p.id}
                    className={'border-b border-black/5 ' + (counted ? 'bg-brand-soft/40' : 'hover:bg-background')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-soft">
                        {p.barcode ?? p.sku ?? '—'} · {p.unit ?? 'pcs'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">{p.system_stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bump(p.id, -1)}
                          className="h-7 w-7 rounded-full bg-background text-ink hover:bg-brand-soft"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={c ?? ''}
                          onChange={(e) => setCount(p.id, e.target.value)}
                          placeholder="—"
                          className="w-16 rounded-lg border border-black/10 px-2 py-1.5 text-center text-sm outline-none focus:border-brand-strong"
                        />
                        <button
                          type="button"
                          onClick={() => bump(p.id, 1)}
                          className="h-7 w-7 rounded-full bg-background text-ink hover:bg-brand-soft"
                        >
                          +
                        </button>
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

      {/* Footer aksi */}
      <div className="flex flex-wrap items-center gap-3 border-t border-black/5 bg-white/70 px-5 py-3 backdrop-blur">
        <span className="text-sm text-ink-soft">
          {countedIds.length} item dihitung · Selisih total:{' '}
          <b className={totalDiff === 0 ? 'text-ink' : totalDiff > 0 ? 'text-status-empty' : 'text-status-occupied'}>
            {totalDiff > 0 ? '+' : ''}
            {totalDiff}
          </b>
        </span>
        <button
          onClick={save}
          disabled={saving || countedIds.length === 0}
          className="ml-auto rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
        >
          {saving ? 'Menyimpan…' : 'Simpan Opname & Sesuaikan Stok'}
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
