import { formatRupiah } from '../../lib/format'
import type { CartItem, FacilityType } from '../../types'

const FACILITIES: { value: FacilityType; label: string }[] = [
  { value: 'DINE_IN', label: 'Dine In' },
  { value: 'TAKEAWAY', label: 'Take Away' },
  { value: 'DELIVERY', label: 'Delivery' },
]

interface Props {
  items: CartItem[]
  invoiceNumber: string
  customerName: string
  facilityType: FacilityType
  taxEnabled: boolean
  taxRate: number
  saving: boolean
  onCustomerNameChange: (name: string) => void
  onFacilityChange: (facility: FacilityType) => void
  onQuantityChange: (productId: number, quantity: number) => void
  onRemove: (productId: number) => void
  onSaveDraft: () => void
  onPay: () => void
}

export default function CartPanel(props: Props) {
  const subtotal = props.items.reduce((s, it) => s + it.product.price * it.quantity, 0)
  const tax = props.taxEnabled ? Math.round(subtotal * props.taxRate) : 0
  const total = subtotal + tax
  const empty = props.items.length === 0

  return (
    <aside className="flex h-full w-full flex-col bg-white shadow-panel">
      {/* Info pelanggan & tipe pesanan */}
      <div className="flex items-center gap-2 border-b border-black/5 p-4">
        <input
          value={props.customerName}
          onChange={(e) => props.onCustomerNameChange(e.target.value)}
          placeholder="Pelanggan Umum"
          className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm
                     outline-none focus:border-brand-strong"
        />
        <select
          value={props.facilityType}
          onChange={(e) => props.onFacilityChange(e.target.value as FacilityType)}
          className="rounded-lg border border-black/10 bg-white px-2 py-2 text-sm outline-none
                     focus:border-brand-strong"
        >
          {FACILITIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
        Pesanan Baru · {props.invoiceNumber}
      </div>

      {/* Daftar item */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {empty ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-ink-soft">
            Pilih produk untuk memulai transaksi
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-black/5">
            {props.items.map((it) => (
              <li key={it.product.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{it.product.name}</p>
                  <button
                    type="button"
                    onClick={() => props.onRemove(it.product.id)}
                    className="text-status-occupied hover:opacity-70"
                    aria-label={`Hapus ${it.product.name}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => props.onQuantityChange(it.product.id, it.quantity - 1)}
                      className="h-7 w-7 rounded-full bg-background text-ink hover:bg-brand-soft"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => props.onQuantityChange(it.product.id, it.quantity + 1)}
                      className="h-7 w-7 rounded-full bg-background text-ink hover:bg-brand-soft"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-bold text-ink">
                    {formatRupiah(it.product.price * it.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ringkasan & aksi */}
      <div className="border-t border-black/5 p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd>{formatRupiah(subtotal)}</dd>
          </div>
          {props.taxEnabled && (
            <div className="flex justify-between text-ink-soft">
              <dt>Pajak ({Math.round(props.taxRate * 100)}%)</dt>
              <dd>{formatRupiah(tax)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="text-base font-semibold text-ink">TOTAL</dt>
            <dd className="text-2xl font-extrabold text-status-occupied">{formatRupiah(total)}</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={empty || props.saving}
            onClick={props.onSaveDraft}
            className="rounded-xl border border-brand-strong bg-brand py-3 text-sm font-semibold
                       text-ink transition hover:bg-brand-strong disabled:opacity-40"
          >
            Simpan Bill (Draft)
          </button>
          <button
            type="button"
            disabled={empty || props.saving}
            onClick={props.onPay}
            className="rounded-xl bg-status-occupied py-3.5 text-base font-bold text-white
                       shadow transition hover:brightness-95 disabled:opacity-40"
          >
            {props.saving ? 'Memproses…' : `Bayar · ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </aside>
  )
}
