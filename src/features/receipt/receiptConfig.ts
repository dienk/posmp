export type ReceiptAlign = 'left' | 'center' | 'right'
export type LogoPosition = 'top' | 'bottom'

/** Konfigurasi tampilan struk, disimpan di app_settings dengan awalan `receipt_`. */
export interface ReceiptConfig {
  logo: string // data URL gambar (kosong = tanpa logo)
  logoPosition: LogoPosition
  align: ReceiptAlign // perataan blok header & footer
  tagline: string // baris di bawah nama outlet (boleh multiline)
  footer: string // ucapan penutup (boleh multiline)
  note: string // catatan tambahan kecil (boleh multiline)
  website: string // alamat situs (kosong = sembunyi)
  shopee: string // nama/tautan toko Shopee
  tiktok: string // akun/tautan TikTok
  tokopedia: string // nama/tautan toko Tokopedia
  showAddress: boolean
  showPhone: boolean
  showMember: boolean
  showPoints: boolean
  showItemNote: boolean // catatan khusus per item
  showItemUnit: boolean // satuan pada baris item (mis. "2 dus")
  paperWidth: 58 | 80 // mm
}

// Default: logo aplikasi. Bisa diganti (unggah/URL) atau dihapus via Desain Struk.
export const RECEIPT_DEFAULTS: ReceiptConfig = {
  logo: '/logo-mark.png',
  logoPosition: 'top',
  align: 'center',
  tagline: '',
  footer: 'Terima kasih 🙏',
  note: '',
  website: '',
  shopee: '',
  tiktok: '',
  tokopedia: '',
  showAddress: true,
  showPhone: true,
  showMember: true,
  showPoints: true,
  showItemNote: true,
  showItemUnit: true,
  paperWidth: 58,
}

/** Satu template desain struk (banyak template didukung). */
export interface ReceiptTemplate {
  id: string
  name: string
  config: ReceiptConfig
}

/** Lengkapi konfigurasi parsial dengan default (tahan terhadap field baru). */
export function normalizeReceiptConfig(c: Partial<ReceiptConfig> | undefined | null): ReceiptConfig {
  const p = c ?? {}
  return {
    ...RECEIPT_DEFAULTS,
    ...p,
    logoPosition: p.logoPosition === 'bottom' ? 'bottom' : 'top',
    align: p.align === 'left' || p.align === 'right' ? p.align : 'center',
    paperWidth: p.paperWidth === 80 ? 80 : 58,
  }
}

/** Parse daftar template dari JSON app_settings.receipt_templates. */
export function parseTemplates(raw: string | undefined): ReceiptTemplate[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((t) => t && typeof t.id === 'string')
      .map((t) => ({
        id: t.id,
        name: typeof t.name === 'string' && t.name.trim() ? t.name : 'Template',
        config: normalizeReceiptConfig(t.config),
      }))
  } catch {
    return []
  }
}

/**
 * Daftar template desain struk. Bila belum ada template tersimpan, migrasikan
 * konfigurasi lama (kunci `receipt_*`) menjadi satu template "Struk Default".
 */
export function getTemplates(settings: Record<string, string>): ReceiptTemplate[] {
  const parsed = parseTemplates(settings.receipt_templates)
  if (parsed.length) return parsed
  return [{ id: 'default', name: 'Struk Default', config: legacyReceiptConfig(settings) }]
}

/** ID template aktif (yang dipakai saat mencetak struk sesungguhnya). */
export function getActiveTemplateId(settings: Record<string, string>): string {
  const templates = getTemplates(settings)
  const id = settings.receipt_active_template
  return templates.some((t) => t.id === id) ? id : templates[0].id
}

