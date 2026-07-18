import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import {
  createMember,
  deleteMember,
  listMembers,
  memberPointHistory,
  memberTransactions,
  STATUSES,
  TIERS,
  updateMember,
  type Member,
  type MemberInput,
  type MemberStatus,
  type MemberTier,
} from './membersRepository'

const TIER_STYLE: Record<MemberTier, string> = {
  SILVER: 'bg-slate-200 text-slate-700',
  GOLD: 'bg-status-waiting/20 text-status-waiting',
  PLATINUM: 'bg-brand-soft text-ink',
  DIAMOND: 'bg-sky-100 text-sky-700',
}
const STATUS_STYLE: Record<MemberStatus, string> = {
  ACTIVE: 'bg-status-empty/15 text-status-empty',
  INACTIVE: 'bg-ink/10 text-ink-soft',
  SUSPENDED: 'bg-status-waiting/20 text-status-waiting',
  BLOCKED: 'bg-status-occupied/15 text-status-occupied',
}
const statusLabel = (s: MemberStatus) => STATUSES.find((x) => x.value === s)?.label ?? s
const REASON: Record<string, string> = {
  TRANSACTION_EARNED: 'Poin dari transaksi',
  TRANSACTION_REDEEMED: 'Penukaran poin',
  REFUND_DEDUCTION: 'Koreksi refund',
}

const EMPTY: MemberInput = {
  name: '',
  phone: '',
  email: '',
  address: '',
  birthDate: '',
  gender: '',
  occupation: '',
  memberNumber: '',
  tier: 'SILVER',
  expiryDate: '',
  status: 'ACTIVE',
  balance: 0,
  preferences: '',
}

