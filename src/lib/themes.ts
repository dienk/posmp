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
    id: 'merahputih',
    name: 'Merah Putih',
    desc: 'Putih bersih beraksen merah (bawaan)',
    vars: t('254 202 202', '254 226 226', '220 38 38', '249 250 251', '254 215 215', '51 65 85', '148 163 184'),
  },
  {
    id: 'klasik',
    name: 'Klasik',
    desc: 'Krem & lavender',
    vars: t('207 198 217', '228 222 236', '180 167 199', '242 224 212', '242 198 161', '113 120 136', '217 171 160'),
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
  {
    // Tema gelap sejati (dark mode). Permukaan --c-panel di-override gelap via
    // [data-theme="oniks"] di index.css agar kartu/header/modal ikut gelap.
    id: 'oniks',
    name: 'Oniks',
    desc: 'Hitam tegas (mode gelap)',
    vars: t('63 63 70', '39 39 42', '82 82 91', '24 24 27', '39 39 42', '244 244 245', '161 161 170'),
  },
  {
    id: 'safir',
    name: 'Safir',
    desc: 'Biru tegas & dalam',
    vars: t('96 165 250', '219 234 254', '29 78 216', '239 246 255', '191 219 254', '30 58 138', '71 85 105'),
  },
  {
    id: 'zamrud',
    name: 'Zamrud',
    desc: 'Hijau tegas & pekat',
    vars: t('74 222 128', '220 252 231', '21 128 61', '240 253 244', '187 247 208', '20 83 45', '71 85 105'),
  },
]

export const DEFAULT_THEME_ID = 'merahputih'
export const CUSTOM_THEME_ID = 'custom'

/** Peran warna palet + label untuk editor tema kustom. */
export const PALETTE_ROLES: { key: keyof Theme['vars']; label: string; hint: string }[] = [
  { key: '--c-brand', label: 'Aksen / Brand', hint: 'Pil kategori, badge member' },
  { key: '--c-brand-soft', label: 'Aksen Lembut', hint: 'Latar sorotan' },
  { key: '--c-brand-strong', label: 'Aksen Kuat', hint: 'Tombol brand' },
  { key: '--c-background', label: 'Latar', hint: 'Latar halaman' },
  { key: '--c-surface', label: 'Permukaan', hint: 'Kartu produk' },
  { key: '--c-ink', label: 'Teks Utama', hint: 'Judul & angka' },
  { key: '--c-ink-soft', label: 'Teks Sekunder', hint: 'Keterangan' },
]

/** Palet sebuah preset (atau bawaan bila id tak dikenal). */
export function themeVars(id: string | undefined): Theme['vars'] {
  const theme =
    THEMES.find((x) => x.id === id) ??
    THEMES.find((x) => x.id === DEFAULT_THEME_ID) ??
    THEMES[0]
  return theme.vars
}

/**
 * Terapkan tema ke :root. Untuk id 'custom', pakai `customVars` (channel "R G B");
 * peran yang tak diisi jatuh ke bawaan. Tema preset tak dikenal → bawaan.
 */
export function applyTheme(id: string | undefined, customVars?: Partial<Theme['vars']>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const vars: Theme['vars'] =
    id === CUSTOM_THEME_ID
      ? { ...themeVars(DEFAULT_THEME_ID), ...(customVars ?? {}) }
      : themeVars(id)
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  // Tandai tema aktif agar CSS bisa menimpa token non-registri (mis. --c-panel
  // untuk mode gelap Oniks) per tema.
  root.setAttribute('data-theme', id ?? DEFAULT_THEME_ID)
}

/** Warna CSS siap-pakai dari channel (untuk swatch di pemilih tema). */
export function rgb(channels: string): string {
  return `rgb(${channels})`
}

/** Channel "R G B" → hex (#rrggbb) untuk input warna. */
export function channelsToHex(channels: string): string {
  const [r, g, b] = channels.trim().split(/\s+/).map((n) => Number(n) || 0)
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Hex (#rrggbb) → channel "R G B". */
export function hexToChannels(hex: string): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `${Number.isFinite(r) ? r : 0} ${Number.isFinite(g) ? g : 0} ${Number.isFinite(b) ? b : 0}`
}

/** Baca palet kustom tersimpan (JSON) dari app_settings; null bila tak valid. */
export function parseCustomVars(raw: string | undefined): Theme['vars'] | undefined {
  if (!raw) return undefined
  try {
    const obj = JSON.parse(raw) as Partial<Theme['vars']>
    return { ...themeVars(DEFAULT_THEME_ID), ...obj }
  } catch {
    return undefined
  }
}
