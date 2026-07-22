import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import { getNumberSetting, isOpnameApprovalRequired } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { getActivePersona } from '../access/accessRepository'
import { createApproval } from '../approvals/approvalsRepository'
import {
  applyOpname,
  findOpnameProduct,
  lastOpname,
  listOpnameProducts,
  type OpnameProduct,
  type OpnameSummary,
} from './stockOpnameRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'
import { buildUnitOptions } from '../products/productsRepository'

export default function StockOpnamePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [products, setProducts] = useState<OpnameProduct[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  // Satuan input terpilih per produk (kosong = satuan dasar).
  const [units, setUnits] = useState<Record<number, string>>({})
  const [keyword, setKeyword] = useState('')
  const [scanMode, setScanMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<OpnameSummary | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ws = listWarehouses(outletId)
    setWarehouses(ws)
    setWarehouseId((prev) => (ws.some((w) => w.id === prev) ? prev : ws[0]?.id ?? 0))
  }, [outletId])

  const reload = () => {
    if (!warehouseId) return
    setProducts(listOpnameProducts(outletId, warehouseId))
    setLast(lastOpname(outletId, warehouseId))
  }
  useEffect(reload, [outletId, warehouseId])

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
    const found = findOpnameProduct(code, outletId, warehouseId)
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

  // Faktor konversi satuan terpilih (dasar = 1). Count × faktor → satuan dasar.
  const factorOf = (p: OpnameProduct): number => {
    const opts = buildUnitOptions(p.unit, 0, p.unit_conversions)
    return opts.find((o) => o.unit === units[p.id])?.factor ?? 1
  }

  const totalDiff = useMemo(
    () =>
      products.reduce((s, p) => {
        const c = counts[p.id]
        if (c == null) return s
        const opts = buildUnitOptions(p.unit, 0, p.unit_conversions)
        const factor = opts.find((o) => o.unit === units[p.id])?.factor ?? 1
        return s + (c * factor - p.system_stock)
      }, 0),
    [products, counts, units],
  )

  const needApproval = isOpnameApprovalRequired(settings)
  const warehouseName = warehouses.find((w) => w.id === warehouseId)?.name ?? '—'

  const save = async () => {
    if (saving) return
    const items = Object.entries(counts).map(([id, physical]) => {
      const p = products.find((x) => x.id === Number(id))
      return { productId: Number(id), physical: physical * (p ? factorOf(p) : 1) }
    })
    if (items.length === 0) {
      showToast('Belum ada item yang dihitung.')
      return
    }
    setSaving(true)
    try {
      if (needApproval) {
        await createApproval({
          outletId,
          type: 'OPNAME',
          title: `Penyesuaian opname · ${warehouseName}`,
          summary: `${items.length} item · selisih total ${totalDiff >= 0 ? '+' : ''}${totalDiff}`,
          payload: { outletId, warehouseId, warehouseName, counts: items },
          requestedBy: getActivePersona(settings)?.name ?? 'Admin',
        })
        setCounts({})
        showToast(`Opname diajukan untuk persetujuan · ${items.length} item`)
      } else {
        const res = await applyOpname(outletId, warehouseId, items)
        setCounts({})
        reload()
        showToast(`Opname disimpan · ${res.adjusted} item · selisih ${res.totalDiff >= 0 ? '+' : ''}${res.totalDiff}`)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan opname')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Stock Opname</h1>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(Number(e.target.value))}
          className="rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              🏭 {w.name}
            </option>
          ))}
        </select>
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
              'w-64 rounded-xl border bg-panel py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong ' +
              (scanMode ? 'border-status-occupied ring-1 ring-status-occupied/30' : 'border-line/10')
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
              : 'border border-line/10 bg-panel text-ink hover:bg-brand-soft')
          }
        >
          <span className="text-base leading-none">▮▮▮</span>
          {scanMode ? 'Scan: ON' : 'Scan'}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/5 text-left text-xs uppercase text-ink-soft">
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
                const opts = buildUnitOptions(p.unit, 0, p.unit_conversions)
                const factor = opts.find((o) => o.unit === units[p.id])?.factor ?? 1
                const baseQty = counted ? c * factor : null
                const diff = baseQty != null ? baseQty - p.system_stock : null
                return (
                  <tr
                    key={p.id}
                    className={'border-b border-line/5 ' + (counted ? 'bg-brand-soft/40' : 'hover:bg-background')}
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
                          className="w-16 rounded-lg border border-line/10 px-2 py-1.5 text-center text-sm outline-none focus:border-brand-strong"
                        />
                        <button
                          type="button"
                          onClick={() => bump(p.id, 1)}
                          className="h-7 w-7 rounded-full bg-background text-ink hover:bg-brand-soft"
                        >
                          +
                        </button>
                        {opts.length > 1 && (
                          <select
                            value={units[p.id] ?? opts[0].unit}
                            onChange={(e) =>
                              setUnits((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            title="Satuan input"
                            className="rounded-lg border border-line/10 bg-panel px-1.5 py-1.5 text-xs outline-none focus:border-brand-strong"
                          >
                            {opts.map((o) => (
                              <option key={o.unit} value={o.unit}>
                                {o.unit}
                                {o.isBase ? '' : ` (×${o.factor})`}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {factor > 1 && baseQty != null && (
                        <p className="mt-1 text-center text-[11px] text-ink-soft">
                          = {baseQty} {p.unit ?? 'pcs'}
                        </p>
                      )}
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
      <div className="flex flex-wrap items-center gap-3 border-t border-line/5 bg-panel/70 px-5 py-3 backdrop-blur">
        <span className="text-sm text-ink-soft">
          {countedIds.length} item dihitung · Selisih total:{' '}
          <b className={totalDiff === 0 ? 'text-ink' : totalDiff > 0 ? 'text-status-empty' : 'text-status-occupied'}>
            {totalDiff > 0 ? '+' : ''}
            {totalDiff}
          </b>
        </span>
        <Button
          onClick={save}
          disabled={saving || countedIds.length === 0}
          className="ml-auto"
        >
          {saving
            ? 'Menyimpan…'
            : needApproval
              ? 'Ajukan Opname untuk Persetujuan'
              : 'Simpan Opname & Sesuaikan Stok'}
        </Button>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 snackbar">
          {toast}
        </div>
      )}
    </div>
  )
}
