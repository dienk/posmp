// Konfigurasi program loyalitas (poin) — dibaca dari app_settings dan dipakai
// baik di kasir (saveOrder) maupun pelunasan pre-order (settlePreorder).

export type MemberTierKey = 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
export const MEMBER_TIERS: MemberTierKey[] = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']

export type PointsBasis = 'total' | 'subtotal'
export type PointsRounding = 'floor' | 'round'

export interface LoyaltyConfig {
  enabled: boolean
  /** Rp per 1 poin (mis. 1000 = 1 poin tiap Rp1.000). 0 = tak ada poin. */
  perAmount: number
  /** Dasar hitung: 'total' (setelah pajak & diskon) atau 'subtotal' (sebelum pajak). */
  basis: PointsBasis
  /** Minimal nilai transaksi (Rp) agar dapat poin. */
  minPurchase: number
  /** Poin maksimum per transaksi (0 = tanpa batas). */
  maxPerTransaction: number
  /** Pembulatan poin. */
  rounding: PointsRounding
  /** Pengali poin per tier member. */
  tierMultiplier: Record<MemberTierKey, number>
}

export const LOYALTY_DEFAULTS: LoyaltyConfig = {
  enabled: true,
  perAmount: 1000,
  basis: 'total',
  minPurchase: 0,
  maxPerTransaction: 0,
  rounding: 'floor',
  tierMultiplier: { SILVER: 1, GOLD: 1, PLATINUM: 1, DIAMOND: 1 },
}

const num = (v: string | undefined, def: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

export function getLoyaltyConfig(settings: Record<string, string>): LoyaltyConfig {
  const d = LOYALTY_DEFAULTS
  return {
    enabled: settings.loyalty_enabled === undefined ? d.enabled : settings.loyalty_enabled === '1',
    perAmount: num(settings.points_per_amount, d.perAmount),
    basis: settings.points_basis === 'subtotal' ? 'subtotal' : 'total',
    minPurchase: Math.max(0, num(settings.points_min_purchase, d.minPurchase)),
    maxPerTransaction: Math.max(0, num(settings.points_max_per_tx, d.maxPerTransaction)),
    rounding: settings.points_rounding === 'round' ? 'round' : 'floor',
    tierMultiplier: {
      SILVER: Math.max(0, num(settings.points_mult_silver, 1)),
      GOLD: Math.max(0, num(settings.points_mult_gold, 1)),
      PLATINUM: Math.max(0, num(settings.points_mult_platinum, 1)),
      DIAMOND: Math.max(0, num(settings.points_mult_diamond, 1)),
    },
  }
}

export function loyaltyToSettings(c: LoyaltyConfig): Record<string, string> {
  return {
    loyalty_enabled: c.enabled ? '1' : '0',
    points_per_amount: String(Math.max(0, Math.round(c.perAmount))),
    points_basis: c.basis,
    points_min_purchase: String(Math.max(0, Math.round(c.minPurchase))),
    points_max_per_tx: String(Math.max(0, Math.round(c.maxPerTransaction))),
    points_rounding: c.rounding,
    points_mult_silver: String(c.tierMultiplier.SILVER),
    points_mult_gold: String(c.tierMultiplier.GOLD),
    points_mult_platinum: String(c.tierMultiplier.PLATINUM),
    points_mult_diamond: String(c.tierMultiplier.DIAMOND),
  }
}

/**
 * Hitung poin yang diperoleh untuk satu transaksi bermember.
 * @param amounts total (akhir) & subtotal (sebelum pajak/diskon)
 * @param tier tier member (untuk pengali)
 */
export function computePoints(
  c: LoyaltyConfig,
  amounts: { total: number; subtotal: number },
  tier: string | null | undefined,
): number {
  if (!c.enabled || c.perAmount <= 0) return 0
  const base = c.basis === 'subtotal' ? amounts.subtotal : amounts.total
  if (base < c.minPurchase) return 0
  const mult = c.tierMultiplier[(tier as MemberTierKey) ?? 'SILVER'] ?? 1
  const raw = (base / c.perAmount) * mult
  let pts = c.rounding === 'round' ? Math.round(raw) : Math.floor(raw)
  if (c.maxPerTransaction > 0) pts = Math.min(pts, c.maxPerTransaction)
  return Math.max(0, pts)
}
