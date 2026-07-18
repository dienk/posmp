/** Konfigurasi tampilan struk, disimpan di app_settings dengan awalan `receipt_`. */
export interface ReceiptConfig {
  tagline: string // baris kecil di bawah nama outlet
  footer: string // ucapan penutup
  note: string // catatan tambahan (mis. sosial media / promo)
  showAddress: boolean
  showPhone: boolean
  showMember: boolean
  showPoints: boolean
  paperWidth: 58 | 80 // mm
}

export const RECEIPT_DEFAULTS: ReceiptConfig = {
  tagline: '',
  footer: 'Terima kasih 🙏',
  note: '',
  showAddress: true,
  showPhone: true,
  showMember: true,
  showPoints: true,
  paperWidth: 58,
}

/** Baca konfigurasi struk dari map app_settings (dengan fallback default). */
export function getReceiptConfig(settings: Record<string, string>): ReceiptConfig {
  const bool = (key: string, def: boolean) =>
    settings[key] === undefined ? def : settings[key] === '1'
  return {
    tagline: settings.receipt_tagline ?? RECEIPT_DEFAULTS.tagline,
    footer: settings.receipt_footer ?? RECEIPT_DEFAULTS.footer,
    note: settings.receipt_note ?? RECEIPT_DEFAULTS.note,
    showAddress: bool('receipt_show_address', RECEIPT_DEFAULTS.showAddress),
    showPhone: bool('receipt_show_phone', RECEIPT_DEFAULTS.showPhone),
    showMember: bool('receipt_show_member', RECEIPT_DEFAULTS.showMember),
    showPoints: bool('receipt_show_points', RECEIPT_DEFAULTS.showPoints),
    paperWidth: settings.receipt_paper_width === '80' ? 80 : 58,
  }
}

/** Ubah konfigurasi struk menjadi map app_settings untuk disimpan. */
export function receiptConfigToSettings(c: ReceiptConfig): Record<string, string> {
  return {
    receipt_tagline: c.tagline,
    receipt_footer: c.footer,
    receipt_note: c.note,
    receipt_show_address: c.showAddress ? '1' : '0',
    receipt_show_phone: c.showPhone ? '1' : '0',
    receipt_show_member: c.showMember ? '1' : '0',
    receipt_show_points: c.showPoints ? '1' : '0',
    receipt_paper_width: String(c.paperWidth),
  }
}

export const RECEIPT_WIDTH_PX: Record<58 | 80, number> = { 58: 280, 80: 380 }
