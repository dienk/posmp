import { useEffect, useMemo, useState } from 'react'
import { listOutlets, type OutletWithStats } from '../outlets/outletsRepository'
import {
  createTableMaster,
  listTablesMaster,
  removeTable,
  updateTableMaster,
  type TableMaster,
} from './tablesRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

const SECTIONS = ['INDOOR', 'OUTDOOR', 'VIP']

export default function MasterTablesPage() {
  const [outlets, setOutlets] = useState<OutletWithStats[]>([])
  const [tables, setTables] = useState<TableMaster[]>([])
  const [filterOutlet, setFilterOutlet] = useState<number | 'all'>('all')
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({
    outlet_id: 0,
    table_number: '',
    section_name: SECTIONS[0],
    capacity: 4,
    max_capacity: 4,
  })
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => {
    setOutlets(listOutlets())
    setTables(listTablesMaster())
  }
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const defaultOutletId = () => (filterOutlet !== 'all' ? filterOutlet : outlets[0]?.id ?? 0)

  const startNew = () => {
    if (outlets.length === 0) {
      showToast('Tambahkan outlet terlebih dahulu.')
      return
    }
    setForm({
      outlet_id: defaultOutletId(),
      table_number: '',
      section_name: SECTIONS[0],
      capacity: 4,
      max_capacity: 4,
    })
    setMode({ kind: 'new' })
  }
  const startEdit = (t: TableMaster) => {
    setForm({
      outlet_id: t.outlet_id,
      table_number: t.table_number,
      section_name: t.section_name || SECTIONS[0],
      capacity: t.capacity,
      max_capacity: t.max_capacity,
    })
    setMode({ kind: 'edit', id: t.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.table_number.trim()) {
      showToast('Nomor meja wajib diisi.')
      return
    }
    if (!form.outlet_id) {
      showToast('Pilih outlet.')
      return
    }
    if (form.capacity < 1) {
      showToast('Kapasitas minimal 1.')
      return
    }
    if (form.max_capacity < form.capacity) {
      showToast('Kapasitas maksimum tidak boleh kurang dari kapasitas standar.')
      return
    }
    const input = {
      outlet_id: form.outlet_id,
      table_number: form.table_number,
      section_name: form.section_name,
      capacity: form.capacity,
      max_capacity: form.max_capacity,
    }
    try {
      if (mode?.kind === 'new') await createTableMaster(input)
      else if (mode?.kind === 'edit') await updateTableMaster(mode.id, input)
    } catch {
      showToast('Nomor meja sudah dipakai di outlet ini.')
      return
    }
    cancel()
    reload()
    showToast('Meja tersimpan.')
  }

  const remove = async (t: TableMaster) => {
    await removeTable(t.id)
    reload()
    showToast('Meja dihapus.')
  }

  const visible = useMemo(
    () => (filterOutlet === 'all' ? tables : tables.filter((t) => t.outlet_id === filterOutlet)),
    [tables, filterOutlet],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Master Meja</h1>
        <span className="text-xs text-ink-soft">{visible.length} meja</span>
        <select
          value={filterOutlet === 'all' ? 'all' : String(filterOutlet)}
          onChange={(e) => setFilterOutlet(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-line/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
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
          + Meja
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Daftar meja */}
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/5 text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Meja</th>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3 text-right">Kapasitas</th>
                <th className="px-4 py-3 text-right">Maks.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-line/5 hover:bg-background">
                  <td className="px-4 py-3 font-semibold text-ink">{t.table_number}</td>
                  <td className="px-4 py-3 text-ink-soft">{t.outlet_name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-soft">{t.section_name}</td>
                  <td className="px-4 py-3 text-right text-ink">{t.capacity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">{t.max_capacity}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(t)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-soft">
                    Belum ada meja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Form */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? 'Meja Baru' : 'Edit Meja'}
              </h2>
              <div className="space-y-3">
                <Field label="Outlet">
                  <select
                    value={form.outlet_id || ''}
                    onChange={(e) => setForm((f) => ({ ...f, outlet_id: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
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
                <Field label="Nomor / nama meja">
                  <input
                    className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                    placeholder="mis. T-09 / VIP-1"
                    value={form.table_number}
                    onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))}
                  />
                </Field>
                <Field label="Area">
                  <select
                    value={form.section_name}
                    onChange={(e) => setForm((f) => ({ ...f, section_name: e.target.value }))}
                    className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  >
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kapasitas standar">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                      value={form.capacity}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, capacity: Number(e.target.value) || 0 }))
                      }
                    />
                  </Field>
                  <Field label="Kapasitas maksimum">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                      value={form.max_capacity}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_capacity: Number(e.target.value) || 0 }))
                      }
                    />
                  </Field>
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
              Pilih <b>+ Meja</b> untuk menambah, atau <b>Edit</b> pada baris. <b>Kapasitas standar</b>{' '}
              = jumlah kursi normal, <b>kapasitas maksimum</b> = daya tampung maksimal (mis. saat
              digabung). Tata letak visual diatur di menu <b>Meja</b>.
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
