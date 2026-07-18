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
  voucherCode: string
  discount: number
  voucherMessage: { ok: boolean; text: string } | null
  member: { name: string; points: number } | null
  memberQuery: string
  onMemberQueryChange: (q: string) => void
  onFindMember: () => void
  onClearMember: () => void
  isPreorder: boolean
  preorderDeadline: string
  dpAmount: number
  onTogglePreorder: (on: boolean) => void
  onDeadlineChange: (v: string) => void
  onDpChange: (v: number) => void
  onVoucherCodeChange: (code: string) => void
  onApplyVoucher: () => void
  onRemoveVoucher: () => void
  onCustomerNameChange: (name: string) => void
  onFacilityChange: (facility: FacilityType) => void
  onQuantityChange: (productId: number, quantity: number) => void
  onNotesChange: (productId: number, notes: string) => void
  orderNote: string
  onOrderNoteChange: (note: string) => void
  onRemove: (productId: number) => void
  onSaveDraft: () => void
  onPay: () => void
  onSplit: () => void
}

export default function CartPanel(props: Props) {
  const subtotal = props.items.reduce((s, it) => s + it.product.price * it.quantity, 0)
  const discount = Math.min(props.discount, subtotal)
  const tax = props.taxEnabled ? Math.round((subtotal - discount) * props.taxRate) : 0
  const total = subtotal - discount + tax
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

      {/* Member loyalitas */}
      <div className="px-4 pt-3">
        {props.member ? (
          <div className="flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2">
            <span className="text-xs font-semibold text-ink">
              ★ {props.member.name} · {props.member.points} poin
            </span>
            <button
              onClick={props.onClearMember}
              className="text-xs font-semibold text-status-occupied hover:opacity-70"
            >
              Lepas
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={props.memberQuery}
              onChange={(e) => props.onMemberQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && props.onFindMember()}
              placeholder="No. HP / nama member"
              className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
            />
            <button
              onClick={props.onFindMember}
              disabled={!props.memberQuery.trim()}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
            >
              Cari
            </button>
          </div>
        )}
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
                <input
                  value={it.notes ?? ''}
                  onChange={(e) => props.onNotesChange(it.product.id, e.target.value)}
                  placeholder="✎ Catatan khusus (mis. tanpa sambal, level pedas)"
                  className="mt-2 w-full rounded-lg border border-dashed border-black/15 bg-background/50
                             px-2.5 py-1.5 text-xs outline-none focus:border-brand-strong focus:bg-white"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Voucher */}
      <div className="border-t border-black/5 px-4 pt-3">
        {discount > 0 ? (
          <div className="flex items-center justify-between rounded-lg bg-status-empty/10 px-3 py-2">
            <span className="text-xs font-semibold text-status-empty">
              Voucher {props.voucherCode} diterapkan
            </span>
            <button
              onClick={props.onRemoveVoucher}
              className="text-xs font-semibold text-status-occupied hover:opacity-70"
            >
              Hapus
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={props.voucherCode}
              onChange={(e) => props.onVoucherCodeChange(e.target.value)}
              placeholder="Kode voucher"
              className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm uppercase outline-none focus:border-brand-strong"
            />
            <button
              onClick={props.onApplyVoucher}
              disabled={empty || !props.voucherCode.trim()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
            >
              Pakai
            </button>
          </div>
        )}
        {props.voucherMessage && (
          <p
            className={
              'mt-1.5 text-xs ' +
              (props.voucherMessage.ok ? 'text-status-empty' : 'text-status-occupied')
            }
          >
            {props.voucherMessage.text}
          </p>
        )}
      </div>

      {/* Pre-Order */}
      <div className="px-4 pt-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={props.isPreorder}
            onChange={(e) => props.onTogglePreorder(e.target.checked)}
            className="h-4 w-4 accent-status-occupied"
          />
          Pre-Order (pesan di muka)
        </label>
        {props.isPreorder && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-soft">Tenggat ambil</span>
              <input
                type="date"
                value={props.preorderDeadline}
                onChange={(e) => props.onDeadlineChange(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-soft">Uang Muka (DP)</span>
              <input
                type="number"
                min={0}
                value={props.dpAmount}
                onChange={(e) => props.onDpChange(Number(e.target.value))}
                className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-strong"
              />
            </label>
          </div>
        )}
      </div>

      {/* Catatan khusus transaksi */}
      <div className="px-4 pt-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">
          Catatan Transaksi
        </label>
        <textarea
          rows={2}
          value={props.orderNote}
          onChange={(e) => props.onOrderNoteChange(e.target.value)}
          placeholder="Catatan khusus untuk seluruh pesanan (mis. bungkus terpisah, minta struk)"
          className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm
                     outline-none focus:border-brand-strong"
        />
      </div>

      {/* Ringkasan & aksi */}
      <div className="p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd>{formatRupiah(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-status-empty">
              <dt>Diskon</dt>
              <dd>−{formatRupiah(discount)}</dd>
            </div>
          )}
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
          {props.isPreorder && (
            <>
              <div className="flex justify-between text-status-empty">
                <dt>Uang Muka</dt>
                <dd>{formatRupiah(Math.min(props.dpAmount, total))}</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Sisa saat ambil</dt>
                <dd>{formatRupiah(Math.max(0, total - props.dpAmount))}</dd>
              </div>
            </>
          )}
        </dl>

        <div className="mt-4 grid gap-2">
          {!props.isPreorder && (
            <button
              type="button"
              disabled={empty || props.saving}
              onClick={props.onSaveDraft}
              className="rounded-xl border border-brand-strong bg-brand py-3 text-sm font-semibold
                         text-ink transition hover:bg-brand-strong disabled:opacity-40"
            >
              Simpan Bill (Draft)
            </button>
          )}
          <button
            type="button"
            disabled={empty || props.saving}
            onClick={props.onPay}
            className="rounded-xl bg-status-occupied py-3.5 text-base font-bold text-white
                       shadow transition hover:brightness-95 disabled:opacity-40"
          >
            {props.saving
              ? 'Memproses…'
              : props.isPreorder
                ? `Simpan Pre-Order · DP ${formatRupiah(Math.min(props.dpAmount, total))}`
                : `Bayar · ${formatRupiah(total)}`}
          </button>
          {!props.isPreorder && props.items.length > 1 && (
            <button
              type="button"
              disabled={props.saving}
              onClick={props.onSplit}
              className="rounded-xl border border-black/10 py-2 text-sm font-semibold text-ink
                         transition hover:bg-background disabled:opacity-40"
            >
              ⑃ Split Bill
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
