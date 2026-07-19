import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { currentShift, getScheduleConfig } from '../schedule/scheduleConfig'
import {
  cashSalesSince,
  closeCash,
  getOpenSession,
  listSessions,
  openCash,
  type CashSession,
} from './cashRepository'

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

export default function CashBalancePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const schedule = useMemo(() => getScheduleConfig(settings), [settings])

  const [session, setSession] = useState<CashSession | null>(null)
  const [liveSales, setLiveSales] = useState(0)
  const [history, setHistory] = useState<CashSession[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form buka kas
  const [openingBalance, setOpeningBalance] = useState(0)
  const [shiftName, setShiftName] = useState('')
  const [openNote, setOpenNote] = useState('')
  // Form tutup kas
  const [closingBalance, setClosingBalance] = useState(0)
  const [closeNote, setCloseNote] = useState('')

  const reload = useCallback(() => {
    const s = getOpenSession(outletId)
    setSession(s)
    setLiveSales(s ? cashSalesSince(outletId, s.opened_at) : 0)
    setHistory(listSessions(outletId))
  }, [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  // Prefill shift dengan shift berjalan bila memakai shift.
  useEffect(() => {
    if (schedule.shiftEnabled && !shiftName) {
      const cur = currentShift(schedule, new Date())
      if (cur) setShiftName(cur.name)
    }
  }, [schedule, shiftName])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const expected = session ? session.opening_balance + liveSales : 0
  const closeDiff = closingBalance - expected

  const handleOpen = async () => {
    if (saving) return
    setSaving(true)
    try {
      await openCash(outletId, openingBalance, shiftName || null, openNote)
      setOpeningBalance(0)
      setOpenNote('')
      reload()
      showToast('Kas dibuka.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuka kas')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (saving || !session) return
    setSaving(true)
    try {
      const res = await closeCash(session.id, closingBalance, closeNote)
      setClosingBalance(0)
      setCloseNote('')
      reload()
      showToast(
        `Kas ditutup · selisih ${res.difference === 0 ? 'nihil' : (res.difference > 0 ? '+' : '') + formatRupiah(res.difference)}`,
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menutup kas')
    } finally {
      setSaving(false)
    }
  }

  const shiftLabel = schedule.shiftEnabled ? 'shift' : 'toko'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Saldo Kas</h1>
        <span className="text-xs text-ink-soft">Buka & tutup kas per {shiftLabel}</span>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {session ? (
          // ── Sesi terbuka: tutup kas ──────────────────────────────────────
          <section className="rounded-card bg-white p-5 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Kas Terbuka
              </h2>
              <span className="rounded-full bg-status-empty/15 px-2.5 py-0.5 text-xs font-semibold text-status-empty">
                ● Buka
              </span>
              {session.shift_name && (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-ink">
                  Shift: {session.shift_name}
                </span>
              )}
              <span className="text-xs text-ink-soft">dibuka {session.opened_at}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Saldo Awal" value={formatRupiah(session.opening_balance)} />
              <Stat label="Penjualan Tunai" value={formatRupiah(liveSales)} />
              <Stat label="Ekspektasi Kas" value={formatRupiah(expected)} accent />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Saldo Fisik Saat Tutup (Rp)
                </span>
                <input
                  type="number"
                  min={0}
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(Number(e.target.value))}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan (opsional)</span>
                <input
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="mis. selisih receh, setoran"
                  className={inputCls}
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink-soft">
                Selisih:{' '}
                <b
                  className={
                    closeDiff === 0
                      ? 'text-ink'
                      : closeDiff > 0
                        ? 'text-status-empty'
                        : 'text-status-occupied'
                  }
                >
                  {closeDiff > 0 ? '+' : ''}
                  {formatRupiah(closeDiff)}
                </b>{' '}
                <span className="text-xs">(fisik − ekspektasi)</span>
              </span>
              <button
                onClick={handleClose}
                disabled={saving}
                className="ml-auto rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
              >
                {saving ? 'Menutup…' : 'Tutup Kas'}
              </button>
            </div>
          </section>
        ) : (
          // ── Tidak ada sesi: buka kas ─────────────────────────────────────
          <section className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Buka Kas</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Saldo Awal (Rp)</span>
                <input
                  type="number"
                  min={0}
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  className={inputCls}
                />
              </label>
              {schedule.shiftEnabled && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Shift</span>
                  <select
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Tanpa shift —</option>
                    {schedule.shifts.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.from}–{s.to})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan (opsional)</span>
                <input
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  placeholder="mis. modal kas awal"
                  className={inputCls}
                />
              </label>
            </div>
            <button
              onClick={handleOpen}
              disabled={saving}
              className="mt-4 rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
            >
              {saving ? 'Membuka…' : 'Buka Kas'}
            </button>
          </section>
        )}

        {/* Riwayat sesi kas */}
        <section className="overflow-hidden rounded-card bg-white shadow-card">
          <h2 className="border-b border-black/5 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Riwayat Kas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                  <th className="px-4 py-2.5">Buka</th>
                  <th className="px-4 py-2.5">Tutup</th>
                  <th className="px-4 py-2.5">Shift</th>
                  <th className="px-4 py-2.5 text-right">Saldo Awal</th>
                  <th className="px-4 py-2.5 text-right">Tunai</th>
                  <th className="px-4 py-2.5 text-right">Ekspektasi</th>
                  <th className="px-4 py-2.5 text-right">Saldo Tutup</th>
                  <th className="px-4 py-2.5 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-black/5 hover:bg-background">
                    <td className="px-4 py-2.5 text-ink-soft">{s.opened_at}</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {s.status === 'OPEN' ? (
                        <span className="font-semibold text-status-empty">— terbuka —</span>
                      ) : (
                        s.closed_at
                      )}
                    </td>
                    <td className="px-4 py-2.5">{s.shift_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{formatRupiah(s.opening_balance)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {s.cash_sales == null ? '—' : formatRupiah(s.cash_sales)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.expected_balance == null ? '—' : formatRupiah(s.expected_balance)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.closing_balance == null ? '—' : formatRupiah(s.closing_balance)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {s.difference == null ? (
                        '—'
                      ) : (
                        <span
                          className={
                            s.difference === 0
                              ? 'text-ink'
                              : s.difference > 0
                                ? 'text-status-empty'
                                : 'text-status-occupied'
                          }
                        >
                          {s.difference > 0 ? '+' : ''}
                          {formatRupiah(s.difference)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-soft">
                      Belum ada catatan kas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-status-occupied text-white' : 'bg-background'}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${accent ? 'text-white/80' : 'text-ink-soft'}`}>
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-extrabold ${accent ? 'text-white' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
