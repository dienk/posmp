import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import { createMember, listMembers, type Member } from '../members/membersRepository'
import { createSupplier, listSuppliers, type Supplier } from '../stockin/stockInRepository'
import {
  genId,
  loadPersonas,
  loadRoles,
  savePersonas,
  type Persona,
} from '../access/accessRepository'
import { loadSellers, newSeller, saveSellers, type Seller } from './sellersRepository'

type Tab = 'pelanggan' | 'pemasok' | 'karyawan' | 'penjual'
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'pelanggan', label: 'Pelanggan', icon: '⭐' },
  { key: 'pemasok', label: 'Pemasok', icon: '🚚' },
  { key: 'karyawan', label: 'Karyawan', icon: '🧑‍💼' },
  { key: 'penjual', label: 'Penjual', icon: '🤝' },
]

export default function ContactsPage() {
  const { settings, reloadSettings } = useSettings()
  const roles = useMemo(() => loadRoles(settings), [settings])
  const [tab, setTab] = useState<Tab>('pelanggan')

  const [members, setMembers] = useState<Member[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [extra, setExtra] = useState('') // email / kontak / peran / catatan
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => {
    setMembers(listMembers())
    setSuppliers(listSuppliers())
    setPersonas(loadPersonas(settings))
    setSellers(loadSellers(settings))
  }
  useEffect(reload, [settings])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }
  const clearForm = () => {
    setName('')
    setPhone('')
    setExtra('')
  }

  const add = async () => {
    if (!name.trim()) {
      showToast('Nama wajib diisi.')
      return
    }
    try {
      if (tab === 'pelanggan') {
        if (!phone.trim()) return showToast('Nomor HP wajib untuk pelanggan.')
        await createMember({ name, phone, email: extra || null })
        setMembers(listMembers())
      } else if (tab === 'pemasok') {
        await createSupplier({
          name,
          contactName: extra || null,
          phone: phone || null,
          address: null,
          isActive: 1,
        })
        setSuppliers(listSuppliers())
      } else if (tab === 'karyawan') {
        const next = [
          ...personas,
          { id: genId('psn'), name: name.trim(), roleId, phone: phone.trim() || undefined },
        ]
        await savePersonas(next)
        reloadSettings()
      } else {
        await saveSellers([...sellers, newSeller(name, phone, extra)])
        reloadSettings()
      }
      clearForm()
      showToast('Kontak ditambahkan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menambah (mungkin duplikat).')
    }
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? '—'

  const rows: { title: string; subtitle: string }[] =
    tab === 'pelanggan'
      ? members.map((m) => ({ title: m.name, subtitle: `${m.phone} · ${m.points} poin` }))
      : tab === 'pemasok'
        ? suppliers.map((s) => ({
            title: s.name,
            subtitle: [s.contact_name, s.phone].filter(Boolean).join(' · ') || '—',
          }))
        : tab === 'karyawan'
          ? personas.map((p) => ({ title: p.name, subtitle: roleName(p.roleId) }))
          : sellers.map((s) => ({ title: s.name, subtitle: [s.phone, s.note].filter(Boolean).join(' · ') || '—' }))

  const extraPlaceholder =
    tab === 'pelanggan' ? 'Email (opsional)' : tab === 'pemasok' ? 'Nama kontak (opsional)' : 'Catatan (opsional)'

  return (
    <div className="flex h-full flex-col">
      <header className="bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Contact</h1>
      </header>

      {/* Tab */}
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              clearForm()
            }}
            className={
              'rounded-full px-4 py-1.5 text-sm font-medium transition ' +
              (tab === t.key ? 'bg-status-occupied text-white shadow' : 'bg-panel text-ink hover:bg-brand-soft')
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
        {/* Daftar */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada data.</p>
          ) : (
            <ul className="divide-y divide-line/5">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-ink">
                    {r.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{r.title}</p>
                    <p className="text-xs text-ink-soft">{r.subtitle}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tambah */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Tambah {TABS.find((t) => t.key === tab)?.label}
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
              placeholder={tab === 'pelanggan' ? 'Nomor HP' : 'Telepon (opsional)'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {tab === 'karyawan' ? (
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
            ) : (
              <input
                className="field-input"
                placeholder={extraPlaceholder}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            )}
            <Button onClick={add} className="w-full">
              Simpan
            </Button>
            {tab === 'karyawan' && (
              <p className="text-xs text-ink-soft">
                Karyawan = persona; kelola persona aktif & peran di <b>Setelan</b>.
              </p>
            )}
          </div>
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

const inputCls =
  'w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
