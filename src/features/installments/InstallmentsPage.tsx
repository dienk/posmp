import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { listMembers, type Member } from '../members/membersRepository'
import {
  computeTotalPayable,
  createPlan,
  listPlans,
  payInstallment,
  type InstallmentPlan,
  type InstallmentStatus,
} from './installmentsRepository'

const STATUS_STYLE: Record<InstallmentStatus, { label: string; cls: string }> = {
  UNPAID: { label: 'Belum bayar', cls: 'bg-status-waiting/15 text-status-waiting' },
  PARTIALLY_PAID: { label: 'Sebagian', cls: 'bg-brand-soft text-ink' },
  PAID: { label: 'Lunas', cls: 'bg-status-empty/15 text-status-empty' },
  OVERDUE: { label: 'Terlambat', cls: 'bg-status-occupied/15 text-status-occupied' },
}

export default function InstallmentsPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<InstallmentPlan[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const [memberId, setMemberId] = useState<number | ''>('')
  const [principal, setPrincipal] = useState(1000000)
  const [tenure, setTenure] = useState(6)
  const [interest, setInterest] = useState(2)

  const reload = useCallback(() => setPlans(listPlans(outletId)), [outletId])
  useEffect(() => {
    setMembers(listMembers())
    reload()
  }, [reload])
  useRealtime('order:update', reload)

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const monthly = useMemo(
    () => Math.ceil(computeTotalPayable(principal, tenure, interest) / Math.max(1, tenure)),
    [principal, tenure, interest],
  )
  // Total = jumlah seluruh angsuran (konsisten dengan pencatatan di database).
  const totalPayable = useMemo(() => monthly * tenure, [monthly, tenure])

  const handleCreate = async () => {
    if (memberId === '') {
      showToast('Pilih member terlebih dahulu.')
      return
    }
    if (principal <= 0 || tenure <= 0) {
      showToast('Pokok & tenor harus lebih dari 0.')
      return
    }
    await createPlan({ outletId, memberId, principal, tenure, interestRate: interest })
    reload()
    showToast('Rencana cicilan dibuat.')
  }

  const handlePay = async (plan: InstallmentPlan) => {
    const amount = Math.min(plan.monthly_installment, plan.remaining_balance)
    await payInstallment(plan.id, amount)
    reload()
    showToast(`Angsuran ${formatRupiah(amount)} tercatat.`)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Cicilan Internal</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[340px_1fr]">
        {/* Form buat rencana */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Buat Rencana Cicilan
          </h2>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Member</span>
              <select
                className={inputCls}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Pilih member —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.phone})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Pokok (Rp)</span>
              <input
                type="number"
                className={inputCls}
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Tenor (bulan)</span>
                <input
                  type="number"
                  className={inputCls}
                  value={tenure}
                  onChange={(e) => setTenure(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Bunga (%/bln)</span>
                <input
                  type="number"
                  className={inputCls}
                  value={interest}
                  onChange={(e) => setInterest(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="rounded-lg bg-background p-3 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Total bayar</span>
                <span className="font-semibold text-ink">{formatRupiah(totalPayable)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Angsuran / bulan</span>
                <span className="font-semibold text-status-occupied">{formatRupiah(monthly)}</span>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
            >
              Buat Cicilan
            </button>
          </div>
        </section>

        {/* Daftar rencana */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          {plans.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada rencana cicilan.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {plans.map((p) => {
                const paid = p.total_payable - p.remaining_balance
                const pct = Math.min(100, Math.round((paid / p.total_payable) * 100))
                const st = STATUS_STYLE[p.status]
                return (
                  <li key={p.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {p.member_name}{' '}
                          <span className="text-xs font-normal text-ink-soft">
                            · {p.invoice_number}
                          </span>
                        </p>
                        <p className="text-xs text-ink-soft">
                          {p.total_tenure} bln · bunga {p.interest_rate}%/bln · jatuh tempo{' '}
                          {p.due_date}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="my-2 h-2 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-status-empty" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-soft">
                        Sisa <span className="font-bold text-ink">{formatRupiah(p.remaining_balance)}</span>{' '}
                        / {formatRupiah(p.total_payable)}
                      </span>
                      {p.status !== 'PAID' && (
                        <button
                          onClick={() => handlePay(p)}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-strong"
                        >
                          Bayar {formatRupiah(Math.min(p.monthly_installment, p.remaining_balance))}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
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
