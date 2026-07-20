import { query } from '../../db/database'
import type { FacilityType } from '../../types'

export interface Promo {
  code: string
  discount_type: string
  discount_value: number
  min_purchase: number
  expiry_date: string | null
}

/** Voucher aktif untuk ditampilkan sebagai promosi di kiosk. */
export function listPromos(limit = 8): Promo[] {
  return query<Promo>(
    `SELECT code, discount_type, discount_value, min_purchase, expiry_date
     FROM vouchers WHERE is_active = 1
       AND (expiry_date IS NULL OR date(expiry_date) >= date('now','localtime'))
     ORDER BY id DESC LIMIT ?`,
    [limit],
  )
}

const PREFIX: Record<FacilityType, string> = { DINE_IN: 'A', TAKEAWAY: 'B', DELIVERY: 'C' }

/** Nomor antrean berikutnya untuk hari ini (tanpa menyimpan) — dipakai kiosk order. */
export function nextQueueNumber(outletId: number, facility: FacilityType): string {
  const prefix = PREFIX[facility]
  const n = query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions
     WHERE outlet_id = ? AND queue_number LIKE ?
       AND date(transaction_date) = date('now','localtime')`,
    [outletId, `${prefix}-%`],
  )[0].n
  return `${prefix}-${String(n + 1).padStart(2, '0')}`
}

/** Nomor antrean yang sedang dilayani (untuk tampilan kiosk antrean). */
export function nowServing(outletId: number): string[] {
  return query<{ queue_number: string }>(
    `SELECT queue_number FROM transactions
     WHERE outlet_id = ? AND queue_number IS NOT NULL AND status = 'READY'
       AND date(transaction_date) = date('now','localtime')
     ORDER BY id DESC LIMIT 5`,
    [outletId],
  ).map((r) => r.queue_number)
}
