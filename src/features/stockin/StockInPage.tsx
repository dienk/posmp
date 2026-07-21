import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import {
  createStockEntry,
  createSupplier,
  deleteStockEntry,
  deleteSupplier,
  listProductsForStock,
  listStockEntries,
  listSuppliers,
  listSuppliersWithUsage,
  stockEntryDetail,
  updateStockEntry,
  updateSupplier,
  type StockEntryDetail,
  type StockEntrySummary,
  type StockProduct,
  type Supplier,
  type SupplierWithUsage,
} from './stockInRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'
import { buildUnitOptions } from '../products/productsRepository'

/** Waktu sekarang dalam format input datetime-local (YYYY-MM-DDTHH:MM). */
function nowLocalInput(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** datetime-local → "YYYY-MM-DD HH:MM:SS" untuk SQLite. */
function toSqlDatetime(v: string): string {
  const s = v.replace('T', ' ')
  return s.length === 16 ? `${s}:00` : s
}
/** "YYYY-MM-DD HH:MM:SS" → datetime-local (YYYY-MM-DDTHH:MM). */
function sqlToLocalInput(v: string): string {
  return v.slice(0, 16).replace(' ', 'T')
}

interface Line {
  productId: number
  quantity: number
  costPrice: number
  /** Satuan input terpilih (kosong = satuan dasar produk). */
  unit?: string
}

type Tab = 'penerimaan' | 'supplier' | 'riwayat'
type SupMode = { kind: 'new' } | { kind: 'edit'; id: number } | null

const inputCls =
  'w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
const EMPTY_SUP = { name: '', contactName: '', phone: '', address: '', isActive: true }

export default function StockInPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [tab, setTab] = useState<Tab>('penerimaan')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [allSuppliers, setAllSuppliers] = useState<SupplierWithUsage[]>([])
  const [products, setProducts] = useState<StockProduct[]>([])
  const [entries, setEntries] = useState<StockEntrySummary[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // Form penerimaan
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState(nowLocalInput)
  const [lines, setLines] = useState<Line[]>([])
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)

  // Supplier CRUD
  const [supMode, setSupMode] = useState<SupMode>(null)
  const [supForm, setSupForm] = useState({ ...EMPTY_SUP })

  // Riwayat
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null)
  const [detail, setDetail] = useState<StockEntryDetail | null>(null)

  const reloadRefs = () => {
    setSuppliers(listSuppliers())
    setAllSuppliers(listSuppliersWithUsage())
    setProducts(listProductsForStock(outletId))
    setEntries(listStockEntries(outletId))
  }
  useEffect(reloadRefs, [outletId])
  useEffect(() => {
    const ws = listWarehouses(outletId)
    setWarehouses(ws)
    setWarehouseId((prev) => (ws.some((w) => w.id === prev) ? prev : ws[0]?.id ?? 0))
  }, [outletId])
  useEffect(() => {
    setDetail(selectedEntry ? stockEntryDetail(selectedEntry) : null)
  }, [selectedEntry, entries])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  // --- Penerimaan ---
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
  // Faktor konversi satuan sebuah baris (dasar = 1).
  const lineFactor = (l: Line): number => {
    const p = products.find((x) => x.id === l.productId)
    if (!p) return 1
    return buildUnitOptions(p.unit, 0, p.unit_conversions).find((o) => o.unit === l.unit)?.factor ?? 1
  }
  const totalCost = lines.reduce((s, l) => s + l.quantity * l.costPrice, 0)
  // Total qty dalam satuan dasar (baris multi-satuan dikonversi).
  const totalQty = lines.reduce((s, l) => s + l.quantity * lineFactor(l), 0)

  const resetForm = () => {
    setLines([])
    setNotes('')
    setSupplierId('')
    setEntryDate(nowLocalInput())
    setWarehouseId(warehouses[0]?.id ?? 0)
    setEditingEntryId(null)
  }

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast('Tambahkan minimal satu item.')
    // Simpan dalam satuan DASAR: qty × faktor; modal per satuan dasar = modal ÷ faktor
    // (subtotal tetap qty × modal). Detail penerimaan konsisten dengan stok.
    const payloadLines = lines.map((l) => {
      const factor = lineFactor(l)
      return {
        productId: l.productId,
        quantity: l.quantity * factor,
        costPrice: factor > 1 ? l.costPrice / factor : l.costPrice,
      }
    })
    try {
      if (editingEntryId) {
        await updateStockEntry(editingEntryId, outletId, {
          supplierId: supplierId === '' ? null : supplierId,
          notes,
          entryDate: toSqlDatetime(entryDate),
          warehouseId,
          lines: payloadLines,
        })
        showToast('Penerimaan diperbarui.')
      } else {
        const ref = await createStockEntry(
          outletId,
          supplierId === '' ? null : supplierId,
          notes,
          payloadLines,
          toSqlDatetime(entryDate),
          warehouseId,
        )
        showToast(`Stok masuk tercatat · ${ref}`)
      }
      resetForm()
      reloadRefs()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }

  const startEditEntry = (d: StockEntryDetail) => {
    setSupplierId('') // supplier_id tak tersedia di detail; pilih ulang bila perlu
    setNotes(d.notes ?? '')
    setEntryDate(sqlToLocalInput(d.entry_date))
    setWarehouseId(d.warehouse_id ?? warehouses[0]?.id ?? 0)
    setLines(d.lines.map((l) => ({ productId: l.product_id, quantity: l.quantity, costPrice: l.cost_price ?? 0 })))
    setEditingEntryId(d.id)
    setTab('penerimaan')
  }

  const handleDeleteEntry = async (d: StockEntryDetail) => {
    try {
      await deleteStockEntry(d.id, outletId)
      setSelectedEntry(null)
      reloadRefs()
      showToast(`Penerimaan ${d.reference_number} dihapus.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  // --- Supplier CRUD ---
  const startNewSup = () => {
    setSupForm({ ...EMPTY_SUP })
    setSupMode({ kind: 'new' })
  }
  const startEditSup = (s: SupplierWithUsage) => {
    setSupForm({
      name: s.name,
      contactName: s.contact_name ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      isActive: s.is_active === 1,
    })
    setSupMode({ kind: 'edit', id: s.id })
  }
  const saveSup = async () => {
    if (!supForm.name.trim()) return showToast('Nama supplier wajib diisi.')
    const input = {
      name: supForm.name,
      contactName: supForm.contactName,
      phone: supForm.phone,
      address: supForm.address,
      isActive: supForm.isActive ? 1 : 0,
    }
    if (supMode?.kind === 'new') await createSupplier(input)
    else if (supMode?.kind === 'edit') await updateSupplier(supMode.id, input)
    setSupMode(null)
    reloadRefs()
    showToast('Supplier tersimpan.')
  }
  const removeSup = async (s: SupplierWithUsage) => {
    try {
      await deleteSupplier(s.id)
      reloadRefs()
      showToast('Supplier dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Stok Masuk & Supplier</h1>
        <nav className="ml-auto flex gap-1 rounded-xl bg-background p-1">
          {(
            [
              ['penerimaan', 'Penerimaan'],
              ['supplier', 'Supplier'],
              ['riwayat', 'Riwayat'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition ' +
                (tab === key ? 'bg-panel text-ink shadow-sm' : 'text-ink-soft hover:text-ink')
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* ============ PENERIMAAN ============ */}
        {tab === 'penerimaan' && (
          <section className="mx-auto max-w-3xl rounded-card bg-panel p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                {editingEntryId ? 'Edit Penerimaan Barang' : 'Penerimaan Barang'}
              </h2>
              {editingEntryId && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Batal Edit
                </Button>
              )}
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Gudang</span>
                <select
                  className={inputCls}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
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
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Waktu Penerimaan
                </span>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan</span>
                <input
                  className="field-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="mis. pembelian mingguan"
                />
              </label>
            </div>

            <div className="space-y-2">
              {lines.map((l, idx) => {
                const opts = products.filter(
                  (p) => p.id === l.productId || !lines.some((x) => x.productId === p.id),
                )
                const lineProduct = products.find((p) => p.id === l.productId)
                const unitOpts = lineProduct
                  ? buildUnitOptions(lineProduct.unit, 0, lineProduct.unit_conversions)
                  : []
                const factor = unitOpts.find((o) => o.unit === l.unit)?.factor ?? 1
                return (
                  <div key={idx} className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="mb-1 block text-[11px] text-ink-soft">Produk</span>
                      <select
                        className={inputCls}
                        value={l.productId}
                        onChange={(e) =>
                          updateLine(idx, { productId: Number(e.target.value), unit: undefined })
                        }
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
                    {unitOpts.length > 1 && (
                      <label className="block w-24">
                        <span className="mb-1 block text-[11px] text-ink-soft">Satuan</span>
                        <select
                          className={inputCls}
                          value={l.unit ?? unitOpts[0].unit}
                          onChange={(e) => updateLine(idx, { unit: e.target.value })}
                        >
                          {unitOpts.map((o) => (
                            <option key={o.unit} value={o.unit}>
                              {o.unit}
                              {o.isBase ? '' : ` (×${o.factor})`}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block w-32">
                      <span className="mb-1 block text-[11px] text-ink-soft">
                        Harga Modal{factor > 1 ? ` / ${l.unit}` : ''}
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={l.costPrice}
                        onChange={(e) => updateLine(idx, { costPrice: Number(e.target.value) })}
                      />
                    </label>
                    <div className="w-28 pb-2 text-right">
                      <span className="block text-[11px] text-ink-soft">Subtotal</span>
                      <span className="text-sm font-semibold text-ink">
                        {formatRupiah(l.quantity * l.costPrice)}
                      </span>
                    </div>
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

            <Button
              size="sm"
              onClick={addLine}
              disabled={availableProducts.length === 0}
              className="mt-3"
            >
              + Tambah Item
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/5 pt-3">
              <span className="text-sm text-ink-soft">
                {totalQty} (satuan dasar) · Total modal:{' '}
                <span className="font-bold text-ink">{formatRupiah(totalCost)}</span>
              </span>
              <Button onClick={handleSubmit} disabled={lines.length === 0}>
                {editingEntryId ? 'Perbarui Penerimaan' : 'Simpan Penerimaan'}
              </Button>
            </div>
          </section>
        )}

        {/* ============ SUPPLIER CRUD ============ */}
        {tab === 'supplier' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <section className="overflow-hidden rounded-card bg-panel shadow-card">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                  Supplier ({allSuppliers.length})
                </h2>
                <Button size="sm" onClick={startNewSup}>
                  + Supplier
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line/5 text-left text-xs uppercase text-ink-soft">
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Kontak</th>
                    <th className="px-4 py-2 text-right">Penerimaan</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {allSuppliers.map((s) => (
                    <tr key={s.id} className="border-b border-line/5 hover:bg-background">
                      <td className="px-4 py-2.5">
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          {s.name}
                          {s.is_active !== 1 && (
                            <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                              Nonaktif
                            </span>
                          )}
                        </p>
                        {s.address && <p className="text-xs text-ink-soft">{s.address}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">
                        <p>{s.contact_name ?? '—'}</p>
                        <p className="text-xs">{s.phone ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-soft">{s.entry_count}×</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <Button variant="quiet" size="sm" onClick={() => startEditSup(s)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => removeSup(s)}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {allSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-soft">
                        Belum ada supplier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="rounded-card bg-panel p-5 shadow-card">
              {supMode ? (
                <>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                    {supMode.kind === 'new' ? 'Supplier Baru' : 'Edit Supplier'}
                  </h2>
                  <div className="space-y-3">
                    <Field label="Nama supplier">
                      <input
                        className="field-input"
                        value={supForm.name}
                        onChange={(e) => setSupForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="mis. CV Sumber Rejeki"
                      />
                    </Field>
                    <Field label="Nama kontak">
                      <input
                        className="field-input"
                        value={supForm.contactName}
                        onChange={(e) => setSupForm((f) => ({ ...f, contactName: e.target.value }))}
                        placeholder="mis. Pak Budi"
                      />
                    </Field>
                    <Field label="Telepon">
                      <input
                        className="field-input"
                        value={supForm.phone}
                        onChange={(e) => setSupForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="mis. 0812xxxx"
                      />
                    </Field>
                    <Field label="Alamat">
                      <textarea
                        rows={2}
                        className={inputCls + ' resize-none'}
                        value={supForm.address}
                        onChange={(e) => setSupForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="Alamat supplier"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={supForm.isActive}
                        onChange={(e) => setSupForm((f) => ({ ...f, isActive: e.target.checked }))}
                      />
                      Supplier aktif
                    </label>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={saveSup} className="flex-1">
                        Simpan
                      </Button>
                      <Button variant="ghost" onClick={() => setSupMode(null)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-soft">
                  Pilih <b>+ Supplier</b> untuk menambah, atau <b>Edit</b> pada baris. Supplier aktif
                  muncul sebagai pilihan di form penerimaan.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ============ RIWAYAT ============ */}
        {tab === 'riwayat' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-card bg-panel shadow-card">
              {entries.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-ink-soft">Belum ada penerimaan.</p>
              ) : (
                <ul className="divide-y divide-line/5">
                  {entries.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelectedEntry(e.id)}
                        className={
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition ' +
                          (selectedEntry === e.id ? 'bg-brand-soft' : 'hover:bg-background')
                        }
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">
                          📥
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{e.reference_number}</p>
                          <p className="truncate text-xs text-ink-soft">
                            🏭 {e.warehouse_name ?? '—'} · {e.supplier_name ?? 'Tanpa supplier'} · {e.total_qty} pcs · {e.entry_date}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-ink">
                          {formatRupiah(e.total_cost)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              {detail ? (
                <div className="rounded-card bg-panel p-5 shadow-card">
                  <h2 className="text-base font-bold text-ink">{detail.reference_number}</h2>
                  <p className="mb-3 text-xs text-ink-soft">
                    🏭 {detail.warehouse_name ?? '—'} · {detail.supplier_name ?? 'Tanpa supplier'} ·{' '}
                    {detail.entry_date}
                  </p>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-line/5 text-left text-[11px] uppercase text-ink-soft">
                        <th className="py-1">Produk</th>
                        <th className="py-1 text-right">Qty</th>
                        <th className="py-1 text-right">Modal</th>
                        <th className="py-1 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i} className="border-b border-line/5">
                          <td className="py-1.5 text-ink">{l.product_name}</td>
                          <td className="py-1.5 text-right text-ink-soft">{l.quantity}</td>
                          <td className="py-1.5 text-right text-ink-soft">
                            {formatRupiah(l.cost_price ?? 0)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-ink">
                            {formatRupiah(l.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between border-t border-line/5 pt-2 text-sm font-bold text-ink">
                    <span>Total ({detail.total_qty} pcs)</span>
                    <span>{formatRupiah(detail.total_cost)}</span>
                  </div>
                  {detail.notes && (
                    <div className="mt-3 rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                        Catatan
                      </p>
                      <p className="text-sm text-ink">{detail.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => startEditEntry(detail)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger-outline"
                      onClick={() => handleDeleteEntry(detail)}
                      className="flex-1"
                    >
                      Hapus
                    </Button>
                  </div>
                  <p className="mt-2 text-center text-xs text-ink-soft">
                    Edit/Hapus akan menyesuaikan kembali stok produk terkait.
                  </p>
                </div>
              ) : (
                <div className="rounded-card bg-panel p-5 text-center text-sm text-ink-soft shadow-card">
                  Pilih penerimaan untuk melihat detail.
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">
          {toast}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
