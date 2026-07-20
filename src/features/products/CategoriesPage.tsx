import { useEffect, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  listCategoriesWithCount,
  updateCategory,
  type CategoryWithCount,
} from './productsRepository'

// Palet warna pilihan untuk penanda kategori.
const COLORS = ['#E53935', '#FB8C00', '#FBC02D', '#43A047', '#00897B', '#1E88E5', '#8E24AA', '#6D4C41']

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => setCategories(listCategoriesWithCount())
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const startNew = () => {
    setName('')
    setColor(COLORS[0])
    setEditingId('new')
  }
  const startEdit = (c: CategoryWithCount) => {
    setName(c.name)
    setColor(c.color_code || COLORS[0])
    setEditingId(c.id)
  }
  const cancel = () => setEditingId(null)

  const save = async () => {
    if (!name.trim()) {
      showToast('Nama kategori wajib diisi.')
      return
    }
    if (editingId === 'new') await createCategory(name, color)
    else if (typeof editingId === 'number') await updateCategory(editingId, name, color)
    cancel()
    reload()
    showToast('Kategori tersimpan.')
  }

  const remove = async (c: CategoryWithCount) => {
    await deleteCategory(c.id)
    reload()
    showToast(
      c.product_count > 0
        ? `Kategori dihapus; ${c.product_count} produk jadi tanpa kategori.`
        : 'Kategori dihapus.',
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Kategori Produk</h1>
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Kategori
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        {/* Daftar kategori */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada kategori.</p>
          ) : (
            <ul className="divide-y divide-line/5">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                  <span
                    className="h-8 w-8 shrink-0 rounded-lg"
                    style={{ backgroundColor: c.color_code || '#CFC6D9' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">{c.product_count} produk</p>
                  </div>
                  <button
                    onClick={() => startEdit(c)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Form */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          {editingId ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {editingId === 'new' ? 'Kategori Baru' : 'Edit Kategori'}
              </h2>
              <div className="space-y-3">
                <input
                  className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  placeholder="Nama kategori"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div>
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Warna</span>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        aria-label={c}
                        className={
                          'h-8 w-8 rounded-lg transition ' +
                          (color === c ? 'ring-2 ring-offset-2 ring-ink' : '')
                        }
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={save}
                    className="flex-1 rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={cancel}
                    className="rounded-xl border border-line/10 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Pilih <b>+ Kategori</b> untuk menambah, atau <b>Edit</b> pada baris kategori. Warna
              dipakai sebagai penanda visual kategori.
            </p>
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
