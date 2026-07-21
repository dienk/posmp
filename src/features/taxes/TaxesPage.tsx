import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import { createTax, deleteTax, listTaxes, updateTax, type Tax } from './taxesRepository'

type Mode = { kind: 'new' } | { kind: 'edit'; id: number } | null

export default function TaxesPage() {
  const { reloadSettings } = useSettings()
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState({ name: '', rate: 0, description: '', is_default: false, is_active: true })
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => setTaxes(listTaxes())
  useEffect(reload, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const startNew = () => {
    setForm({ name: '', rate: 0, description: '', is_default: false, is_active: true })
    setMode({ kind: 'new' })
  }
  const startEdit = (t: Tax) => {
    setForm({
      name: t.name,
      rate: t.rate,
      description: t.description ?? '',
      is_default: t.is_default === 1,
      is_active: t.is_active === 1,
    })
    setMode({ kind: 'edit', id: t.id })
  }
  const cancel = () => setMode(null)

  const save = async () => {
    if (!form.name.trim()) {
      showToast('Nama pajak wajib diisi.')
      return
    }
    if (form.rate < 0) {
      showToast('Tarif tidak boleh negatif.')
      return
    }
    const input = {
      name: form.name,
      rate: form.rate,
      description: form.description,
      is_default: form.is_default ? 1 : 0,
      is_active: form.is_active ? 1 : 0,
    }
    if (mode?.kind === 'new') await createTax(input)
    else if (mode?.kind === 'edit') await updateTax(mode.id, input)
    reloadSettings() // tarif pajak default aktif dipakai ulang oleh kasir
    cancel()
    reload()
    showToast('Pajak tersimpan.')
  }

  const remove = async (t: Tax) => {
    await deleteTax(t.id)
    reloadSettings()
    reload()
    showToast('Pajak dihapus.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Pajak</h1>
        <span className="text-xs text-ink-soft">{taxes.length} jenis pajak</span>
        <Button size="sm" onClick={startNew} className="ml-auto">
          + Pajak
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-card bg-panel p-2 shadow-card">
          {taxes.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada pajak.</p>
          ) : (
            <ul className="divide-y divide-line/5">
              {taxes.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-ink">
                    {t.rate}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {t.name}
                      {t.is_default === 1 && (
                        <span className="rounded-full bg-status-empty/15 px-2 py-0.5 text-[10px] font-semibold text-status-empty">
                          Default
                        </span>
                      )}
                      {t.is_active !== 1 && (
                        <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {t.description || 'Tanpa deskripsi'}
                    </p>
                  </div>
                  <Button variant="quiet" size="sm" onClick={() => startEdit(t)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(t)}>
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
                {mode.kind === 'new' ? 'Pajak Baru' : 'Edit Pajak'}
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">Nama pajak</span>
                  <input
                    className="field-input"
                    placeholder="mis. PPN / PB1"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Tarif (%)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="field-input"
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) || 0 }))}
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
                    checked={form.is_default}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  Jadikan pajak default (dipakai di kasir)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Pajak aktif
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
              Pilih <b>+ Pajak</b> untuk menambah, atau <b>Edit</b> pada baris. Tarif pajak{' '}
              <b>default aktif</b> otomatis dipakai di kasir; aktif/nonaktifnya pajak di transaksi
              diatur lewat <b>Setelan › Pengaturan</b>.
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
