import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import { login } from '../../lib/session'
import {
  createDatabase,
  getCurrentDbId,
  listDatabases,
  switchDatabase,
} from '../../db/database'
import { loadPersonas, loadRoles, setActivePersona } from '../access/accessRepository'

/**
 * Halaman login (tanpa password): pilih Database lalu pilih User (Persona).
 * PIN hanya diminta saat buka/tutup Kasir (lihat KasirPinGate), bukan di login.
 */
export default function LoginPage() {
  const { settings, reloadSettings } = useSettings()
  const navigate = useNavigate()

  const databases = useMemo(() => listDatabases(), [])
  const currentDb = getCurrentDbId()
  const personas = useMemo(() => loadPersonas(settings), [settings])
  const roles = useMemo(() => loadRoles(settings), [settings])
  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? '—'

  const [adding, setAdding] = useState(false)
  const [newDb, setNewDb] = useState('')

  const onPickDb = (id: string) => {
    if (id !== currentDb) switchDatabase(id) // memuat ulang halaman
  }
  const onCreateDb = () => {
    const label = newDb.trim()
    if (!label) return
    const slot = createDatabase(label)
    switchDatabase(slot.id) // pindah ke DB baru (reload → di-seed otomatis)
  }

  const onPickUser = async (id: string) => {
    await setActivePersona(id)
    reloadSettings()
    login(id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl bg-panel p-7 shadow-panel">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/logo-mark.png"
            alt="POS Merah Putih"
            className="h-16 w-16 rounded-2xl object-contain"
          />
          <h1 className="mt-3 text-xl font-extrabold text-ink">Masuk</h1>
          <p className="text-sm text-ink-soft">Pilih database & pengguna untuk mulai</p>
        </div>

        {/* Pilih database */}
        <div className="mb-5">
          <span className="field-label">Database</span>
          {adding ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newDb}
                onChange={(e) => setNewDb(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCreateDb()
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setNewDb('')
                  }
                }}
                placeholder="Nama database baru"
                className="field-input"
              />
              <Button size="sm" onClick={onCreateDb} disabled={!newDb.trim()}>
                Buat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false)
                  setNewDb('')
                }}
              >
                Batal
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={currentDb}
                onChange={(e) => onPickDb(e.target.value)}
                className="field-select"
              >
                {databases.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)} title="Buat database baru">
                + Baru
              </Button>
            </div>
          )}
        </div>

        {/* Pilih pengguna */}
        <span className="field-label">Pengguna</span>
        <div className="grid grid-cols-2 gap-2.5">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => onPickUser(p.id)}
              className="flex flex-col items-center gap-2 rounded-xl border border-line/10 bg-background p-4 text-center transition hover:border-brand-strong hover:bg-brand-soft active:scale-95"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-ink">
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 text-sm font-semibold text-ink">{p.name}</span>
              <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                {roleName(p.roleId)}
              </span>
            </button>
          ))}
          {personas.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-ink-soft">
              Belum ada pengguna. Tambah di Setelan › Persona.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
