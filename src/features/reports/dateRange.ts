// Preset rentang tanggal untuk filter dashboard/laporan. Rentang dihitung di
// sisi klien (waktu lokal) lalu dikirim sebagai string 'YYYY-MM-DD' (inklusif).

export type RangePreset =
  | 'day'
  | 'week'
  | 'month'
  | 'prev_month'
  | 'year'
  | 'prev_year'
  | 'custom'

export interface DateRange {
  from: string // 'YYYY-MM-DD' inklusif
  to: string // 'YYYY-MM-DD' inklusif
}

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'day', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'prev_month', label: 'Bulan Lalu' },
  { key: 'year', label: 'Tahun Ini' },
  { key: 'prev_year', label: 'Tahun Lalu' },
  { key: 'custom', label: 'Kustom (dari–sampai)' },
]

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Hitung rentang tanggal untuk sebuah preset. Untuk 'custom', pakai nilai
 * `custom` (fallback ke hari ini bila kosong). Minggu dimulai Senin.
 */
export function computeRange(preset: RangePreset, custom?: Partial<DateRange>): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  switch (preset) {
    case 'day': {
      const t = fmt(now)
      return { from: t, to: t }
    }
    case 'week': {
      const daysFromMon = (now.getDay() + 6) % 7 // Sen=0 … Min=6
      return {
        from: fmt(new Date(y, m, d - daysFromMon)),
        to: fmt(new Date(y, m, d - daysFromMon + 6)),
      }
    }
    case 'month':
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) }
    case 'prev_month':
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) }
    case 'year':
      return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) }
    case 'prev_year':
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) }
    case 'custom':
      return { from: custom?.from || fmt(now), to: custom?.to || fmt(now) }
  }
}

/** Label rentang manusiawi untuk header (mis. "1 Jul – 31 Jul 2026"). */
export function formatRangeLabel(range: DateRange): string {
  if (range.from === range.to) return range.from
  return `${range.from} – ${range.to}`
}
