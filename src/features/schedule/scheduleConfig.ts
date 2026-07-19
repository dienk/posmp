// Konfigurasi Jadwal Operasi (jam buka per hari) + opsi shift.
// Disimpan di app_settings sebagai JSON.

/** Label hari, index 0 = Senin … 6 = Minggu. */
export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export interface DayHours {
  open: boolean
  from: string // 'HH:MM'
  to: string // 'HH:MM'
}

export interface Shift {
  id: string
  name: string
  from: string // 'HH:MM'
  to: string // 'HH:MM'
}

export interface ScheduleConfig {
  days: DayHours[] // panjang 7, index 0 = Senin
  shiftEnabled: boolean
  shifts: Shift[]
}

const defaultDay = (): DayHours => ({ open: true, from: '08:00', to: '22:00' })

export const SCHEDULE_DEFAULTS: ScheduleConfig = {
  days: DAY_LABELS.map(defaultDay),
  shiftEnabled: false,
  shifts: [
    { id: 'pagi', name: 'Pagi', from: '08:00', to: '16:00' },
    { id: 'malam', name: 'Malam', from: '16:00', to: '22:00' },
  ],
}

const HHMM = /^\d{2}:\d{2}$/
const time = (v: unknown, def: string): string => (typeof v === 'string' && HHMM.test(v) ? v : def)

export function newShiftId(): string {
  return 'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function getScheduleConfig(settings: Record<string, string>): ScheduleConfig {
  let days = SCHEDULE_DEFAULTS.days
  try {
    const arr = settings.schedule_days ? JSON.parse(settings.schedule_days) : null
    if (Array.isArray(arr) && arr.length === 7) {
      days = arr.map((d) => ({
        open: d?.open !== false,
        from: time(d?.from, '08:00'),
        to: time(d?.to, '22:00'),
      }))
    }
  } catch {
    /* pakai default */
  }
  let shifts = SCHEDULE_DEFAULTS.shifts
  try {
    const arr = settings.schedule_shifts ? JSON.parse(settings.schedule_shifts) : null
    if (Array.isArray(arr)) {
      shifts = arr
        .filter((s) => s && typeof s.id === 'string')
        .map((s) => ({
          id: s.id,
          name: typeof s.name === 'string' && s.name.trim() ? s.name : 'Shift',
          from: time(s.from, '08:00'),
          to: time(s.to, '16:00'),
        }))
    }
  } catch {
    /* pakai default */
  }
  return {
    days,
    shiftEnabled: settings.schedule_shift_enabled === '1',
    shifts,
  }
}

export function scheduleToSettings(c: ScheduleConfig): Record<string, string> {
  return {
    schedule_days: JSON.stringify(c.days),
    schedule_shift_enabled: c.shiftEnabled ? '1' : '0',
    schedule_shifts: JSON.stringify(c.shifts),
  }
}

/** Cek apakah `cur` (HH:MM) berada dalam rentang [from,to) — menangani lewat tengah malam. */
export function inRange(cur: string, from: string, to: string): boolean {
  if (from === to) return true // 24 jam
  if (to > from) return cur >= from && cur < to
  return cur >= from || cur < to // rentang melewati tengah malam
}

/** Index hari (0 = Senin) dari objek Date. */
export function dayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** 'HH:MM' dari objek Date (waktu lokal). */
export function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Apakah outlet buka pada waktu `now` menurut jadwal. */
export function isOpenNow(c: ScheduleConfig, now: Date): boolean {
  const d = c.days[dayIndex(now)]
  if (!d || !d.open) return false
  return inRange(hhmm(now), d.from, d.to)
}

/** Shift yang sedang berjalan pada `now` (null bila tak ada / shift nonaktif). */
export function currentShift(c: ScheduleConfig, now: Date): Shift | null {
  if (!c.shiftEnabled) return null
  const cur = hhmm(now)
  return c.shifts.find((s) => inRange(cur, s.from, s.to)) ?? null
}
