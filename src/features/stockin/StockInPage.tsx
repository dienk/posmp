import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import {
  createStockEntry,
  createSupplier,
  listProductsForStock,
  listStockEntries,
  listSuppliers,
  type StockEntrySummary,
  type StockProduct,
  type Supplier,
} from './stockInRepository'

interface Line {
  productId: number
  quantity: number
  costPrice: number
}

export default function StockInPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<StockProduct[]>([])
  const [entries, setEntries] = useState<StockEntrySummary[]>([])
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const [newSupplier, setNewSupplier] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')

  const reloadRefs = () => {
    setSuppliers(listSuppliers())
    setProducts(listProductsForStock(outletId))
    setEntries(listStockEntries(outletId))
  }
  useEffect(reloadRefs, [outletId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const availableProducts = useMemo(
    () => products.filter((p) => !lines.some((l) => l.productId === p.id)),
    [products, lines],
  )

  const addLine = () => {
    const first = availableProducts[0]
    if (!first) return
    setLines((prev) => [...prev, { productId: first.id, quantity: 1, costPrice: 0 }])
  }
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const totalCost = lines.reduce((s, l) => s + l.quantity * l.costPrice, 0)

  const handleAddSupplier = async () => {
    if (!newSupplier.trim()) return
    const id = await createSupplier(newSupplier, null, newSupplierPhone || null)
    setNewSupplier('')
    setNewSupplierPhone('')
    setSuppliers(listSuppliers())
    setSupplierId(id)
    showToast('Supplier ditambahkan.')
  }

  const handleSubmit = async () => {
    if (lines.length === 0) {
      showToast('Tambahkan minimal satu item.')
      return
    }
    try {
      const ref = await createStockEntry(
        outletId,
        supplierId === '' ? null : supplierId,
        notes,
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity, costPrice: l.costPrice })),
      )
      setLines([])
      setNotes('')
      setSupplierId('')
      reloadRefs()
      showToast(`Stok masuk tercatat · ${ref}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Stok Masuk & Supplier</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Form penerimaan */}
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Penerimaan Barang
          </h2>

          <div className="mb-3 flex flex-wrap gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Supplier</span>
              <select
                className={inputCls}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Tanpa supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan</span>
              <input
                className={inputCls}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="mis. pembelian mingguan"
              />
            </label>
          </div>

          {/* Baris item */}
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const opts = products.filter(
                (p) => p.id === l.productId || !lines.some((x) => x.productId === p.id),
              )
              return (
                <div key={idx} className="flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-[11px] text-ink-soft">Produk</span>
                    <select
                      className={inputCls}
                      value={l.productId}
                      onChange={(e) => updateLine(idx, { productId: Number(e.target.value) })}
                    >
                      {opts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (stok {p.stock})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block w-20">
                    <span className="mb-1 block text-[11px] text-ink-soft">Qty</span>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block w-32">
                    <span className="mb-1 block text-[11px] text-ink-soft">Harga Modal</span>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={l.costPrice}
                      onChange={(e) => updateLine(idx, { costPrice: Number(e.target.value) })}
                    />
                  </label>
                  <button
                    onClick={() => removeLine(idx)}
                    className="mb-2 px-2 text-status-occupied hover:opacity-70"
                    aria-label="Hapus baris"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={addLine}
            disabled={availableProducts.length === 0}
            className="mt-3 rounded-lg border border-dashed border-brand-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
          >
            + Tambah Item
          </button>

          <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
            <span className="text-sm text-ink-soft">
              Total modal: <span className="font-bold text-ink">{formatRupiah(totalCost)}</span>
            </span>
            <button
              onClick={handleSubmit}
              disabled={lines.length === 0}
              className="rounded-xl bg-status-occupied px-5 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
            >
              Simpan Penerimaan
            </button>
          </div>
        </section>

        {/* Sidebar: tambah supplier + riwayat */}
        <section className="space-y-4">
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Tambah Supplier
            </h2>
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="Nama supplier"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Telepon (opsional)"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
              />
              <button
                onClick={handleAddSupplier}
                className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-ink hover:bg-brand-strong"
              >
                Simpan Supplier
              </button>
            </div>
          </div>

          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Penerimaan Terakhir
            </h2>
            {entries.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-soft">Belum ada penerimaan.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {entries.map((e) => (
                  <li key={e.id} className="rounded-lg bg-background px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-ink">{e.reference_number}</span>
                      <span className="text-ink-soft">{e.total_qty} pcs</span>
                    </div>
                    <p className="text-xs text-ink-soft">
                      {e.supplier_name ?? 'Tanpa supplier'} · {e.line_count} item
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
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

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
