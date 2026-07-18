import { useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import type { CartItem, FacilityType } from '../../types'

const FACILITIES: { value: FacilityType; label: string }[] = [
  { value: 'DINE_IN', label: 'Dine In' },
  { value: 'TAKEAWAY', label: 'Take Away' },
  { value: 'DELIVERY', label: 'Delivery' },
]

export interface CustomerOption {
  id: number
  name: string
  phone: string
}

interface Props {
  items: CartItem[]
  invoiceNumber: string
  onInvoiceChange: (v: string) => void
  customerName: string
  customers: CustomerOption[]
  onSelectCustomer: (c: CustomerOption) => void
  facilityType: FacilityType
  taxEnabled: boolean
  taxRate: number
  saving: boolean
  showVoucher: boolean
  showPreorder: boolean
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
  onOpenDraft: () => void
  onPay: () => void
  onSplit: () => void
}

export default function CartPanel(props: Props) {
  const subtotal = props.items.reduce((s, it) => s + it.product.price * it.quantity, 0)
  const discount = props.showVoucher ? Math.min(props.discount, subtotal) : 0
  const tax = props.taxEnabled ? Math.round((subtotal - discount) * props.taxRate) : 0
  const total = subtotal - discount + tax
  const empty = props.items.length === 0
  const totalItems = props.items.reduce((s, it) => s + it.quantity, 0)

  // Kontrol tampil/sembunyi lokal.
  const [showTxNote, setShowTxNote] = useState(false)
  const [noteShownIds, setNoteShownIds] = useState<Set<number>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [actionsOpen, setActionsOpen] = useState(false)

  const showItemNote = (id: number) => noteShownIds.has(id)
  const toggleItemNote = (id: number) =>
    setNoteShownIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filteredCustomers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    const list = q
      ? props.customers.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
        )
      : props.customers
    return list.slice(0, 30)
  }, [props.customers, pickerQuery])

  const txNoteVisible = showTxNote || props.orderNote.trim().length > 0

  return (
    <aside className="flex h-full w-full flex-col bg-white shadow-panel">
      {/* Info pelanggan & tipe pesanan */}
      <div className="flex items-center gap-2 border-b border-black/5 p-4">
        <div className="relative min-w-0 flex-1">
          <input
            value={props.customerName}
            onChange={(e) => props.onCustomerNameChange(e.target.value)}
            placeholder="Pelanggan Umum"
            className="w-full rounded-lg border border-black/10 px-3 py-2 pr-9 text-sm
                       outline-none focus:border-brand-strong"
          />
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            title="Pilih dari master pelanggan"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-base
                       text-ink-soft hover:bg-background"
          >
            📇
          </button>
          {pickerOpen && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-black/10 bg-white shadow-lg">
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Cari nama / No. HP…"
                className="w-full rounded-t-xl border-b border-black/5 px-3 py-2 text-sm outline-none"
              />
              <ul className="max-h-56 overflow-y-auto py-1">
                {filteredCustomers.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-ink-soft">Tidak ada pelanggan.</li>
                ) : (
                  filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          props.onSelectCustomer(c)
                          setPickerOpen(false)
                          setPickerQuery('')
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-soft"
                      >
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className="text-xs text-ink-soft">{c.phone}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
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

      {/* Nomor invoice (bisa diedit) + total item */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          <span className="shrink-0">Invoice</span>
          <input
            value={props.invoiceNumber}
            onChange={(e) => props.onInvoiceChange(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-ink outline-none focus:border-brand-strong"
          />
        </label>
        <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {totalItems} item
        </span>
      </div>

      {/* Daftar item */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {empty ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-ink-soft">
            Pilih produk untuk memulai transaksi
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-black/5">
            {props.items.map((it) => {
              const noteVisible = showItemNote(it.product.id) || (it.notes ?? '').length > 0
              return (
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
                  {noteVisible ? (
                    <input
                      autoFocus={showItemNote(it.product.id) && !(it.notes ?? '').length}
                      value={it.notes ?? ''}
                      onChange={(e) => props.onNotesChange(it.product.id, e.target.value)}
                      placeholder="✎ Catatan khusus (mis. tanpa sambal, level pedas)"
                      className="mt-2 w-full rounded-lg border border-dashed border-black/15 bg-background/50
                                 px-2.5 py-1.5 text-xs outline-none focus:border-brand-strong focus:bg-white"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleItemNote(it.product.id)}
                      className="mt-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
                    >
                      ＋ Catatan item
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Voucher (opsional, diatur di Pengaturan) */}
      {props.showVoucher && (
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
      )}

      {/* Pre-Order (opsional, diatur di Pengaturan) */}
      {props.showPreorder && (
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
      )}

      {/* Catatan khusus transaksi (default tersembunyi) */}
      <div className="px-4 pt-3">
        {txNoteVisible ? (
          <>
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
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowTxNote(true)}
            className="text-xs font-semibold text-ink-soft hover:text-ink"
          >
            ＋ Catatan transaksi
          </button>
        )}
      </div>

      {/* Ringkasan & aksi */}
      <div className="p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>Total Item</dt>
            <dd>{totalItems}</dd>
          </div>
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
          {props.showPreorder && props.isPreorder && (
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

        <div className="mt-4 flex items-stretch gap-2">
          {/* Menu opsi (kiri): Simpan Draft & Split Bill — sembunyi saat pre-order */}
          {!(props.showPreorder && props.isPreorder) && (
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={props.saving}
                onClick={() => setActionsOpen((v) => !v)}
                aria-label="Opsi lain"
                title="Opsi lain: Simpan Draft, Split Bill"
                className="flex h-full items-center rounded-xl border border-black/10 px-3 text-lg
                           font-bold text-ink transition hover:bg-background disabled:opacity-40"
              >
                ⋮
              </button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                    <button
                      type="button"
                      disabled={props.saving}
                      onClick={() => {
                        setActionsOpen(false)
                        props.onOpenDraft()
                      }}
                      className="flex w-full items-center gap-2 border-b border-black/5 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
                    >
                      📂 Buka Draft
                    </button>
                    <button
                      type="button"
                      disabled={empty || props.saving}
                      onClick={() => {
                        setActionsOpen(false)
                        props.onSaveDraft()
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
                    >
                      💾 Simpan Bill (Draft)
                    </button>
                    <button
                      type="button"
                      disabled={props.saving || props.items.length <= 1}
                      onClick={() => {
                        setActionsOpen(false)
                        props.onSplit()
                      }}
                      title={props.items.length <= 1 ? 'Butuh minimal 2 item' : undefined}
                      className="flex w-full items-center gap-2 border-t border-black/5 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
                    >
                      ⑃ Split Bill
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={empty || props.saving}
            onClick={props.onPay}
            className="flex-1 rounded-xl bg-status-occupied py-3.5 text-base font-bold text-white
                       shadow transition hover:brightness-95 disabled:opacity-40"
          >
            {props.saving
              ? 'Memproses…'
              : props.showPreorder && props.isPreorder
                ? `Simpan Pre-Order · DP ${formatRupiah(Math.min(props.dpAmount, total))}`
                : `Bayar · ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </aside>
  )
}
