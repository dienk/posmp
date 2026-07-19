// Konfigurasi metode pembayaran, disimpan di app_settings key `payment_methods`
// sebagai JSON array. Metode bawaan (builtin) punya perilaku khusus di kasir
// (Tunai: uang pas, QRIS: no. referensi, Voucher: gift card). Metode kustom
// (mis. GoPay, Transfer BCA) diperlakukan generik: cukup nominal.

export interface PayMethod {
  key: string // nilai disimpan ke transaction_payments.payment_method
  label: string
  icon: string
  enabled: boolean
  builtin: boolean
}

/** Metode bawaan (label & ikon tetap; hanya bisa diaktif/nonaktifkan). */
export const BUILTIN_METHODS: PayMethod[] = [
  { key: 'CASH', label: 'Tunai', icon: '💵', enabled: true, builtin: true },
  { key: 'QRIS', label: 'QRIS', icon: '📱', enabled: true, builtin: true },
  { key: 'DEBIT_CARD', label: 'Debit', icon: '💳', enabled: true, builtin: true },
  { key: 'CREDIT_CARD', label: 'Kredit', icon: '💳', enabled: true, builtin: true },
  { key: 'VOUCHER', label: 'Voucher', icon: '🎟️', enabled: true, builtin: true },
]

const BUILTIN_KEYS = new Set(BUILTIN_METHODS.map((m) => m.key))

/**
 * Baca daftar metode pembayaran dari app_settings. Metode bawaan selalu ada
 * (label/ikon dari BUILTIN_METHODS, status enabled dari simpanan); metode
 * kustom mengikuti simpanan. Tanpa simpanan → seluruh bawaan aktif.
 */
export function getPaymentMethods(settings: Record<string, string>): PayMethod[] {
  let stored: unknown = null
  try {
    stored = settings.payment_methods ? JSON.parse(settings.payment_methods) : null
  } catch {
    stored = null
  }
  const list = Array.isArray(stored) ? stored : []
  const byKey = new Map<string, { enabled?: boolean; label?: string; icon?: string }>()
  const customs: PayMethod[] = []
  for (const it of list) {
    if (!it || typeof it.key !== 'string') continue
    if (BUILTIN_KEYS.has(it.key)) {
      byKey.set(it.key, { enabled: it.enabled !== false })
    } else if (typeof it.label === 'string' && it.label.trim()) {
      customs.push({
        key: it.label.trim(),
        label: it.label.trim(),
        icon: typeof it.icon === 'string' && it.icon ? it.icon : '💰',
        enabled: it.enabled !== false,
        builtin: false,
      })
    }
  }
  const builtins = BUILTIN_METHODS.map((m) => ({
    ...m,
    enabled: byKey.has(m.key) ? byKey.get(m.key)!.enabled !== false : m.enabled,
  }))
  return [...builtins, ...customs]
}

/** Hanya metode aktif; bila tak ada satupun aktif, fallback ke bawaan aktif. */
export function enabledPaymentMethods(settings: Record<string, string>): PayMethod[] {
  const enabled = getPaymentMethods(settings).filter((m) => m.enabled)
  return enabled.length ? enabled : BUILTIN_METHODS
}

/** Serialisasi daftar metode → string untuk app_settings. */
export function serializePaymentMethods(list: PayMethod[]): string {
  const out = list.map((m) =>
    m.builtin
      ? { key: m.key, enabled: m.enabled, builtin: true }
      : { key: m.label.trim(), label: m.label.trim(), icon: m.icon || '💰', enabled: m.enabled, builtin: false },
  )
  return JSON.stringify(out)
}

/** Apakah key termasuk metode bawaan (untuk UI khusus di modal bayar). */
export function isBuiltinMethod(key: string): boolean {
  return BUILTIN_KEYS.has(key)
}
