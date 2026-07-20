import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { effectivePerms } from '../access/accessRepository'
import { currentShift, getScheduleConfig } from '../schedule/scheduleConfig'
import {
  cashSalesSince,
  closeCash,
  deleteSession,
  getOpenSession,
  listSessions,
  openCash,
  updateSession,
  type CashSession,
} from './cashRepository'

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

/** Waktu sekarang dalam format input datetime-local (lokal). */
function nowLocalInput(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** datetime-local (lokal) → 'YYYY-MM-DD HH:MM:SS' (UTC, seragam dgn transaction_date). */
function localInputToSql(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}
/** 'YYYY-MM-DD HH:MM:SS' (UTC) → datetime-local (lokal). */
function sqlToLocalInput(v: string | null): string {
  if (!v) return ''
  const d = new Date(v.replace(' ', 'T') + 'Z')
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function CashBalancePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const schedule = useMemo(() => getScheduleConfig(settings), [settings])

  const [session, setSession] = useState<CashSession | null>(null)
  const [liveSales, setLiveSales] = useState(0)
  const [history, setHistory] = useState<CashSession[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Otoritas membuka riwayat kas (persona/peran). null = tanpa pembatasan.
  const canViewHistory = useMemo(() => {
    const perms = effectivePerms(settings)
    return !perms || perms.has('cash_history')
  }, [settings])
  const [historyOpen, setHistoryOpen] = useState(false)

  // Form buka kas
  const [openingBalance, setOpeningBalance] = useState(0)
  const [shiftName, setShiftName] = useState('')
  const [openNote, setOpenNote] = useState('')
  const [openedAtInput, setOpenedAtInput] = useState(() => nowLocalInput())
  // Form tutup kas
  const [closingBalance, setClosingBalance] = useState(0)
  const [closeNote, setCloseNote] = useState('')
  const [closedAtInput, setClosedAtInput] = useState(() => nowLocalInput())
  // Edit entri terakhir
  const [editing, setEditing] = useState<CashSession | null>(null)

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
      await openCash(
        outletId,
        openingBalance,
        shiftName || null,
        openNote,
        openedAtInput ? localInputToSql(openedAtInput) : null,
      )
      setOpeningBalance(0)
      setOpenNote('')
      setOpenedAtInput(nowLocalInput())
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
    if (
      !window.confirm(
        `Tutup kas sekarang?\n\nSaldo fisik: ${formatRupiah(closingBalance)}\nEkspektasi: ${formatRupiah(
          expected,
        )}\nSelisih: ${closeDiff > 0 ? '+' : ''}${formatRupiah(closeDiff)}\n\nTindakan ini mengunci sesi kas.`,
      )
    )
      return
    setSaving(true)
    try {
      const res = await closeCash(
        session.id,
        closingBalance,
        closeNote,
        closedAtInput ? localInputToSql(closedAtInput) : null,
      )
      setClosingBalance(0)
      setCloseNote('')
      setClosedAtInput(nowLocalInput())
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

  const handleDelete = async (s: CashSession) => {
    if (!window.confirm(`Hapus catatan kas ini (dibuka ${s.opened_at})? Tindakan tak bisa dibatalkan.`))
      return
    try {
      await deleteSession(s.id)
      reload()
      showToast('Catatan kas dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  const shiftLabel = schedule.shiftEnabled ? 'shift' : 'toko'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Saldo Kas</h1>
        <span className="text-xs text-ink-soft">Buka & tutup kas per {shiftLabel}</span>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {session ? (
          // ── Sesi terbuka: tutup kas ──────────────────────────────────────
          <section className="rounded-card bg-panel p-5 shadow-card">
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

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                <span className="mb-1 block text-xs font-medium text-ink-soft">Waktu Tutup</span>
                <input
                  type="datetime-local"
                  value={closedAtInput}
                  onChange={(e) => setClosedAtInput(e.target.value)}
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
          <section className="rounded-card bg-panel p-5 shadow-card">
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
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Waktu Buka</span>
                <input
                  type="datetime-local"
                  value={openedAtInput}
                  onChange={(e) => setOpenedAtInput(e.target.value)}
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

        {/* Riwayat sesi kas — di balik otoritas */}
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Riwayat Kas</h2>
            {canViewHistory ? (
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className={
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition ' +
                  (historyOpen
                    ? 'border border-black/10 text-ink hover:bg-background'
                    : 'bg-status-occupied text-white hover:brightness-95')
                }
              >
                {historyOpen ? 'Sembunyikan' : '🔓 Buka Riwayat Kas'}
              </button>
            ) : (
              <span className="rounded-full bg-status-occupied/10 px-3 py-1 text-xs font-semibold text-status-occupied">
                🔒 Perlu otoritas
              </span>
            )}
          </div>

          {!canViewHistory ? (
            <div className="px-5 py-10 text-center text-sm text-ink-soft">
              🔒 Anda tidak memiliki otoritas untuk membuka riwayat kas.
              <br />
              Hubungi supervisor/pemilik untuk hak akses <b>“Buka Riwayat Kas”</b>.
            </div>
          ) : !historyOpen ? (
            <div className="px-5 py-10 text-center text-sm text-ink-soft">
              Riwayat kas tersembunyi. Klik <b>“Buka Riwayat Kas”</b> untuk menampilkan{' '}
              {history.length} catatan.
            </div>
          ) : (
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
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s, i) => (
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
                    <td className="px-4 py-2.5 text-right">
                      {i === 0 ? (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setEditing(s)}
                            className="text-xs font-semibold text-status-occupied hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-xs font-semibold text-status-occupied hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-ink-soft">
                      Belum ada catatan kas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </section>
      </div>

      {editing && (
        <EditSessionModal
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            showToast('Catatan kas diperbarui.')
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: CashSession
  onClose: () => void
  onSaved: () => void
}) {
  const closed = session.status === 'CLOSED'
  const [shift, setShift] = useState(session.shift_name ?? '')
  const [openedAt, setOpenedAt] = useState(sqlToLocalInput(session.opened_at))
  const [opening, setOpening] = useState(session.opening_balance)
  const [closedAt, setClosedAt] = useState(sqlToLocalInput(session.closed_at))
  const [closing, setClosing] = useState(session.closing_balance ?? 0)
  const [note, setNote] = useState(session.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setErr(null)
    try {
      await updateSession(session.id, {
        shiftName: shift,
        openedAt: openedAt ? localInputToSql(openedAt) : null,
        openingBalance: opening,
        closedAt: closed && closedAt ? localInputToSql(closedAt) : undefined,
        closingBalance: closed ? closing : undefined,
        note,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-panel p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Edit Catatan Kas</p>
          <button onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink">
            ×
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Shift (opsional)</span>
            <input value={shift} onChange={(e) => setShift(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Waktu Buka</span>
              <input
                type="datetime-local"
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Saldo Awal (Rp)</span>
              <input
                type="number"
                value={opening}
                onChange={(e) => setOpening(Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
          {closed && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Waktu Tutup</span>
                <input
                  type="datetime-local"
                  value={closedAt}
                  onChange={(e) => setClosedAt(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Saldo Fisik (Rp)</span>
                <input
                  type="number"
                  value={closing}
                  onChange={(e) => setClosing(Number(e.target.value))}
                  className={inputCls}
                />
              </label>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </label>
          <p className="text-[11px] text-ink-soft">
            Ekspektasi & selisih dihitung ulang otomatis dari saldo awal + penjualan tunai pada
            rentang waktu.
          </p>
          {err && <p className="text-xs text-status-occupied">{err}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold text-ink hover:bg-background"
          >
            Batal
          </button>
        </div>
      </div>
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
