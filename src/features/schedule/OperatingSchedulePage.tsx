import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import { updateAppSettings } from '../settings/settingsRepository'
import {
  currentShift,
  DAY_LABELS,
  getScheduleConfig,
  isOpenNow,
  newShiftId,
  scheduleToSettings,
  type DayHours,
  type ScheduleConfig,
  type Shift,
} from './scheduleConfig'

const inputCls =
  'rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

export default function OperatingSchedulePage() {
  const { settings, reloadSettings } = useSettings()
  const [cfg, setCfg] = useState<ScheduleConfig>(() => getScheduleConfig(settings))
  const [now, setNow] = useState(() => new Date())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Perbarui status "buka sekarang" tiap 30 detik.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(t)
  }, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const setDay = (idx: number, patch: Partial<DayHours>) =>
    setCfg((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }))

  const setShift = (id: string, patch: Partial<Shift>) =>
    setCfg((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))

  const addShift = () =>
    setCfg((prev) => ({
      ...prev,
      shifts: [
        ...prev.shifts,
        { id: newShiftId(), name: `Shift ${prev.shifts.length + 1}`, from: '08:00', to: '16:00' },
      ],
    }))

  const removeShift = (id: string) =>
    setCfg((prev) => ({ ...prev, shifts: prev.shifts.filter((s) => s.id !== id) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAppSettings(scheduleToSettings(cfg))
      reloadSettings()
      showToast('Jadwal operasi tersimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const open = isOpenNow(cfg, now)
  const shift = currentShift(cfg, now)

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Jadwal Operasi</h1>
        <span
          className={
            'rounded-full px-3 py-1 text-xs font-semibold ' +
            (open ? 'bg-status-empty/15 text-status-empty' : 'bg-status-occupied/15 text-status-occupied')
          }
        >
          ● {open ? 'Buka sekarang' : 'Tutup sekarang'}
          {cfg.shiftEnabled && shift ? ` · ${shift.name}` : ''}
        </span>
        <Button onClick={handleSave} disabled={saving} className="ml-auto">
          {saving ? 'Menyimpan…' : 'Simpan Jadwal'}
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Jam operasional per hari */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Jam Operasional
          </h2>
          <div className="space-y-2">
            {cfg.days.map((d, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-background px-4 py-2.5"
              >
                <label className="flex w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.open}
                    onChange={(e) => setDay(i, { open: e.target.checked })}
                    className="h-4 w-4 accent-status-empty"
                  />
                  <span className="text-sm font-semibold text-ink">{DAY_LABELS[i]}</span>
                </label>
                {d.open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={d.from}
                      onChange={(e) => setDay(i, { from: e.target.value })}
                      className={inputCls}
                    />
                    <span className="text-xs text-ink-soft">s/d</span>
                    <input
                      type="time"
                      value={d.to}
                      onChange={(e) => setDay(i, { to: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-ink-soft">Tutup</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Jam tutup lebih kecil dari jam buka dianggap melewati tengah malam (mis. 18:00–02:00).
          </p>
        </section>

        {/* Shift */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Shift</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cfg.shiftEnabled}
                onChange={(e) => setCfg((prev) => ({ ...prev, shiftEnabled: e.target.checked }))}
                className="h-4 w-4 accent-status-occupied"
              />
              <span className="text-sm font-medium text-ink">Gunakan shift</span>
            </label>
          </div>

          <div className={cfg.shiftEnabled ? '' : 'pointer-events-none opacity-50'}>
            <div className="space-y-2">
              {cfg.shifts.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-background px-4 py-2.5"
                >
                  <input
                    value={s.name}
                    onChange={(e) => setShift(s.id, { name: e.target.value })}
                    placeholder="Nama shift"
                    className="field-input min-w-0 flex-1"
                  />
                  <input
                    type="time"
                    value={s.from}
                    onChange={(e) => setShift(s.id, { from: e.target.value })}
                    className={inputCls}
                  />
                  <span className="text-xs text-ink-soft">s/d</span>
                  <input
                    type="time"
                    value={s.to}
                    onChange={(e) => setShift(s.id, { to: e.target.value })}
                    className={inputCls}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeShift(s.id)}
                    aria-label="Hapus shift"
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {cfg.shifts.length === 0 && (
                <p className="py-2 text-center text-sm text-ink-soft">Belum ada shift.</p>
              )}
            </div>
            <Button size="sm" onClick={addShift} className="mt-3">
              + Tambah Shift
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Bila diaktifkan, shift yang sedang berjalan ditampilkan pada status di atas.
          </p>
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
