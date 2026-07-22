import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { getActivePersona } from '../access/accessRepository'
import {
  approveApproval,
  listApprovals,
  rejectApproval,
  type Approval,
} from './approvalsRepository'

const TYPE_LABEL: Record<string, string> = {
  OPNAME: 'Penyesuaian Opname',
  STOCK_TRANSFER: 'Transfer Stok',
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Menunggu', cls: 'bg-status-waiting/20 text-status-waiting' },
  APPROVED: { label: 'Disetujui', cls: 'bg-status-empty/15 text-status-empty' },
  REJECTED: { label: 'Ditolak', cls: 'bg-status-occupied/15 text-status-occupied' },
}

export default function ApprovalPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const approver = useMemo(() => getActivePersona(settings)?.name ?? 'Admin', [settings])

  const [rows, setRows] = useState<Approval[]>([])
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(() => setRows(listApprovals(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const visible = useMemo(
    () => (filter === 'PENDING' ? rows.filter((r) => r.status === 'PENDING') : rows),
    [rows, filter],
  )
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length

  const handleApprove = async (a: Approval) => {
    if (busy) return
    if (!window.confirm(`Setujui "${a.title}"? Aksi akan langsung dijalankan.`)) return
    setBusy(true)
    try {
      const ref = await approveApproval(a.id, approver)
      reload()
      showToast(`Disetujui & dijalankan · ${ref}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyetujui')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (a: Approval) => {
    if (busy) return
    const note = window.prompt(`Tolak "${a.title}"? Beri alasan (opsional):`, '')
    if (note === null) return
    setBusy(true)
    try {
      await rejectApproval(a.id, approver, note)
      reload()
      showToast('Permintaan ditolak.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menolak')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Persetujuan (Approval)</h1>
        {pendingCount > 0 && (
          <span className="rounded-full bg-status-waiting/20 px-2.5 py-0.5 text-xs font-bold text-status-waiting">
            {pendingCount} menunggu
          </span>
        )}
        <nav className="ml-auto flex gap-1 rounded-xl bg-background p-1">
          {(
            [
              ['PENDING', 'Menunggu'],
              ['ALL', 'Semua'],
            ] as [typeof filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition ' +
                (filter === key ? 'bg-panel text-ink shadow-sm' : 'text-ink-soft hover:text-ink')
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">
              {filter === 'PENDING' ? 'Tidak ada permintaan menunggu.' : 'Belum ada permintaan.'}
            </p>
          ) : (
            <ul className="divide-y divide-line/5">
              {visible.map((a) => {
                const sm = STATUS_META[a.status]
                return (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">
                      {a.type === 'OPNAME' ? '📋' : '🔁'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {a.title}
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                          {TYPE_LABEL[a.type] ?? a.type}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.cls}`}>
                          {sm.label}
                        </span>
                      </p>
                      {a.summary && <p className="mt-0.5 text-xs text-ink-soft">{a.summary}</p>}
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        Diminta {a.requested_at}
                        {a.requested_by ? ` · oleh ${a.requested_by}` : ''}
                        {a.status !== 'PENDING' && a.decided_by
                          ? ` · diputus ${a.decided_by} (${a.decided_at})`
                          : ''}
                        {a.result_ref ? ` · ${a.result_ref}` : ''}
                        {a.decision_note ? ` · "${a.decision_note}"` : ''}
                      </p>
                    </div>
                    {a.status === 'PENDING' && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => handleApprove(a)} disabled={busy}>
                          ✓ Setujui
                        </Button>
                        <Button variant="danger-outline" size="sm" onClick={() => handleReject(a)} disabled={busy}>
                          Tolak
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">{toast}</div>
      )}
    </div>
  )
}
