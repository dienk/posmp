import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { publish } from '../../lib/realtime'
import { fileToScaledDataUrl } from '../receipt/receiptConfig'
import { listCategories } from '../products/productsRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'
import type { Category } from '../../types'
import {
  createBundle,
  deleteBundle,
  listBundles,
  listComponentCandidates,
  updateBundle,
  type Bundle,
  type ComponentCandidate,
} from './bundlesRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null
type CompRow = { componentProductId: number; quantity: number }

const emptyForm = () => ({
  name: '',
  sku: '',
  categoryId: '' as string,
  price: 0,
  description: '',
  isActive: true,
  imagePath: null as string | null,
  components: [] as CompRow[],
})

export default function BundlesPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [bundles, setBundles] = useState<Bundle[]>([])
  const [candidates, setCandidates] = useState<ComponentCandidate[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState<number | null>(null) // null = semua gudang
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState(emptyForm())
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => {
    setBundles(listBundles(outletId, warehouseId ?? undefined))
    setCandidates(listComponentCandidates(outletId))
    setCategories(listCategories())
    setWarehouses(listWarehouses(outletId))
  }
  useEffect(reload, [outletId, warehouseId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  )

  // Ringkasan harga & stok paket sesuai komponen yang sedang dipilih di form.
  const preview = useMemo(() => {
    const rows = form.components.filter((c) => c.componentProductId && c.quantity > 0)
    let normal = 0
    let avail = rows.length ? Infinity : 0
    for (const r of rows) {
      const cand = candidateById.get(r.componentProductId)
      if (!cand) continue
      normal += cand.price * r.quantity
      avail = Math.min(avail, Math.floor(cand.stock / r.quantity))
    }
    return { normal, save: normal - form.price, avail: avail === Infinity ? 0 : avail }
  }, [form.components, form.price, candidateById])

  const startNew = () => {
    setForm({ ...emptyForm(), components: [{ componentProductId: 0, quantity: 1 }] })
    setMode({ kind: 'new' })
  }
  const startEdit = (b: Bundle) => {
    setForm({
      name: b.name,
      sku: b.sku ?? '',
      categoryId: b.category_id != null ? String(b.category_id) : '',
      price: b.price,
      description: b.description ?? '',
      isActive: b.is_active === 1,
      imagePath: b.image_path,
      components: b.components.map((c) => ({
        componentProductId: c.component_product_id,
        quantity: c.quantity,
      })),
    })
    setMode({ kind: 'edit', id: b.id })
  }
  const cancel = () => setMode(null)

  const setComp = (i: number, patch: Partial<CompRow>) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }))
  const addComp = () =>
    setForm((f) => ({ ...f, components: [...f.components, { componentProductId: 0, quantity: 1 }] }))
  const removeComp = (i: number) =>
    setForm((f) => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }))

  const onImage = async (file: File | undefined) => {
    if (!file) return
    const url = await fileToScaledDataUrl(file, 320)
    setForm((f) => ({ ...f, imagePath: url }))
  }

  const save = async () => {
    if (!form.name.trim()) return showToast('Nama paket wajib diisi.')
    const comps = form.components.filter((c) => c.componentProductId && c.quantity > 0)
    if (!comps.length) return showToast('Tambahkan minimal 1 komponen.')
    const input = {
      name: form.name,
      sku: form.sku.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      price: Math.max(0, Number(form.price) || 0),
      description: form.description.trim() || null,
      isActive: form.isActive ? 1 : 0,
      imagePath: form.imagePath,
      components: comps,
    }
    try {
      if (mode?.kind === 'new') await createBundle(input)
      else if (mode?.kind === 'edit') await updateBundle(mode.id, input)
    } catch (err) {
      return showToast(err instanceof Error ? err.message : 'Gagal menyimpan paket.')
    }
    publish('order:update') // segarkan katalog kasir
    cancel()
    reload()
    showToast('Paket bundling tersimpan.')
  }

  const remove = async (b: Bundle) => {
    try {
      await deleteBundle(b.id)
    } catch (err) {
      return showToast(err instanceof Error ? err.message : 'Gagal menghapus paket.')
    }
    publish('order:update')
    reload()
    showToast('Paket dihapus.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Bundling</h1>
        <span className="text-xs text-ink-soft">{bundles.length} paket</span>
        <select
          value={warehouseId ?? ''}
          onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
          className="field-select ml-auto w-48"
          title="Ketersediaan paket dihitung dari stok komponen di gudang ini"
        >
          <option value="">🏬 Semua Gudang</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={startNew}>
          + Paket
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-card bg-panel p-2 shadow-card">
          {bundles.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              Belum ada paket. Klik <b>+ Paket</b> untuk membuat bundling produk.
            </p>
          ) : (
            <ul className="divide-y divide-line/5">
              {bundles.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-soft text-lg font-bold text-ink">
                    {b.image_path ? (
                      <img src={b.image_path} alt="" className="h-full w-full object-cover" />
                    ) : (
                      '📦'
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {b.name}
                      {b.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {b.components.map((c) => `${c.name} ×${c.quantity}`).join(' · ') ||
                        'Tanpa komponen'}
                    </p>
                    <p className="text-xs text-ink-soft">
                      Bisa dijual: <b className="text-ink">{b.available}</b> paket
                      {b.componentsTotal > b.price && (
                        <span className="ml-2 rounded-full bg-status-empty/15 px-2 py-0.5 text-[10px] font-semibold text-status-empty">
                          hemat {formatRupiah(b.componentsTotal - b.price)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-brand-strong">{formatRupiah(b.price)}</p>
                    <p className="text-[11px] text-ink-soft line-through">
                      {b.componentsTotal > b.price ? formatRupiah(b.componentsTotal) : ''}
                    </p>
                  </div>
                  <Button variant="quiet" size="sm" onClick={() => startEdit(b)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(b)}>
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card bg-panel p-5 shadow-card">
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? 'Paket Baru' : 'Edit Paket'}
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">Nama paket</span>
                  <input
                    className="field-input"
                    placeholder="mis. Paket Hemat Ayam"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="field-label">Kategori</span>
                    <select
                      className="field-select"
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Harga jual paket</span>
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    />
                  </label>
                </div>

                {/* Komponen paket */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="field-label mb-0">Komponen paket</span>
                    <Button variant="quiet" size="sm" onClick={addComp}>
                      + Komponen
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.components.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          className="field-select flex-1"
                          value={c.componentProductId || ''}
                          onChange={(e) =>
                            setComp(i, { componentProductId: Number(e.target.value) })
                          }
                        >
                          <option value="">Pilih produk…</option>
                          {candidates.map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.name} (stok {cand.stock})
                            </option>
                          ))}
                        </select>
                        <input
                          className="field-input w-20"
                          type="number"
                          min={1}
                          value={c.quantity}
                          onChange={(e) =>
                            setComp(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeComp(i)}
                          aria-label="Hapus komponen"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    {form.components.length === 0 && (
                      <p className="text-xs text-ink-soft">Belum ada komponen.</p>
                    )}
                  </div>
                </div>

                {/* Ringkasan */}
                <div className="rounded-xl bg-background px-3 py-2 text-xs text-ink-soft">
                  <div className="flex justify-between">
                    <span>Harga normal komponen</span>
                    <span className="font-semibold text-ink">{formatRupiah(preview.normal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hemat</span>
                    <span
                      className={
                        'font-semibold ' +
                        (preview.save > 0 ? 'text-status-empty' : 'text-ink-soft')
                      }
                    >
                      {formatRupiah(Math.max(0, preview.save))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stok bisa dijual sekarang</span>
                    <span className="font-semibold text-ink">{preview.avail} paket</span>
                  </div>
                </div>

                <label className="block">
                  <span className="field-label">Deskripsi</span>
                  <input
                    className="field-input"
                    placeholder="Opsional"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>

                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-soft text-xl">
                    {form.imagePath ? (
                      <img src={form.imagePath} alt="" className="h-full w-full object-cover" />
                    ) : (
                      '📦'
                    )}
                  </span>
                  <label className="cursor-pointer text-sm text-brand-strong underline">
                    {form.imagePath ? 'Ganti gambar' : 'Tambah gambar (opsional)'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onImage(e.target.files?.[0])}
                    />
                  </label>
                  {form.imagePath && (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, imagePath: null }))}
                    >
                      Hapus
                    </Button>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Paket aktif (tampil di kasir)
                </label>

                <div className="flex gap-2 pt-1">
                  <Button onClick={save} className="flex-1">
                    Simpan
                  </Button>
                  <Button variant="ghost" onClick={cancel}>
                    Batal
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Paket <b>bundling</b> adalah produk gabungan (mis. <i>Paket Hemat</i>). Saat terjual di
              kasir, <b>stok komponen</b> otomatis berkurang — paket sendiri tidak menyimpan stok.
              Klik <b>+ Paket</b> untuk mulai.
            </p>
          )}
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
