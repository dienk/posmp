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

  // Buffer PIN per-persona agar bisa diketik tanpa menyimpan tiap ketukan.
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({})
  const savePin = async (id: string) => {
    const raw = pinDraft[id]
    if (raw === undefined) return
    const pin = raw.replace(/\D/g, '').slice(0, 6)
    await persist(personas.map((p) => (p.id === id ? { ...p, pin: pin || undefined } : p)))
    setPinDraft((m) => {
      const next = { ...m }
      delete next[id]
      return next
    })
    showToast(pin ? 'PIN disimpan.' : 'PIN dikosongkan.')
  }
  const togglePinKasir = (id: string) =>
    persist(personas.map((p) => (p.id === id ? { ...p, pinKasir: !p.pinKasir } : p)))

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
              <li key={p.id} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
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
                    className="field-select w-auto"
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
                    <Button variant="secondary" size="sm" onClick={() => makeActive(p.id)}>
                      Jadikan Aktif
                    </Button>
                  )}
                  <Button variant="danger" size="sm" onClick={() => removePersona(p.id)}>
                    Hapus
                  </Button>
                </div>

                {/* Keamanan Kasir: PIN + wajib PIN buka/tutup Kasir */}
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-background/60 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    🔒 Keamanan Kasir
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-ink">
                    PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      placeholder={p.pin ? '••••••' : 'kosong'}
                      value={pinDraft[p.id] ?? p.pin ?? ''}
                      onChange={(e) =>
                        setPinDraft((m) => ({
                          ...m,
                          [p.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                        }))
                      }
                      onBlur={() => savePin(p.id)}
                      className="w-24 rounded-md border border-line/10 bg-panel px-2 py-1 text-center text-sm tracking-widest outline-none focus:border-brand-strong"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-strong"
                      checked={!!p.pinKasir}
                      onChange={() => togglePinKasir(p.id)}
                    />
                    Wajib PIN saat buka/tutup Kasir
                  </label>
                  {p.pinKasir && !p.pin && (
                    <span className="text-xs font-semibold text-status-occupied">
                      Isi PIN dulu agar berlaku
                    </span>
                  )}
                </div>
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
                className="field-select"
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
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">
          {toast}
        </div>
      )}
    </div>
  )
}
