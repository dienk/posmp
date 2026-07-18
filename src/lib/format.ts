/** Format angka menjadi Rupiah, mis. 25000 -> "Rp 25.000". */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Nomor invoice sederhana berbasis timestamp: INV-YYMMDD-HHMMSS. */
export function generateInvoiceNumber(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `INV-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(
    now.getMinutes(),
  )}${p(now.getSeconds())}`
}
