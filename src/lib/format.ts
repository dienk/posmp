/** Format angka menjadi Rupiah, mis. 25000 -> "Rp 25.000". */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Penghitung monoton agar nomor invoke unik walau dibuat dalam detik yang sama
// (mis. saat Split Bill membuat beberapa nota beruntun).
let invoiceSeq = 0

// Prefix nomor invoice (dapat diatur di Pengaturan). Disetel modul-level agar
// tak perlu diteruskan ke setiap pemanggil generateInvoiceNumber (repositori
// membuat invoice tanpa akses SettingsContext). Disinkronkan dari app_settings
// saat aplikasi dimuat & tiap kali setelan berubah (lihat App.tsx).
let invoicePrefix = 'INV'

/** Bersihkan prefix: huruf/angka, huruf besar, maks 8 karakter; kosong → 'INV'. */
export function sanitizeInvoicePrefix(raw: string | undefined | null): string {
  const clean = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return clean || 'INV'
}

/** Setel prefix nomor invoice aktif (dari setelan). */
export function setInvoicePrefix(raw: string | undefined | null): void {
  invoicePrefix = sanitizeInvoicePrefix(raw)
}

/** Prefix nomor invoice aktif. */
export function getInvoicePrefix(): string {
  return invoicePrefix
}

/** Nomor invoice berbasis timestamp + urutan: <PREFIX>-YYMMDD-HHMMSS-NN. */
export function generateInvoiceNumber(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  invoiceSeq = (invoiceSeq + 1) % 100
  const seq = p(invoiceSeq)
  return `${invoicePrefix}-${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(
    now.getMinutes(),
  )}${p(now.getSeconds())}-${seq}`
}
