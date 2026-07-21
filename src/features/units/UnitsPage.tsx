import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
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
        <Button size="sm" onClick={startNew} className="ml-auto">
          + Satuan
        </Button>
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
                  <Button variant="quiet" size="sm" onClick={() => startEdit(u)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(u)}>
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
                {mode.kind === 'new' ? 'Satuan Baru' : 'Edit Satuan'}
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">Nama satuan</span>
                  <input
                    className="field-input"
                    placeholder="mis. pcs / box / kg"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Deskripsi</span>
                  <input
                    className="field-input"
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
              Pilih <b>+ Satuan</b> untuk menambah, atau <b>Edit</b> pada baris. Satuan aktif muncul
              sebagai pilihan di form <b>Produk</b>.
            </p>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">
          {toast}
        </div>
      )}
    </div>
  )
}
