import { execute, getDb, persist, query } from '../../db/database'

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'VALUE_DEPOSIT'

export interface VoucherCampaign {
  id: number
  campaign_name: string
  prefix: string | null
  discount_type: DiscountType
  discount_value: number
  min_purchase: number
  max_discount: number | null
  expiry_date: string | null
  created_at: string
  voucher_count?: number
  used_total?: number
}

export interface Voucher {
  id: number
  code: string
  discount_type: DiscountType
  discount_value: number
  max_discount: number | null
  min_purchase: number
  expiry_date: string | null
  usage_limit: number
  used_count: number
  is_active: number
}

export interface GenerateInput {
  campaignName: string
  prefix: string
  discountType: DiscountType
  discountValue: number
  minPurchase: number
  maxDiscount: number | null
  usageLimit: number
  quantity: number
  expiryDate: string | null
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa 0/O/1/I agar tak ambigu

function randomSuffix(len: number): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/**
 * Buat kampanye + sejumlah kode voucher unik secara massal.
 * Semua INSERT dalam satu transaksi SQL, lalu persist sekali.
 */
export async function generateVouchers(input: GenerateInput): Promise<number> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO voucher_campaigns
         (campaign_name, prefix, discount_type, discount_value, min_purchase, max_discount, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.campaignName,
        input.prefix,
        input.discountType,
        input.discountValue,
        input.minPurchase,
        input.maxDiscount,
        input.expiryDate,
      ],
    )
    const campaignId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    const seen = new Set<string>()
    let created = 0
    let guard = 0
    while (created < input.quantity && guard < input.quantity * 20) {
      guard++
      const code = `${input.prefix}-${randomSuffix(6)}`
      if (seen.has(code)) continue
      seen.add(code)
      try {
        db.run(
          `INSERT INTO vouchers
             (campaign_id, code, discount_type, discount_value, max_discount, min_purchase,
              expiry_date, usage_limit, used_count, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
          [
            campaignId,
            code,
            input.discountType,
            input.discountValue,
            input.maxDiscount,
            input.minPurchase,
            input.expiryDate,
            input.usageLimit,
          ],
        )
        created++
      } catch {
        // Tabrakan UNIQUE(code) dengan data lama — coba kode lain.
      }
    }
    db.run('COMMIT')
    await persist()
    return campaignId
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

export function listCampaigns(): VoucherCampaign[] {
  return query<VoucherCampaign>(
    `SELECT c.*,
            COUNT(v.id) AS voucher_count,
            COALESCE(SUM(v.used_count), 0) AS used_total
     FROM voucher_campaigns c
     LEFT JOIN vouchers v ON v.campaign_id = c.id
     GROUP BY c.id
     ORDER BY c.id DESC`,
  )
}

export function listVouchersByCampaign(campaignId: number, limit = 50): Voucher[] {
  return query<Voucher>('SELECT * FROM vouchers WHERE campaign_id = ? ORDER BY id LIMIT ?', [
    campaignId,
    limit,
  ])
}

export interface VoucherValidation {
  ok: boolean
  message: string
  voucher?: Voucher
  discount?: number
}

/**
 * Validasi kode voucher terhadap subtotal keranjang.
 * Menegakkan aturan keamanan: aktif, belum kedaluwarsa, belum melewati batas
 * pemakaian, dan memenuhi minimum pembelian.
 */
export function validateVoucher(code: string, subtotal: number): VoucherValidation {
  const rows = query<Voucher>('SELECT * FROM vouchers WHERE code = ?', [code.trim().toUpperCase()])
  const voucher = rows[0]
  if (!voucher) return { ok: false, message: 'Kode voucher tidak ditemukan.' }
  if (!voucher.is_active) return { ok: false, message: 'Voucher tidak aktif.' }
  if (voucher.used_count >= voucher.usage_limit)
    return { ok: false, message: 'Voucher telah mencapai batas pemakaian.' }
  if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date())
    return { ok: false, message: 'Voucher sudah kedaluwarsa.' }
  if (subtotal < voucher.min_purchase)
    return {
      ok: false,
      message: `Minimum belanja belum terpenuhi (min. Rp${voucher.min_purchase.toLocaleString('id-ID')}).`,
    }

  let discount = 0
  if (voucher.discount_type === 'PERCENTAGE') {
    discount = Math.round((subtotal * voucher.discount_value) / 100)
    if (voucher.max_discount) discount = Math.min(discount, voucher.max_discount)
  } else {
    // FIXED atau VALUE_DEPOSIT (gift card) memotong nominal.
    discount = Math.min(voucher.discount_value, subtotal)
  }
  return { ok: true, message: 'Voucher diterapkan.', voucher, discount }
}

export interface TenderVoucherResult {
  ok: boolean
  message: string
  voucherId?: number
  value?: number
}

/**
 * Validasi voucher sebagai alat pembayaran (gift card / VALUE_DEPOSIT).
 * Berbeda dari diskon: nilai voucher dipakai langsung membayar tagihan.
 */
export function validateTenderVoucher(code: string): TenderVoucherResult {
  const voucher = query<Voucher>('SELECT * FROM vouchers WHERE code = ?', [
    code.trim().toUpperCase(),
  ])[0]
  if (!voucher) return { ok: false, message: 'Kode voucher tidak ditemukan.' }
  if (voucher.discount_type !== 'VALUE_DEPOSIT')
    return { ok: false, message: 'Voucher ini bukan gift card / saldo.' }
  if (!voucher.is_active) return { ok: false, message: 'Voucher tidak aktif.' }
  if (voucher.used_count >= voucher.usage_limit)
    return { ok: false, message: 'Voucher sudah terpakai.' }
  if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date())
    return { ok: false, message: 'Voucher sudah kedaluwarsa.' }
  return { ok: true, message: 'Voucher valid.', voucherId: voucher.id, value: voucher.discount_value }
}

export async function deactivateVoucherCampaign(campaignId: number): Promise<void> {
  await execute('UPDATE vouchers SET is_active = 0 WHERE campaign_id = ?', [campaignId])
}
