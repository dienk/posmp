/**
 * Registri tema warna. Setiap tema menimpa variabel palet (channel "R G B")
 * pada :root. Warna status (hijau/merah/kuning) tetap semantik lintas-tema.
 */
export interface Theme {
  id: string
  name: string
  desc: string
  vars: {
    '--c-brand': string
    '--c-brand-soft': string
    '--c-brand-strong': string
    '--c-background': string
    '--c-surface': string
    '--c-ink': string
    '--c-ink-soft': string
  }
}

function t(
  brand: string,
  soft: string,
  strong: string,
  background: string,
  surface: string,
  ink: string,
  inkSoft: string,
): Theme['vars'] {
  return {
    '--c-brand': brand,
    '--c-brand-soft': soft,
    '--c-brand-strong': strong,
    '--c-background': background,
    '--c-surface': surface,
    '--c-ink': ink,
    '--c-ink-soft': inkSoft,
  }
}

export const THEMES: Theme[] = [
  {
    id: 'klasik',
    name: 'Klasik',
    desc: 'Krem & lavender (bawaan)',
    vars: t('207 198 217', '228 222 236', '180 167 199', '242 224 212', '242 198 161', '113 120 136', '217 171 160'),
  },
  {
    id: 'merahputih',
    name: 'Merah Putih',
    desc: 'Putih bersih beraksen merah',
    vars: t('254 202 202', '254 226 226', '220 38 38', '249 250 251', '254 215 215', '51 65 85', '148 163 184'),
  },
  {
    id: 'laut',
    name: 'Laut',
    desc: 'Biru sejuk',
    vars: t('191 219 254', '219 234 254', '37 99 235', '240 249 255', '186 230 253', '30 41 59', '100 116 139'),
  },
  {
    id: 'hutan',
    name: 'Hutan',
    desc: 'Hijau segar',
    vars: t('187 247 208', '220 252 231', '22 163 74', '240 253 244', '167 243 208', '20 51 40', '107 128 114'),
  },
  {
    id: 'senja',
    name: 'Senja',
    desc: 'Oranye hangat',
    vars: t('254 215 170', '255 237 213', '234 88 12', '255 247 237', '253 186 116', '67 45 33', '168 133 120'),
  },
  {
    id: 'anggur',
    name: 'Anggur',
    desc: 'Ungu elegan',
    vars: t('221 214 254', '237 233 254', '124 58 237', '245 243 255', '196 181 253', '46 16 101', '139 122 168'),
  },
]

export const DEFAULT_THEME_ID = 'klasik'

/** Terapkan tema ke :root. Tema tak dikenal jatuh ke bawaan. */
export function applyTheme(id: string | undefined): void {
  if (typeof document === 'undefined') return
  const theme = THEMES.find((x) => x.id === id) ?? THEMES[0]
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
}

/** Warna CSS siap-pakai dari channel (untuk swatch di pemilih tema). */
export function rgb(channels: string): string {
  return `rgb(${channels})`
}
