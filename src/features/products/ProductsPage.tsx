import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { publish } from '../../lib/realtime'
import type { Category, Product } from '../../types'
import {
  createCategory,
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  parseImages,
  parseUnitConversions,
  updateProduct,
  type ProductInput,
} from './productsRepository'
import { listActiveUnitNames } from '../units/unitsRepository'
import { fileToScaledDataUrl } from '../receipt/receiptConfig'

const EMPTY: ProductInput = {
  categoryId: null,
  name: '',
  sku: '',
  barcode: '',
  price: 0,
  costPrice: 0,
  unit: 'pcs',
  minStock: 0,
  description: '',
  isActive: 1,
  images: [],
  unitConversions: [],
}


export default function ProductsPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<ProductInput>(EMPTY)
  const [newCategory, setNewCategory] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => {
    setProducts(listProducts(outletId))
    setCategories(listCategories())
    setUnits(listActiveUnitNames())
  }
  useEffect(reload, [outletId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(k) ||
        (p.sku ?? '').toLowerCase().includes(k) ||
        (p.barcode ?? '').toLowerCase().includes(k),
    )
  }, [products, keyword])

  const startNew = () => {
    setForm({ ...EMPTY, categoryId: categories[0]?.id ?? null })
    setEditingId('new')
  }
  const startEdit = (p: Product) => {
    setForm({
      categoryId: p.category_id,
      name: p.name,
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      price: p.price,
      costPrice: p.cost_price ?? 0,
      unit: p.unit ?? 'pcs',
      minStock: p.min_stock ?? 0,
      description: p.description ?? '',
      isActive: p.is_active ?? 1,
      images: parseImages(p.images, p.image_path),
      unitConversions: parseUnitConversions(p.unit_conversions),
    })
    setEditingId(p.id)
  }
  const cancel = () => {
    setEditingId(null)
    setForm(EMPTY)
  }

  const save = async () => {
    if (!form.name.trim() || form.price < 0) {
      showToast('Nama & harga wajib benar.')
      return
    }
    try {
      if (editingId === 'new') await createProduct(form, outletId)
      else if (typeof editingId === 'number') await updateProduct(editingId, form)
      publish('order:update')
      cancel()
      reload()
      showToast('Produk tersimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // izinkan pilih file sama lagi
    if (files.length === 0) return
    try {
      const urls = await Promise.all(files.map((f) => fileToScaledDataUrl(f, 320)))
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
    } catch {
      showToast('Gagal memuat gambar.')
    }
  }

  const addConversion = () =>
    setForm((f) => ({ ...f, unitConversions: [...f.unitConversions, { unit: '', conversion: 1, price: 0 }] }))
  const updateConversion = (idx: number, patch: Partial<{ unit: string; conversion: number; price: number }>) =>
    setForm((f) => ({
      ...f,
      unitConversions: f.unitConversions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }))
  const removeConversion = (idx: number) =>
    setForm((f) => ({ ...f, unitConversions: f.unitConversions.filter((_, i) => i !== idx) }))

  const removeImage = (idx: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))
  const makeMainImage = (idx: number) =>
    setForm((f) => {
      if (idx === 0) return f
      const next = [...f.images]
      const [pick] = next.splice(idx, 1)
      return { ...f, images: [pick, ...next] }
    })

  const remove = async (id: number) => {
    try {
      await deleteProduct(id)
      reload()
      showToast('Produk dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  const addCategory = async () => {
    if (!newCategory.trim()) return
    const id = await createCategory(newCategory, '#CFC6D9')
    setNewCategory('')
    reload()
    setForm((f) => ({ ...f, categoryId: id }))
    showToast('Kategori ditambahkan.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Produk</h1>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Cari nama / SKU…"
          className="w-56 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
        />
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Produk
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Tabel produk */}
        <section className="overflow-hidden rounded-card bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Barcode / SKU</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Modal</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const lowStock = (p.stock ?? 0) <= (p.min_stock ?? 0)
                return (
                  <tr key={p.id} className="border-b border-black/5 hover:bg-background">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
                          {p.image_path ? (
                            <img src={p.image_path} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-base text-ink-soft">🍽️</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            {p.name}
                            {p.is_active !== 1 && (
                              <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                                Nonaktif
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-soft">{p.unit ?? 'pcs'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      <p>{p.barcode ?? '—'}</p>
                      <p>{p.sku ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {formatRupiah(p.cost_price ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatRupiah(p.price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={lowStock ? 'font-semibold text-status-occupied' : 'text-ink-soft'}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Tidak ada produk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Form tambah/edit */}
        <section className="rounded-card bg-white p-5 shadow-card">
          {editingId ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {editingId === 'new' ? 'Produk Baru' : 'Edit Produk'}
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-ink-soft">
                    Gambar produk {form.images.length > 0 && `(${form.images.length})`}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {form.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative h-20 w-20 overflow-hidden rounded-lg border border-black/10 bg-background"
                      >
                        <img src={img} alt={`Gambar ${idx + 1}`} className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute left-1 top-1 rounded bg-status-occupied px-1 py-0.5 text-[9px] font-bold text-white">
                            Utama
                          </span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => makeMainImage(idx)}
                              title="Jadikan gambar utama"
                              className="text-[10px] font-semibold text-white hover:text-brand"
                            >
                              ★ Utama
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            title="Hapus gambar"
                            className="ml-auto text-[10px] font-semibold text-white hover:text-status-occupied"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-black/20 bg-background px-1 text-center text-xs font-semibold text-ink-soft hover:border-brand-strong hover:bg-brand-soft">
                      <span>＋ Gambar</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImage}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Bisa unggah beberapa gambar. Gambar pertama (Utama) dipakai di kartu produk &amp; kasir.
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Nama produk</span>
                  <input
                    className={inputCls}
                    placeholder="Nama produk"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">SKU</span>
                    <input
                      className={inputCls}
                      placeholder="mis. MKN-001"
                      value={form.sku ?? ''}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Barcode</span>
                    <input
                      className={inputCls}
                      placeholder="Scan / ketik barcode"
                      value={form.barcode ?? ''}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Kategori</span>
                  <select
                    className={inputCls}
                    value={form.categoryId ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">— Tanpa kategori —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Harga jual (Rp)</span>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Harga modal (Rp)</span>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.costPrice}
                      onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Satuan</span>
                    <input
                      className={inputCls}
                      list="unit-options"
                      placeholder="pcs"
                      value={form.unit ?? ''}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    />
                    <datalist id="unit-options">
                      {units.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Stok minimum</span>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.minStock}
                      onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    />
                  </label>
                </div>

                {/* Multi-satuan & konversi */}
                <div className="rounded-lg border border-black/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Satuan Turunan & Konversi</span>
                    <button
                      type="button"
                      onClick={addConversion}
                      className="rounded-lg border border-dashed border-brand-strong px-2 py-1 text-[11px] font-semibold text-ink hover:bg-brand-soft"
                    >
                      + Satuan
                    </button>
                  </div>
                  <p className="mb-2 text-[11px] text-ink-soft">
                    Satuan dasar: <b>{form.unit || 'pcs'}</b>. Tambah satuan lain + jumlah setaranya
                    (mis. 1 box = 12 {form.unit || 'pcs'}).
                  </p>
                  {form.unitConversions.length === 0 ? (
                    <p className="text-[11px] text-ink-soft">Belum ada satuan turunan.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.unitConversions.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            list="unit-options"
                            placeholder="satuan"
                            value={c.unit}
                            onChange={(e) => updateConversion(idx, { unit: e.target.value })}
                            className="w-24 rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
                          />
                          <span className="text-xs text-ink-soft">=</span>
                          <input
                            type="number"
                            min={1}
                            value={c.conversion}
                            onChange={(e) => updateConversion(idx, { conversion: Number(e.target.value) || 0 })}
                            className="w-16 rounded-lg border border-black/10 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-strong"
                          />
                          <span className="shrink-0 text-xs text-ink-soft">{form.unit || 'pcs'}</span>
                          <div className="relative flex-1">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft">
                              Rp
                            </span>
                            <input
                              type="number"
                              min={0}
                              placeholder="harga (opsional)"
                              value={c.price || ''}
                              onChange={(e) => updateConversion(idx, { price: Number(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-black/10 py-1.5 pl-7 pr-2 text-right text-sm outline-none focus:border-brand-strong"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeConversion(idx)}
                            aria-label="Hapus satuan"
                            className="px-1 text-status-occupied hover:opacity-70"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Deskripsi</span>
                  <textarea
                    rows={2}
                    className={inputCls + ' resize-none'}
                    placeholder="Deskripsi produk (opsional)"
                    value={form.description ?? ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.isActive === 1}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4 accent-status-occupied"
                  />
                  Produk aktif (tampil di kasir)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    className="flex-1 rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={cancel}
                    className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Kategori
              </h2>
              <ul className="mb-3 space-y-1 text-sm">
                {categories.map((c) => (
                  <li key={c.id} className="rounded-lg bg-background px-3 py-2 text-ink">
                    {c.name}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Kategori baru"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button
                  onClick={addCategory}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-strong"
                >
                  +
                </button>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                Pilih “+ Produk” untuk menambah, atau “Edit” pada baris produk.
              </p>
            </>
          )}
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
