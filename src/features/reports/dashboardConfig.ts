// Konfigurasi widget dashboard: daftar widget + show/hide (app_settings).

export interface WidgetDef {
  key: string
  label: string
  desc: string
  moduleKey?: string // hanya tampil bila modul aktif
}

export const DASHBOARD_WIDGETS: WidgetDef[] = [
  { key: 'clock', label: 'Jam & Tanggal', desc: 'Jam waktu nyata & tanggal hari ini' },
  { key: 'kpi_sales', label: 'Ringkasan Penjualan', desc: 'Penjualan, transaksi, item, rata-rata/nota' },
  { key: 'profit_loss', label: 'Laba Rugi (Modal vs Jual)', desc: 'HPP/modal, laba kotor, margin & produk paling untung' },
  { key: 'store_status', label: 'Status Toko', desc: 'Buka/tutup & shift berjalan' },
  { key: 'by_source', label: 'Penjualan per Sumber', desc: 'Grafik penjualan per kanal' },
  { key: 'top_products', label: 'Produk Terlaris', desc: 'Peringkat produk terjual' },
  { key: 'payments', label: 'Metode Pembayaran', desc: 'Rincian total per metode' },
  { key: 'members', label: 'Member & Loyalitas', desc: 'Total member, aktif, poin, saldo' },
  { key: 'stock', label: 'Stok & Inventaris', desc: 'Produk, stok menipis, nilai stok' },
  { key: 'cash', label: 'Saldo Kas', desc: 'Status kas & penjualan tunai hari ini' },
  { key: 'vouchers', label: 'Voucher', desc: 'Voucher aktif & terpakai' },
  { key: 'other_tx', label: 'Refund · Pre-Order · Cicilan', desc: 'Ringkasan transaksi lain' },
  { key: 'operations', label: 'Operasional (F&B)', desc: 'Meja, antrean, dapur', moduleKey: 'module_table_layout' },
  { key: 'recent', label: 'Transaksi Terkini', desc: 'Daftar nota terbaru' },
]

const ALL = DASHBOARD_WIDGETS.map((w) => w.key)

/** Set widget yang aktif (default: semua). */
export function getDashboardWidgets(settings: Record<string, string>): Set<string> {
  const raw = settings.dashboard_widgets
  if (!raw) return new Set(ALL)
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    /* default */
  }
  return new Set(ALL)
}

export function dashboardWidgetsToSettings(enabled: string[]): Record<string, string> {
  return { dashboard_widgets: JSON.stringify(enabled) }
}
