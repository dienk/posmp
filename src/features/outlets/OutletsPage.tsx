import { useEffect, useState } from 'react'
import {
  createOutlet,
  deleteOutlet,
  listOutlets,
  updateOutlet,
  type OutletWithStats,
} from './outletsRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

const EMPTY = { name: '', address: '', phone: '', is_active: true }

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<OutletWithStats[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => setOutlets(listOutlets())
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const startNew = () => {
    setForm({ ...EMPTY })
    setMode({ kind: 'new' })
  }
  const startEdit = (o: OutletWithStats) => {
    setForm({
      name: o.name,
      address: o.address ?? '',
      phone: o.phone ?? '',
      is_active: o.is_active === 1,
    })
    setMode({ kind: 'edit', id: o.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.name.trim()) {
      showToast('Nama outlet wajib diisi.')
      return
    }
    const input = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      is_active: form.is_active ? 1 : 0,
    }
    if (mode?.kind === 'new') await createOutlet(input)
    else if (mode?.kind === 'edit') await updateOutlet(mode.id, input)
    cancel()
    reload()
    showToast('Outlet tersimpan.')
  }

  const remove = async (o: OutletWithStats) => {
    const err = await deleteOutlet(o.id)
    if (err) {
      showToast(err)
      return
    }
    reload()
    showToast('Outlet dihapus.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Outlet</h1>
        <span className="text-xs text-ink-soft">{outlets.length} cabang</span>
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Outlet
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Daftar outlet */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          {outlets.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada outlet.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {outlets.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">
                    🏬
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {o.name}
                      {o.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {o.address || 'Tanpa alamat'}
                      {o.phone ? ` · ${o.phone}` : ''} · {o.cashier_count} kasir
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(o)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(o)}
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
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? 'Outlet Baru' : 'Edit Outlet'}
              </h2>
              <div className="space-y-3">
                <Field label="Nama outlet">
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. Cabang Bandung"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <Field label="Alamat">
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="Alamat lengkap"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </Field>
                <Field label="Telepon">
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. 022-1234567"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Outlet aktif
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
                    className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Pilih <b>+ Outlet</b> untuk menambah cabang, atau <b>Edit</b> pada baris outlet. Titik
              kasir tiap outlet dikelola di menu <b>Kasir</b>.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