type Mode = { kind: 'view'; id: number } | { kind: 'form'; id: number | 'new' } | null

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<Mode>(null)
  const [form, setForm] = useState<MemberInput>(EMPTY)
  const [toast, setToast] = useState<string | null>(null)

  const reload = () => setMembers(listMembers(keyword))
  useEffect(reload, [keyword])

  const selected = useMemo(
    () => (mode?.kind === 'view' ? members.find((m) => m.id === mode.id) : undefined),
    [mode, members],
  )
  const txs = useMemo(() => (selected ? memberTransactions(selected.id) : []), [selected])
  const points = useMemo(() => (selected ? memberPointHistory(selected.id) : []), [selected])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }
  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const startNew = () => {
    setForm(EMPTY)
    setMode({ kind: 'form', id: 'new' })
  }
  const startEdit = (m: Member) => {
    setForm({
      name: m.name,
      phone: m.phone,
      email: m.email ?? '',
      address: m.address ?? '',
      birthDate: m.birth_date ?? '',
      gender: m.gender ?? '',
      occupation: m.occupation ?? '',
      memberNumber: m.member_number ?? '',
      tier: m.tier,
      expiryDate: m.expiry_date ?? '',
      status: m.status,
      balance: m.balance,
      preferences: m.preferences ?? '',
    })
    setMode({ kind: 'form', id: m.id })
  }

  const save = async () => {
    if (mode?.kind !== 'form') return
    if (!form.name.trim() || !form.phone.trim()) {
      showToast('Nama & nomor kontak wajib diisi.')
      return
    }
    try {
      if (mode.id === 'new') {
        const id = await createMember(form)
        reload()
        setMode({ kind: 'view', id })
      } else {
        const id = mode.id
        await updateMember(id, form)
        reload()
        setMode({ kind: 'view', id })
      }
      showToast('Member tersimpan.')
    } catch {
      showToast('Gagal menyimpan (nomor HP mungkin sudah terdaftar).')
    }
  }

  const remove = async (m: Member) => {
    try {
      await deleteMember(m.id)
      setMode(null)
      reload()
      showToast('Member dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Member & Loyalitas</h1>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Cari nama / HP / no. kartu…"
          className="w-64 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
        />
        <button
          onClick={startNew}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          + Member
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[320px_1fr]">
        {/* Daftar member */}
        <section className="rounded-card bg-white p-2 shadow-card">
          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada member.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setMode({ kind: 'view', id: m.id })}
                    className={
                      'flex w-full items-center gap-3 px-3 py-3 text-left transition ' +
                      (mode && 'id' in mode && mode.id === m.id ? 'bg-brand-soft' : 'hover:bg-background')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                      <p className="text-xs text-ink-soft">
                        {m.phone} · {m.member_number ?? '—'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_STYLE[m.tier]}`}>
                      {m.tier}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Detail / Form */}
        <section>
          {mode?.kind === 'form' ? (
            <MemberForm
              isNew={mode.id === 'new'}
              form={form}
              set={set}
              onSave={save}
              onCancel={() => setMode(mode.id === 'new' ? null : { kind: 'view', id: mode.id })}
            />
          ) : selected ? (
            <MemberDetail
              m={selected}
              txs={txs}
              points={points}
              onEdit={() => startEdit(selected)}
              onDelete={() => remove(selected)}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-card bg-white text-sm text-ink-soft shadow-card">
              Pilih member untuk melihat detail, atau “+ Member”.
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

// ---------- Detail ----------
function MemberDetail({
  m,
  txs,
  points,
  onEdit,
  onDelete,
}: {
  m: Member
  txs: ReturnType<typeof memberTransactions>
  points: ReturnType<typeof memberPointHistory>
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-card bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{m.name}</h2>
            <p className="text-sm text-ink-soft">
              {m.member_number ?? '—'} · Bergabung {m.created_at?.slice(0, 10)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${TIER_STYLE[m.tier]}`}>{m.tier}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[m.status]}`}>
              {statusLabel(m.status)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Poin" value={String(m.points)} accent />
          <Stat label="Saldo/Kredit" value={formatRupiah(m.balance)} />
          <Stat label="Masa Berlaku" value={m.expiry_date ?? '—'} />
        </div>

        <Section title="Identitas Pribadi">
          <Field label="Nomor Kontak" value={m.phone} />
          <Field label="Email" value={m.email} />
          <Field label="Alamat" value={m.address} />
          <Field label="Tanggal Lahir" value={m.birth_date} />
          <Field label="Jenis Kelamin" value={m.gender === 'L' ? 'Laki-laki' : m.gender === 'P' ? 'Perempuan' : null} />
          <Field label="Pekerjaan" value={m.occupation} />
        </Section>
        <Section title="Preferensi Produk">
          <p className="text-sm text-ink">{m.preferences || '—'}</p>
        </Section>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onEdit}
            className="rounded-xl bg-status-occupied px-5 py-2.5 text-sm font-bold text-white hover:brightness-95"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-xl border border-status-occupied px-4 py-2.5 text-sm font-semibold text-status-occupied hover:bg-status-occupied/10"
          >
            Hapus
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card bg-white p-5 shadow-card">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Riwayat Transaksi
          </h3>
          {txs.length === 0 ? (
            <p className="text-sm text-ink-soft">Belum ada transaksi.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {txs.map((t, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-ink-soft">
                    {t.invoice_number}
                    <span className="ml-1 text-xs">{t.transaction_date?.slice(0, 10)}</span>
                  </span>
                  <span className="font-semibold text-ink">{formatRupiah(t.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-card bg-white p-5 shadow-card">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Riwayat Poin & Penukaran
          </h3>
          {points.length === 0 ? (
            <p className="text-sm text-ink-soft">Belum ada aktivitas poin.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {points.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-ink-soft">{REASON[p.change_reason] ?? p.change_reason}</span>
                  <span className={p.points_change >= 0 ? 'font-semibold text-status-empty' : 'text-status-occupied'}>
                    {p.points_change >= 0 ? '+' : ''}
                    {p.points_change}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Form ----------
function MemberForm({
  isNew,
  form,
  set,
  onSave,
  onCancel,
}: {
  isNew: boolean
  form: MemberInput
  set: <K extends keyof MemberInput>(k: K, v: MemberInput[K]) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <h2 className="mb-3 text-base font-bold text-ink">{isNew ? 'Member Baru' : 'Edit Member'}</h2>

      <FormSection title="Identitas Pribadi">
        <Input label="Nama Lengkap *" value={form.name} onChange={(v) => set('name', v)} />
        <Input label="Nomor Kontak *" value={form.phone} onChange={(v) => set('phone', v)} />
        <Input label="Email" value={form.email ?? ''} onChange={(v) => set('email', v)} />
        <Input label="Pekerjaan" value={form.occupation ?? ''} onChange={(v) => set('occupation', v)} />
        <div>
          <Label>Jenis Kelamin</Label>
          <select className={inputCls} value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </div>
        <Input label="Tanggal Lahir" type="date" value={form.birthDate ?? ''} onChange={(v) => set('birthDate', v)} />
        <div className="sm:col-span-2">
          <Label>Alamat Domisili</Label>
          <textarea
            rows={2}
            className={inputCls}
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
      </FormSection>

      <FormSection title="Keanggotaan">
        <Input
          label="Nomor Kartu"
          value={form.memberNumber ?? ''}
          onChange={(v) => set('memberNumber', v)}
          placeholder="otomatis bila kosong"
        />
        <div>
          <Label>Tingkatan</Label>
          <select className={inputCls} value={form.tier} onChange={(e) => set('tier', e.target.value as MemberTier)}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Status Akun</Label>
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => set('status', e.target.value as MemberStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Input label="Masa Berlaku" type="date" value={form.expiryDate ?? ''} onChange={(v) => set('expiryDate', v)} />
      </FormSection>

      <FormSection title="Loyalitas">
        <Input
          label="Saldo / Kredit (Rp)"
          type="number"
          value={String(form.balance ?? 0)}
          onChange={(v) => set('balance', Number(v))}
        />
        <Input
          label="Preferensi Produk"
          value={form.preferences ?? ''}
          onChange={(v) => set('preferences', v)}
          placeholder="mis. Kopi, Makanan Ringan"
        />
      </FormSection>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          className="rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95"
        >
          Simpan
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
        >
          Batal
        </button>
      </div>
    </div>
  )
}

// ---------- Bits ----------
const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-ink-soft">{children}</span>
}
function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type={type}
        className={inputCls}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-black/5 pt-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{children}</div>
    </div>
  )
}
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value || '—'}</span>
    </div>
  )
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'bg-status-occupied text-white' : 'bg-background'}`}>
      <p className={`text-xs ${accent ? 'text-white/80' : 'text-ink-soft'}`}>{label}</p>
      <p className={`text-lg font-extrabold ${accent ? 'text-white' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
