import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../lib/SettingsContext'
import {
  genId,
  loadPersonas,
  loadRoles,
  PERMISSIONS,
  saveRoles,
  type Role,
} from './accessRepository'

export default function RolesPage() {
  const { settings, reloadSettings } = useSettings()
  const [roles, setRoles] = useState<Role[]>(() => loadRoles(settings))
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setRoles(loadRoles(settings)), [settings])

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? null, [roles, selectedId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const persist = async (next: Role[]) => {
    setRoles(next)
    await saveRoles(next)
    reloadSettings()
  }

  const updateSelected = (patch: Partial<Role>) => {
    if (!selected) return
    persist(roles.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)))
  }

  const togglePerm = (key: string) => {
    if (!selected) return
    const has = selected.perms.includes(key)
    updateSelected({
      perms: has ? selected.perms.filter((k) => k !== key) : [...selected.perms, key],
    })
  }

  const addRole = async () => {
    const role: Role = { id: genId('role'), name: 'Peran Baru', perms: [] }
    await persist([...roles, role])
    setSelectedId(role.id)
    showToast('Peran ditambahkan.')
  }

  const deleteRole = async () => {
    if (!selected) return
    const used = loadPersonas(settings).some((p) => p.roleId === selected.id)
    if (used) {
      showToast('Peran sedang dipakai persona — tidak bisa dihapus.')
      return
    }
    const next = roles.filter((r) => r.id !== selected.id)
    await persist(next)
    setSelectedId(next[0]?.id ?? null)
    showToast('Peran dihapus.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Peran & Hak Akses</h1>
        <button
          onClick={addRole}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Peran
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[280px_1fr]">
        {/* Daftar peran */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          <ul className="divide-y divide-line/5">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={
                    'flex w-full items-center justify-between px-3 py-3 text-left transition ' +
                    (selectedId === r.id ? 'bg-brand-soft' : 'hover:bg-background')
                  }
                >
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                  <span className="text-xs text-ink-soft">{r.perms.length} akses</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Editor peran */}
        <section>
          {selected ? (
            <div className="rounded-card bg-panel p-5 shadow-card">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Nama Peran</span>
                <input
                  className="w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </label>

              <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Hak Akses Menu
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSIONS.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center justify-between rounded-lg bg-background px-3 py-2.5"
                  >
                    <span className="text-sm text-ink">{p.label}</span>
                    <input
                      type="checkbox"
                      checked={selected.perms.includes(p.key)}
                      onChange={() => togglePerm(p.key)}
                      className="h-5 w-5 accent-status-empty"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Menu <b>Setelan</b> selalu dapat diakses agar pengaturan tidak terkunci.
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={deleteRole}
                  className="rounded-lg border border-status-occupied px-3 py-2 text-sm font-semibold text-status-occupied hover:bg-status-occupied/10"
                >
                  Hapus Peran
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-card bg-panel text-sm text-ink-soft shadow-card">
              Pilih peran untuk mengatur hak akses.
            </div>
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
