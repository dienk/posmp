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

// Palet mengikuti standar ui-ux-pro-max (colors.csv): brand-strong = Primary
// (kontras teks putih ≥4.5:1), background/ink dari Background/Foreground
// bernuansa hue, ink-soft = Muted Foreground slate-600 #475569 (71 85 105) —
// lulus WCAG AA ≥4.5:1 di atas latar bernuansa terang. brand/brand-soft = tint
// terang (200/100) untuk pil & sorotan.
// Kontras seluruh pasangan teks/latar diverifikasi lulus WCAG 2.1 AA (≥4.5:1).
export const THEMES: Theme[] = [
  {
    id: 'merahputih',
    name: 'Merah Putih',
    desc: 'Putih bersih beraksen merah (bawaan)',
    vars: t('254 202 202', '254 226 226', '220 38 38', '254 242 242', '254 226 226', '69 10 10', '71 85 105'),
  },
  {
    id: 'klasik',
    name: 'Silver Modern',
    desc: 'Abu-abu perak bersih modern',
    vars: t('203 213 225', '241 245 249', '71 85 105', '248 250 252', '241 245 249', '15 23 42', '71 85 105'),
  },
  {
    id: 'laut',
    name: 'Laut',
    desc: 'Biru sejuk',
    vars: t('191 219 254', '219 234 254', '37 99 235', '239 246 255', '219 234 254', '30 41 59', '71 85 105'),
  },
  {
    id: 'hutan',
    name: 'Pink Pastel',
    desc: 'Pink lembut pastel',
    vars: t('251 207 232', '252 231 243', '190 24 93', '253 242 248', '252 231 243', '80 7 36', '71 85 105'),
  },
  {
    id: 'senja',
    name: 'Hijau Pastel',
    desc: 'Hijau lembut pastel',
    vars: t('187 247 208', '220 252 231', '21 128 61', '240 253 244', '220 252 231', '20 83 45', '71 85 105'),
  },
  {
    id: 'anggur',
    name: 'Ungu Pastel',
    desc: 'Ungu lembut pastel',
    vars: t('233 213 255', '243 232 255', '126 34 206', '250 245 255', '243 232 255', '59 7 100', '71 85 105'),
  },
  {
    // Tema gelap sejati (dark mode). Permukaan --c-panel di-override gelap via
    // [data-theme="oniks"] di index.css agar kartu/header/modal ikut gelap.
    id: 'oniks',
    name: 'Oniks',
    desc: 'Gelap slate (mode gelap)',
    vars: t('51 65 85', '30 41 59', '71 85 105', '15 23 42', '27 35 54', '248 250 252', '148 163 184'),
  },
  {
    // Mode gelap biru. Permukaan --c-panel/--c-border di-override via
    // [data-theme="safir"] di index.css.
    id: 'safir',
    name: 'Safir',
    desc: 'Biru gelap (mode gelap)',
    vars: t('30 64 175', '27 46 77', '37 99 235', '12 27 51', '19 39 65', '241 245 249', '148 163 184'),
  },
  {
    // Mode gelap hijau. Permukaan --c-panel/--c-border di-override via
    // [data-theme="zamrud"] di index.css.
    id: 'zamrud',
    name: 'Zamrud',
    desc: 'Hijau gelap (mode gelap)',
    vars: t('6 95 70', '20 53 42', '4 120 87', '11 33 26', '18 50 39', '240 253 244', '148 163 184'),
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
