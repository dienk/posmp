import { useEffect, useState } from 'react'
import {
  createUnit,
  deleteUnit,
  listUnits,
  updateUnit,
  type UnitWithUsage,
} from './unitsRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitWithUsage[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({ name: '', description: '', is_active: true })
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => setUnits(listUnits())
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const startNew = () => {
    setForm({ name: '', description: '', is_active: true })
    setMode({ kind: 'new' })
  }
  const startEdit = (u: UnitWithUsage) => {
    setForm({ name: u.name, description: u.description ?? '', is_active: u.is_active === 1 })
    setMode({ kind: 'edit', id: u.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.name.trim()) {
      showToast('Nama satuan wajib diisi.')
      return
    }
    const input = {
      name: form.name,
      description: form.description,
      is_active: form.is_active ? 1 : 0,
    }
    try {
      if (mode?.kind === 'new') await createUnit(input)
      else if (mode?.kind === 'edit') await updateUnit(mode.id, input)
    } catch {
      showToast('Nama satuan sudah dipakai.')
      return
    }
    cancel()
    reload()
    showToast('Satuan tersimpan.')
  }

  const remove = async (u: UnitWithUsage) => {
    await deleteUnit(u.id)
    reload()
    showToast(
      u.product_count > 0
        ? `Satuan dihapus; ${u.product_count} produk tetap memakai teks "${u.name}".`
        : 'Satuan dihapus.',
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Satuan</h1>
        <span className="text-xs text-ink-soft">{units.length} satuan</span>
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Satuan
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-card bg-panel p-2 shadow-card">
          {units.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada satuan.</p>
          ) : (
            <ul className="divide-y divide-line/5">
              {units.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-ink">
                    {u.name.slice(0, 3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {u.name}
                      {u.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {u.description || 'Tanpa deskripsi'} · {u.product_count} produk
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(u)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(u)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card bg-panel p-5 shadow-card">
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? 'Satuan Baru' : 'Edit Satuan'}
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Nama satuan</span>
                  <input
                    className={inputCls}
                    placeholder="mis. pcs / box / kg"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Deskripsi</span>
                  <input
                    className={inputCls}
                    placeholder="Opsional"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Satuan aktif
                </label>
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
              Pilih <b>+ Satuan</b> untuk menambah, atau <b>Edit</b> pada baris. Satuan aktif muncul
              sebagai pilihan di form <b>Produk</b>.
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

const inputCls =
  'w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
