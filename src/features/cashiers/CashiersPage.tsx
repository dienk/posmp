import { useEffect, useMemo, useState } from 'react'
import { listOutlets, type OutletWithStats } from '../outlets/outletsRepository'
import {
  createCashier,
  deleteCashier,
  listCashiers,
  updateCashier,
} from './cashiersRepository'
import type { Cashier } from '../../types'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

export default function CashiersPage() {
  const [outlets, setOutlets] = useState<OutletWithStats[]>([])
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [filterOutlet, setFilterOutlet] = useState<number | 'all'>('all')
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({ outlet_id: 0, name: '', code: '', location: '', is_active: true })
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => {
    setOutlets(listOutlets())
    setCashiers(listCashiers())
  }
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const defaultOutletId = () =>
    filterOutlet !== 'all' ? filterOutlet : outlets[0]?.id ?? 0

  const startNew = () => {
    if (outlets.length === 0) {
      showToast('Tambahkan outlet terlebih dahulu.')
      return
    }
    setForm({ outlet_id: defaultOutletId(), name: '', code: '', location: '', is_active: true })
    setMode({ kind: 'new' })
  }
  const startEdit = (c: Cashier) => {
    setForm({
      outlet_id: c.outlet_id,
      name: c.name,
      code: c.code ?? '',
      location: c.location ?? '',
      is_active: c.is_active === 1,
    })
    setMode({ kind: 'edit', id: c.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.name.trim()) {
      showToast('Nama kasir wajib diisi.')
      return
    }
    if (!form.outlet_id) {
      showToast('Pilih outlet.')
      return
    }
    const input = {
      outlet_id: form.outlet_id,
      name: form.name,
      code: form.code,
      location: form.location,
      is_active: form.is_active ? 1 : 0,
    }
    if (mode?.kind === 'new') await createCashier(input)
    else if (mode?.kind === 'edit') await updateCashier(mode.id, input)
    cancel()
    reload()
    showToast('Kasir tersimpan.')
  }

  const remove = async (c: Cashier) => {
    await deleteCashier(c.id)
    reload()
    showToast('Kasir dihapus.')
  }

  const visible = useMemo(
    () => (filterOutlet === 'all' ? cashiers : cashiers.filter((c) => c.outlet_id === filterOutlet)),
    [cashiers, filterOutlet],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Kasir</h1>
        <span className="text-xs text-ink-soft">{visible.length} titik kasir</span>
        <select
          value={filterOutlet === 'all' ? 'all' : String(filterOutlet)}
          onChange={(e) => setFilterOutlet(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
        >
          <option value="all">Semua outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Kasir
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Daftar kasir */}
        <section className="rounded-card bg-white p-2 shadow-card">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada kasir.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {visible.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">
                    🧑‍💻
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {c.name}
                      {c.code && (
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                          {c.code}
                        </span>
                      )}
                      {c.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {c.outlet_name ?? '—'}
                      {c.location ? ` · ${c.location}` : ''}
                    </p>
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
        <section className="rounded-card bg-white p-5 shadow-card">
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? 'Kasir Baru' : 'Edit Kasir'}
              </h2>
              <div className="space-y-3">
                <Field label="Outlet">
                  <select
                    value={form.outlet_id || ''}
                    onChange={(e) => setForm((f) => ({ ...f, outlet_id: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  >
                    <option value="" disabled>
                      Pilih outlet
                    </option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nama kasir">
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. Kasir Depan"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <Field label="Kode">
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. KSR-01"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </Field>
                <Field label="Lokasi">
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. Lantai 1 / Drive-Thru"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Kasir aktif
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
              Pilih <b>+ Kasir</b> untuk menambah titik kasir, atau <b>Edit</b> pada baris. Setiap
              kasir menempel pada satu <b>outlet</b>.
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
