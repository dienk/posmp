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
  lastPurchaseCosts,
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

/** Baca file gambar → data-URI JPEG terkompres (maks sisi 1280px) untuk lampiran. */
function fileToCompressedDataUri(file: File, maxSide = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Kanvas tidak didukung.'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Gambar tidak valid.'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Gagal membaca file.'))
    reader.readAsDataURL(file)
  })
}

/** Aman-parse JSON array data-URI lampiran. */
function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

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
  // Lampiran bukti (data-URI) & harga beli terakhir per produk (untuk isi otomatis modal).
  const [attachments, setAttachments] = useState<string[]>([])
  const [lastCosts, setLastCosts] = useState<Record<number, number>>({})
  const [uploading, setUploading] = useState(false)

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
    setLastCosts(lastPurchaseCosts())
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
    // Isi otomatis harga modal dari harga beli terakhir produk (bila ada).
    setLines((prev) => [...prev, { productId: first.id, quantity: 1, costPrice: lastCosts[first.id] ?? 0 }])
  }
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        // Ganti produk → isi otomatis modal dari harga beli terakhir produk baru.
        if (patch.productId != null && patch.productId !== l.productId) {
          return { ...l, ...patch, costPrice: lastCosts[patch.productId] ?? 0 }
        }
        return { ...l, ...patch }
      }),
    )
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
    setAttachments([])
  }

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uris: string[] = []
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue
        uris.push(await fileToCompressedDataUri(f))
      }
      setAttachments((prev) => [...prev, ...uris])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses gambar')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast('Tambahkan minimal satu item.')
    // Konfirmasi bila ada item berjumlah > 0 tapi harga modal 0 (kemungkinan lupa isi).
    const zeroCost = lines.filter((l) => l.quantity > 0 && l.costPrice <= 0)
    if (zeroCost.length > 0) {
      const names = zeroCost
        .map((l) => products.find((p) => p.id === l.productId)?.name ?? '?')
        .join(', ')
      const ok = window.confirm(
        `${zeroCost.length} item punya harga modal Rp 0 padahal jumlahnya > 0:\n${names}\n\n` +
          'Harga modal (HPP) akan dianggap 0 dan memengaruhi laba/nilai stok. Tetap simpan?',
      )
      if (!ok) return
    }
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
    const attJson = attachments.length ? JSON.stringify(attachments) : undefined
    try {
      if (editingEntryId) {
        await updateStockEntry(editingEntryId, outletId, {
          supplierId: supplierId === '' ? null : supplierId,
          notes,
          entryDate: toSqlDatetime(entryDate),
          warehouseId,
          lines: payloadLines,
          attachments: attJson,
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
          attJson,
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
    setAttachments(parseAttachments(d.attachments))
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

            {/* Lampiran bukti pendukung (foto nota / surat jalan) */}
            <div className="mt-4 border-t border-line/5 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-soft">
                  📎 Bukti Pendukung (foto nota / surat jalan)
                </span>
                <label className="cursor-pointer rounded-lg border border-line/10 bg-background px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-soft">
                  {uploading ? 'Memproses…' : '+ Lampirkan Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      handleAddFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((uri, i) => (
                    <div key={i} className="group relative">
                      <a href={uri} target="_blank" rel="noreferrer">
                        <img
                          src={uri}
                          alt={`Bukti ${i + 1}`}
                          className="h-20 w-20 rounded-lg border border-line/10 object-cover"
                        />
                      </a>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-status-occupied text-xs text-white shadow"
                        aria-label="Hapus lampiran"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-ink-soft">
                Foto dikompres otomatis & disimpan bersama penerimaan (lokal, di perangkat).
              </p>
            </div>

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
                  {parseAttachments(detail.attachments).length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                        📎 Bukti Pendukung
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {parseAttachments(detail.attachments).map((uri, i) => (
                          <a key={i} href={uri} target="_blank" rel="noreferrer">
                            <img
                              src={uri}
                              alt={`Bukti ${i + 1}`}
                              className="h-20 w-20 rounded-lg border border-line/10 object-cover transition hover:opacity-80"
                            />
                          </a>
                        ))}
                      </div>
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