/** ID unik untuk template baru. */
export function newTemplateId(): string {
  return 'tpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** Serialisasi daftar template + template aktif ke app_settings. */
export function templatesToSettings(
  templates: ReceiptTemplate[],
  activeId: string,
): Record<string, string> {
  return {
    receipt_templates: JSON.stringify(templates),
    receipt_active_template: activeId,
  }
}

/**
 * Konfigurasi struk aktif untuk dipakai render/cetak. Bila ada template
 * tersimpan, gunakan template aktif; selain itu baca kunci lama `receipt_*`.
 */
export function getReceiptConfig(settings: Record<string, string>): ReceiptConfig {
  const templates = parseTemplates(settings.receipt_templates)
  if (templates.length) {
    const active = templates.find((t) => t.id === settings.receipt_active_template) ?? templates[0]
    return active.config
  }
  return legacyReceiptConfig(settings)
}

/** Pembaca konfigurasi lama (satu desain) dari kunci `receipt_*`. */
function legacyReceiptConfig(settings: Record<string, string>): ReceiptConfig {
  const bool = (key: string, def: boolean) =>
    settings[key] === undefined ? def : settings[key] === '1'
  const align = settings.receipt_align
  const logoPos = settings.receipt_logo_position
  return {
    logo: settings.receipt_logo ?? RECEIPT_DEFAULTS.logo,
    logoPosition: logoPos === 'bottom' ? 'bottom' : 'top',
    align: align === 'left' || align === 'right' ? align : 'center',
    tagline: settings.receipt_tagline ?? RECEIPT_DEFAULTS.tagline,
    footer: settings.receipt_footer ?? RECEIPT_DEFAULTS.footer,
    note: settings.receipt_note ?? RECEIPT_DEFAULTS.note,
    website: settings.receipt_website ?? RECEIPT_DEFAULTS.website,
    shopee: settings.receipt_shopee ?? RECEIPT_DEFAULTS.shopee,
    tiktok: settings.receipt_tiktok ?? RECEIPT_DEFAULTS.tiktok,
    tokopedia: settings.receipt_tokopedia ?? RECEIPT_DEFAULTS.tokopedia,
    showAddress: bool('receipt_show_address', RECEIPT_DEFAULTS.showAddress),
    showPhone: bool('receipt_show_phone', RECEIPT_DEFAULTS.showPhone),
    showMember: bool('receipt_show_member', RECEIPT_DEFAULTS.showMember),
    showPoints: bool('receipt_show_points', RECEIPT_DEFAULTS.showPoints),
    showItemNote: bool('receipt_show_item_note', RECEIPT_DEFAULTS.showItemNote),
    showItemUnit: bool('receipt_show_item_unit', RECEIPT_DEFAULTS.showItemUnit),
    paperWidth: settings.receipt_paper_width === '80' ? 80 : 58,
  }
}

/** Ubah konfigurasi struk menjadi map app_settings untuk disimpan. */
export function receiptConfigToSettings(c: ReceiptConfig): Record<string, string> {
  return {
    receipt_logo: c.logo,
    receipt_logo_position: c.logoPosition,
    receipt_align: c.align,
    receipt_tagline: c.tagline,
    receipt_footer: c.footer,
    receipt_note: c.note,
    receipt_website: c.website,
    receipt_shopee: c.shopee,
    receipt_tiktok: c.tiktok,
    receipt_tokopedia: c.tokopedia,
    receipt_show_address: c.showAddress ? '1' : '0',
    receipt_show_phone: c.showPhone ? '1' : '0',
    receipt_show_member: c.showMember ? '1' : '0',
    receipt_show_points: c.showPoints ? '1' : '0',
    receipt_show_item_note: c.showItemNote ? '1' : '0',
    receipt_show_item_unit: c.showItemUnit ? '1' : '0',
    receipt_paper_width: String(c.paperWidth),
  }
}

/** Baris situs & marketplace untuk footer struk (hanya yang terisi). */
export function receiptSocials(c: ReceiptConfig): string[] {
  const out: string[] = []
  const v = (s: string | undefined) => (s ?? '').trim()
  if (v(c.website)) out.push(`🌐 ${v(c.website)}`)
  if (v(c.shopee)) out.push(`🛍️ Shopee: ${v(c.shopee)}`)
  if (v(c.tiktok)) out.push(`🎵 TikTok: ${v(c.tiktok)}`)
  if (v(c.tokopedia)) out.push(`🛒 Tokopedia: ${v(c.tokopedia)}`)
  return out
}

export const RECEIPT_WIDTH_PX: Record<58 | 80, number> = { 58: 280, 80: 380 }

/**
 * Muat file gambar, perkecil hingga lebar maksimum, kembalikan data URL PNG.
 * Menjaga ukuran base64 tetap kecil agar hemat saat dipersist ke IndexedDB.
 */
export function fileToScaledDataUrl(file: File, maxWidth = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(scaleDataUrl(reader.result as string, maxWidth))
    reader.readAsDataURL(file)
  })
}

/** Perkecil data URL gambar hingga lebar maksimum, kembalikan PNG data URL. */
export function scaleDataUrl(dataUrl: string, maxWidth = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Gambar tidak valid.'))
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas tidak didukung.'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}

/**
 * Unduh gambar dari URL lalu jadikan data URL (self-contained, local-first).
 * Butuh gambar yang dapat diakses & mengizinkan CORS. Melempar error bila gagal.
 */
export async function urlToScaledDataUrl(url: string, maxWidth = 240): Promise<string> {
  const resp = await fetch(url.trim(), { mode: 'cors' })
  if (!resp.ok) throw new Error(`Gagal mengunduh (HTTP ${resp.status}).`)
  const blob = await resp.blob()
  if (!blob.type.startsWith('image/')) throw new Error('URL bukan gambar.')
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
  return scaleDataUrl(dataUrl, maxWidth)
}
