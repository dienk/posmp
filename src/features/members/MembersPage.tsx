import { useEffect, useMemo, useState } from 'react'
import {
  createMember,
  listMembers,
  memberPointHistory,
  type Member,
} from './membersRepository'

const REASON_LABEL: Record<string, string> = {
  TRANSACTION_EARNED: 'Poin dari transaksi',
  TRANSACTION_REDEEMED: 'Penukaran poin',
  REFUND_DEDUCTION: 'Koreksi refund',
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const reload = () => setMembers(listMembers(keyword))
  useEffect(reload, [keyword])

  const history = useMemo(
    () => (selected ? memberPointHistory(selected.id) : []),
    [selected],
  )

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      showToast('Nama dan nomor HP wajib diisi.')
      return
    }
    try {
      await createMember(name, phone, email || null)
      setName('')
      setPhone('')
      setEmail('')
      reload()
      showToast('Member ditambahkan.')
    } catch {
      showToast('Nomor HP sudah terdaftar.')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Member & Loyalitas</h1>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Cari nama / nomor HP…"
          className="ml-auto w-64 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_340px]">
        {/* Daftar member */}
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Daftar Member ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Belum ada member.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setSelected(m)}
                    className={
                      'flex w-full items-center justify-between px-2 py-3 text-left transition ' +
                      (selected?.id === m.id ? 'bg-brand-soft' : 'hover:bg-background')
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{m.name}</p>
                      <p className="text-xs text-ink-soft">{m.phone}</p>
                    </div>
                    <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink">
                      {m.points} poin
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tambah member + riwayat */}
        <section className="space-y-4">
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Tambah Member
            </h2>
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="Nama"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Nomor HP"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Email (opsional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                onClick={handleAdd}
                className="w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
              >
                Simpan Member
              </button>
            </div>
          </div>

          {selected && (
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="mb-1 text-sm font-bold text-ink">{selected.name}</h2>
              <p className="mb-3 text-xs text-ink-soft">
                {selected.phone} · {selected.points} poin
              </p>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Riwayat Poin
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-ink-soft">Belum ada aktivitas poin.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {history.map((h, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-ink-soft">
                        {REASON_LABEL[h.change_reason] ?? h.change_reason}
                      </span>
                      <span
                        className={
                          h.points_change >= 0 ? 'font-semibold text-status-empty' : 'text-status-occupied'
                        }
                      >
                        {h.points_change >= 0 ? '+' : ''}
                        {h.points_change}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
