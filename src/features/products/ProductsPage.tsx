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
  updateProduct,
  type ProductInput,
} from './productsRepository'
import { listActiveUnitNames } from '../units/unitsRepository'

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
                      <p className="flex items-center gap-2 font-semibold text-ink">
                        {p.name}
                        {p.is_active !== 1 && (
                          <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                            Nonaktif
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-soft">{p.unit ?? 'pcs'}</p>
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
