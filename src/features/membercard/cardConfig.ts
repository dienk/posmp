/** Konfigurasi template ID Card member, disimpan di app_settings (awalan card_). */
export interface CardConfig {
  title: string
  subtitle: string
  bgStart: string // hex
  bgEnd: string // hex
  textLight: boolean // teks terang (untuk latar gelap)
  showLogo: boolean
  showBarcode: boolean
  showTier: boolean
  showExpiry: boolean
  showPoints: boolean
}

export const CARD_DEFAULTS: CardConfig = {
  title: 'KARTU MEMBER',
  subtitle: 'POS Merah Putih',
  bgStart: '#DC2626',
  bgEnd: '#7F1D1D',
  textLight: true,
  showLogo: true,
  showBarcode: true,
  showTier: true,
  showExpiry: true,
  showPoints: true,
}

export const GRADIENTS: { name: string; start: string; end: string; light: boolean }[] = [
  { name: 'Merah Putih', start: '#DC2626', end: '#7F1D1D', light: true },
  { name: 'Emas', start: '#B45309', end: '#78350F', light: true },
  { name: 'Malam', start: '#1F2937', end: '#0B1220', light: true },
  { name: 'Laut', start: '#2563EB', end: '#1E3A8A', light: true },
  { name: 'Hutan', start: '#16A34A', end: '#14532D', light: true },
  { name: 'Anggur', start: '#7C3AED', end: '#4C1D95', light: true },
  { name: 'Perak', start: '#E5E7EB', end: '#CBD5E1', light: false },
]

export function getCardConfig(s: Record<string, string>): CardConfig {
  const bool = (k: string, d: boolean) => (s[k] === undefined ? d : s[k] === '1')
  return {
    title: s.card_title ?? CARD_DEFAULTS.title,
    subtitle: s.card_subtitle ?? CARD_DEFAULTS.subtitle,
    bgStart: s.card_bg_start ?? CARD_DEFAULTS.bgStart,
    bgEnd: s.card_bg_end ?? CARD_DEFAULTS.bgEnd,
    textLight: bool('card_text_light', CARD_DEFAULTS.textLight),
    showLogo: bool('card_show_logo', CARD_DEFAULTS.showLogo),
    showBarcode: bool('card_show_barcode', CARD_DEFAULTS.showBarcode),
    showTier: bool('card_show_tier', CARD_DEFAULTS.showTier),
    showExpiry: bool('card_show_expiry', CARD_DEFAULTS.showExpiry),
    showPoints: bool('card_show_points', CARD_DEFAULTS.showPoints),
  }
}

export function cardConfigToSettings(c: CardConfig): Record<string, string> {
  return {
    card_title: c.title,
    card_subtitle: c.subtitle,
    card_bg_start: c.bgStart,
    card_bg_end: c.bgEnd,
    card_text_light: c.textLight ? '1' : '0',
    card_show_logo: c.showLogo ? '1' : '0',
    card_show_barcode: c.showBarcode ? '1' : '0',
    card_show_tier: c.showTier ? '1' : '0',
    card_show_expiry: c.showExpiry ? '1' : '0',
    card_show_points: c.showPoints ? '1' : '0',
  }
}
