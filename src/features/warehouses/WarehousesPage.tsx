import { useEffect, useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { listOutlets, type OutletWithStats } from '../outlets/outletsRepository'
import {
  createWarehouse,
  deleteWarehouse,
  listWarehousesWithUsage,
  updateWarehouse,
  type WarehouseWithUsage,
} from './warehousesRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

export default function WarehousesPage() {
  const { settings } = useSettings()
  const activeOutlet = getNumberSetting(settings, 'active_outlet_id', 1)

  const [outlets, setOutlets] = useState<OutletWithStats[]>([])
  const [outletId, setOutletId] = useState<number>(activeOutlet)
  const [warehouses, setWarehouses] = useState<WarehouseWithUsage[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({ name: '', code: '', location: '', isDefault: false, isActive: true })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setOutlets(listOutlets()), [])
  const reload = () => setWarehouses(listWarehousesWithUsage(outletId))
  useEffect(reload, [outletId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const startNew = () => {
    setForm({ name: '', code: '', location: '', isDefault: false, isActive: true })
    setMode({ kind: 'new' })
  }
  const startEdit = (w: WarehouseWithUsage) => {
    setForm({
      name: w.name,
      code: w.code ?? '',
      location: w.location ?? '',
      isDefault: w.is_default === 1,
      isActive: w.is_active === 1,
    })
    setMode({ kind: 'edit', id: w.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.name.trim()) return showToast('Nama gudang wajib diisi.')
    const input = {
      outletId,
      name: form.name,
      code: form.code,
      location: form.location,
      isDefault: form.isDefault ? 1 : 0,
      isActive: form.isActive ? 1 : 0,
    }
    if (mode?.kind === 'new') await createWarehouse(input)
    else if (mode?.kind === 'edit') await updateWarehouse(mode.id, input)
    cancel()
    reload()
    showToast('Gudang tersimpan.')
  }

  const remove = async (w: WarehouseWithUsage) => {
    try {
      await deleteWarehouse(w.id)
      reload()
      showToast('Gudang dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  const outletName = useMemo(
    () => outlets.find((o) => o.id === outletId)?.name ?? '',
    [outlets, outletId],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Gudang</h1>
        <span className="text-xs text-ink-soft">{warehouses.length} gudang</span>
        <select
          value={outletId}
          onChange={(e) => setOutletId(Number(e.target.value))}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
        >
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
          + Gudang
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-card bg-white p-2 shadow-card">
          {warehouses.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada gudang di {outletName}.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {warehouses.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">
                    🏭
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {w.name}
                      {w.is_default === 1 && (
                        <span className="rounded-full bg-status-empty/15 px-2 py-0.5 text-[10px] font-semibold text-status-empty">
                          Default
                        </span>
                      )}
                      {w.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {w.code ? `${w.code} · ` : ''}
                      {w.location || 'Tanpa lokasi'} · {w.product_count} produk berstok
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(w)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-brand-soft"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(w)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card bg-white p-5 shadow-card">
          {mode ? (
            <>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                {mode.kind === 'new' ? `Gudang Baru · ${outletName}` : 'Edit Gudang'}
              </h2>
              <div className="space-y-3">
                <Field label="Nama gudang">
                  <input
                    className={inputCls}
                    placeholder="mis. Gudang Belakang"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kode">
                    <input
                      className={inputCls}
                      placeholder="mis. GDG-02"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </Field>
                  <Field label="Lokasi">
                    <input
                      className={inputCls}
                      placeholder="mis. Lantai 2"
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  Jadikan gudang default (dipakai kasir)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Gudang aktif
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
              Pilih <b>+ Gudang</b> untuk menambah, atau <b>Edit</b> pada baris. Gudang <b>default</b>{' '}
              dipakai kasir untuk memotong stok saat penjualan.
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

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
