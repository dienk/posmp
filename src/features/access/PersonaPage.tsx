import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import {
  genId,
  getActivePersonaId,
  loadPersonas,
  loadRoles,
  savePersonas,
  setActivePersona,
  type Persona,
} from './accessRepository'

export default function PersonaPage() {
  const { settings, reloadSettings } = useSettings()
  const roles = useMemo(() => loadRoles(settings), [settings])
  const [personas, setPersonas] = useState<Persona[]>(() => loadPersonas(settings))
  const [activeId, setActiveId] = useState(() => getActivePersonaId(settings))
  const [toast, setToast] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')

  useEffect(() => {
    setPersonas(loadPersonas(settings))
    setActiveId(getActivePersonaId(settings))
  }, [settings])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const persist = async (next: Persona[]) => {
    setPersonas(next)
    await savePersonas(next)
    reloadSettings()
  }

  const addPersona = async () => {
    if (!name.trim() || !roleId) {
      showToast('Nama & peran wajib diisi.')
      return
    }
    await persist([
      ...personas,
      { id: genId('psn'), name: name.trim(), roleId, phone: phone.trim() || undefined },
    ])
    setName('')
    setPhone('')
    showToast('Persona ditambahkan.')
  }

  const changeRole = (id: string, newRoleId: string) =>
    persist(personas.map((p) => (p.id === id ? { ...p, roleId: newRoleId } : p)))

  const removePersona = async (id: string) => {
    if (id === activeId) {
      showToast('Tidak bisa menghapus persona yang sedang aktif.')
      return
    }
    await persist(personas.filter((p) => p.id !== id))
    showToast('Persona dihapus.')
  }

  const makeActive = async (id: string) => {
    await setActivePersona(id)
    setActiveId(id)
    reloadSettings()
    showToast('Persona aktif diperbarui — menu menyesuaikan hak akses.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Persona</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        {/* Daftar persona */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          <ul className="divide-y divide-line/5">
            {personas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-ink">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {p.name}
                    {p.id === activeId && (
                      <span className="ml-2 rounded-full bg-status-empty/15 px-2 py-0.5 text-xs font-semibold text-status-empty">
                        Aktif
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">{p.phone ?? 'tanpa telepon'}</p>
                </div>
                <select
                  value={p.roleId}
                  onChange={(e) => changeRole(p.id, e.target.value)}
                  className="rounded-lg border border-line/10 bg-panel px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {p.id === activeId ? (
                  <span className="text-xs font-semibold text-ink-soft">terpilih</span>
                ) : (
                  <button
                    onClick={() => makeActive(p.id)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-strong"
                  >
                    Jadikan Aktif
                  </button>
                )}
                <Button variant="danger" size="sm" onClick={() => removePersona(p.id)}>
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        </section>

        {/* Tambah persona */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Tambah Persona
          </h2>
          <div className="space-y-3">
            <input
              className="field-input"
              placeholder="Nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="field-input"
              placeholder="Telepon (opsional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <label className="block">
              <span className="field-label">Peran</span>
              <select
                className={inputCls}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={addPersona} className="w-full">
              Simpan Persona
            </Button>
            <p className="text-xs text-ink-soft">
              Peran ditentukan di <b>Setelan › Peran & Hak Akses</b>. Persona yang aktif menentukan
              menu yang tampil di sidebar.
            </p>
          </div>
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
