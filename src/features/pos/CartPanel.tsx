import { useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import type { CartItem, FacilityType } from '../../types'
import { buildUnitOptions } from '../products/productsRepository'
import { itemUnitPrice, lineTotal } from './useCart'

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
  serviceEnabled: boolean
  serviceRate: number
  saving: boolean
  showVoucher: boolean
  showPreorder: boolean
  voucherCode: string
  discount: number
  showDiscount: boolean
  manualDiscMode: 'rp' | 'pct'
  manualDiscInput: string
  manualDiscount: number
  onManualDiscModeChange: (m: 'rp' | 'pct') => void
  onManualDiscInputChange: (v: string) => void
  onItemDiscountChange: (productId: number, discount: number) => void
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
  onUnitChange: (productId: number, unit: string) => void
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
  const grossSubtotal = props.items.reduce((s, it) => s + itemUnitPrice(it) * it.quantity, 0)
  const subtotal = props.items.reduce((s, it) => s + lineTotal(it), 0) // sudah − diskon item
  const itemDiscApplied = grossSubtotal - subtotal
  const voucherDisc = props.showVoucher ? Math.min(props.discount, subtotal) : 0
  const manualDisc = props.showDiscount ? props.manualDiscount : 0
  const discount = Math.min(voucherDisc + manualDisc, subtotal) // diskon transaksi (voucher+manual)
  const service = props.serviceEnabled ? Math.round((subtotal - discount) * props.serviceRate) : 0
  const tax = props.taxEnabled ? Math.round((subtotal - discount + service) * props.taxRate) : 0
  const total = subtotal - discount + service + tax
  const empty = props.items.length === 0
  const totalItems = props.items.reduce((s, it) => s + it.quantity, 0)

  // Kontrol tampil/sembunyi lokal.
  const [showTxNote, setShowTxNote] = useState(false)
  const [noteShownIds, setNoteShownIds] = useState<Set<number>>(new Set())
  const [discShownIds, setDiscShownIds] = useState<Set<number>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  // Buffer teks kuantitas per item agar bisa diketik (termasuk sementara kosong) tanpa langsung menghapus item.
  const [qtyEdits, setQtyEdits] = useState<Record<number, string>>({})

  const showItemNote = (id: number) => noteShownIds.has(id)
  const toggleItemNote = (id: number) =>
    setNoteShownIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleItemDisc = (id: number) =>
    setDiscShownIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Dropdown member disaring langsung dari teks di kolom pelanggan (satu kolom untuk umum & member).
  const filteredCustomers = useMemo(() => {
    const q = props.customerName.trim().toLowerCase()
    const list = q
      ? props.customers.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
        )
      : props.customers
    return list.slice(0, 30)
  }, [props.customers, props.customerName])

  const txNoteVisible = showTxNote || props.orderNote.trim().length > 0

  return (
    <aside className="flex h-full w-full flex-col bg-panel shadow-panel">
      {/* Pelanggan (umum & member jadi satu kolom) & tipe pesanan */}
      <div className="border-b border-line/5 p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
              {props.member ? '★' : '👤'}
            </span>
            <input
              value={props.customerName}
              onChange={(e) => {
                props.onCustomerNameChange(e.target.value)
                props.onMemberQueryChange(e.target.value)
                if (props.member) props.onClearMember()
                setPickerOpen(true)
              }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  props.onFindMember()
                  setPickerOpen(false)
                }
              }}
              placeholder="Pelanggan Umum / No. HP member"
              className="w-full rounded-lg border border-line/10 py-2 pl-8 pr-9 text-sm
                         outline-none focus:border-brand-strong"
            />
            {props.customerName || props.member ? (
              <button
                type="button"
                onClick={() => {
                  props.onCustomerNameChange('')
                  props.onMemberQueryChange('')
                  props.onClearMember()
                  setPickerOpen(false)
                }}
                title="Kosongkan (Pelanggan Umum)"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-sm
                           text-ink-soft hover:bg-background"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                title="Pilih dari daftar member"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-base
                           text-ink-soft hover:bg-background"
              >
                📇
              </button>
            )}
            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-line/10 bg-panel shadow-lg">
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {filteredCustomers.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-ink-soft">
                        Tidak ada member cocok · lanjut sebagai Pelanggan Umum.
                      </li>
                    ) : (
                      filteredCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              props.onSelectCustomer(c)
                              setPickerOpen(false)
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
              </>
            )}
          </div>
          <select
            value={props.facilityType}
            onChange={(e) => props.onFacilityChange(e.target.value as FacilityType)}
            className="rounded-lg border border-line/10 bg-panel px-2 py-2 text-sm outline-none
                       focus:border-brand-strong"
          >
            {FACILITIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Badge member aktif (loyalitas) */}
        {props.member && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-soft px-3 py-1.5">
            <span className="text-xs font-semibold text-ink">
              ★ Member · {props.member.points} poin
            </span>
            <button
              onClick={props.onClearMember}
              className="text-xs font-semibold text-status-occupied hover:opacity-70"
            >
              Lepas
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
            className="min-w-0 flex-1 rounded-md border border-line/10 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-ink outline-none focus:border-brand-strong"
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
          <ul className="flex flex-col divide-y divide-line/5">
            {props.items.map((it, index) => {
              const noteVisible = showItemNote(it.product.id) || (it.notes ?? '').length > 0
              const unitOpts = buildUnitOptions(
                it.product.unit,
                it.product.price,
                it.product.unit_conversions,
              )
              const selectedUnit = it.unit ?? unitOpts[0].unit
              return (
                <li key={it.product.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-start gap-2 text-sm font-semibold text-ink">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-ink-soft">
                        {index + 1}
                      </span>
                      <span className="min-w-0">{it.product.name}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => props.onRemove(it.product.id)}
                      className="shrink-0 text-status-occupied hover:opacity-70"
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
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-lg text-ink hover:bg-brand-soft"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Jumlah ${it.product.name}`}
                        value={qtyEdits[it.product.id] ?? String(it.quantity)}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setQtyEdits((m) => ({ ...m, [it.product.id]: raw }))
                          const n = parseInt(raw, 10)
                          if (Number.isFinite(n) && n >= 1) props.onQuantityChange(it.product.id, n)
                        }}
                        onBlur={() => {
                          const raw = qtyEdits[it.product.id]
                          if (raw !== undefined) {
                            const n = parseInt(raw, 10)
                            if (!Number.isFinite(n) || n < 1) props.onQuantityChange(it.product.id, 1)
                          }
                          setQtyEdits((m) => {
                            if (!(it.product.id in m)) return m
                            const next = { ...m }
                            delete next[it.product.id]
                            return next
                          })
                        }}
                        className="h-11 w-12 rounded-md border border-line/10 text-center text-sm font-semibold outline-none focus:border-brand-strong"
                      />
                      <button
                        type="button"
                        onClick={() => props.onQuantityChange(it.product.id, it.quantity + 1)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-lg text-ink hover:bg-brand-soft"
                      >
                        +
                      </button>
                      {unitOpts.length > 1 ? (
                        <select
                          value={selectedUnit}
                          onChange={(e) => props.onUnitChange(it.product.id, e.target.value)}
                          title="Pilih satuan"
                          className="ml-1 rounded-lg border border-line/10 bg-panel px-1.5 py-1 text-xs outline-none focus:border-brand-strong"
                        >
                          {unitOpts.map((o) => (
                            <option key={o.unit} value={o.unit}>
                              {o.unit}
                              {o.isBase ? '' : ` (×${o.factor})`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="ml-1 text-xs text-ink-soft">{selectedUnit}</span>
                      )}
                    </div>
                    <span className="text-right text-sm font-bold text-ink">
                      {formatRupiah(lineTotal(it))}
                      {(it.discount ?? 0) > 0 && (
                        <span className="ml-1 text-[11px] font-normal text-ink-soft line-through">
                          {formatRupiah(itemUnitPrice(it) * it.quantity)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Diskon item (opsional, diaktifkan di Pengaturan) */}
                  {props.showDiscount &&
                    (discShownIds.has(it.product.id) || (it.discount ?? 0) > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-status-occupied">Diskon Rp</span>
                        <input
                          type="number"
                          min={0}
                          value={it.discount ?? ''}
                          onChange={(e) =>
                            props.onItemDiscountChange(it.product.id, Number(e.target.value) || 0)
                          }
                          placeholder="0"
                          className="w-28 rounded-lg border border-line/15 bg-background/50 px-2.5 py-1.5
                                     text-xs outline-none focus:border-brand-strong focus:bg-panel"
                        />
                        {(it.discount ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => props.onItemDiscountChange(it.product.id, 0)}
                            className="text-xs font-semibold text-ink-soft hover:text-status-occupied"
                          >
                            hapus
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleItemDisc(it.product.id)}
                        className="mt-1.5 mr-3 text-xs font-semibold text-ink-soft hover:text-ink"
                      >
                        ＋ Diskon item
                      </button>
                    ))}

                  {noteVisible ? (
                    <input
                      autoFocus={showItemNote(it.product.id) && !(it.notes ?? '').length}
                      value={it.notes ?? ''}
                      onChange={(e) => props.onNotesChange(it.product.id, e.target.value)}
                      placeholder="✎ Catatan khusus (mis. tanpa sambal, level pedas)"
                      className="mt-2 w-full rounded-lg border border-dashed border-line/15 bg-background/50
                                 px-2.5 py-1.5 text-xs outline-none focus:border-brand-strong focus:bg-panel"
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
                  className="w-full rounded-lg border border-line/10 px-2 py-1.5 text-sm outline-none focus:border-brand-strong"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-soft">Uang Muka (DP)</span>
                <input
                  type="number"
                  min={0}
                  value={props.dpAmount}
                  onChange={(e) => props.onDpChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-line/10 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-strong"
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
              className="w-full resize-none rounded-lg border border-line/10 px-3 py-2 text-sm
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
        {/* Diskon transaksi manual (opsional, diaktifkan di Pengaturan) */}
        {props.showDiscount && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-background/60 px-2.5 py-1.5">
            <span className="text-xs font-semibold text-ink-soft">Diskon Transaksi</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="flex overflow-hidden rounded-md border border-line/15 text-xs font-semibold">
                {(['rp', 'pct'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => props.onManualDiscModeChange(m)}
                    className={
                      'px-2 py-1 transition ' +
                      (props.manualDiscMode === m
                        ? 'bg-brand-strong text-white'
                        : 'text-ink-soft hover:bg-background')
                    }
                  >
                    {m === 'rp' ? 'Rp' : '%'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                value={props.manualDiscInput}
                onChange={(e) => props.onManualDiscInputChange(e.target.value)}
                placeholder="0"
                className="w-20 rounded-md border border-line/15 bg-panel px-2 py-1 text-right text-xs
                           outline-none focus:border-brand-strong"
              />
            </div>
          </div>
        )}
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>Total Item</dt>
            <dd>{totalItems}</dd>
          </div>
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd>{formatRupiah(grossSubtotal)}</dd>
          </div>
          {itemDiscApplied > 0 && (
            <div className="flex justify-between text-status-empty">
              <dt>Diskon item</dt>
              <dd>−{formatRupiah(itemDiscApplied)}</dd>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-status-empty">
              <dt>Diskon transaksi</dt>
              <dd>−{formatRupiah(discount)}</dd>
            </div>
          )}
          {props.serviceEnabled && service > 0 && (
            <div className="flex justify-between text-ink-soft">
              <dt>Service ({Math.round(props.serviceRate * 100)}%)</dt>
              <dd>{formatRupiah(service)}</dd>
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
            <dd className="text-2xl font-extrabold text-brand-strong">{formatRupiah(total)}</dd>
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
          {/* Menu opsi (kiri): Voucher, Simpan Draft & Split Bill */}
          {(props.showVoucher || !(props.showPreorder && props.isPreorder)) && (
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={props.saving}
                onClick={() => setActionsOpen((v) => !v)}
                aria-label="Opsi lain"
                title="Opsi lain: Voucher, Simpan Draft, Split Bill"
                className="relative flex h-full items-center rounded-xl border border-line/10 px-3 text-lg
                           font-bold text-ink transition hover:bg-background disabled:opacity-40"
              >
                ⋮
                {discount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-status-empty" />
                )}
              </button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-line/10 bg-panel shadow-lg">
                    {/* Kode voucher (opsional, diatur di Pengaturan) */}
                    {props.showVoucher && (
                      <div className="border-b border-line/5 p-3">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                          Kode Voucher
                        </p>
                        {discount > 0 ? (
                          <div className="flex items-center justify-between rounded-lg bg-status-empty/10 px-3 py-2">
                            <span className="min-w-0 truncate text-xs font-semibold text-status-empty">
                              {props.voucherCode} diterapkan
                            </span>
                            <button
                              onClick={props.onRemoveVoucher}
                              className="shrink-0 text-xs font-semibold text-status-occupied hover:opacity-70"
                            >
                              Hapus
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              value={props.voucherCode}
                              onChange={(e) => props.onVoucherCodeChange(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && !empty && props.onApplyVoucher()}
                              placeholder="Kode voucher"
                              className="min-w-0 flex-1 rounded-lg border border-line/10 px-3 py-2 text-sm uppercase outline-none focus:border-brand-strong"
                            />
                            <button
                              onClick={props.onApplyVoucher}
                              disabled={empty || !props.voucherCode.trim()}
                              className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
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
                    {/* Simpan Draft & Split Bill — sembunyi saat pre-order */}
                    {!(props.showPreorder && props.isPreorder) && (
                      <>
                        <button
                          type="button"
                          disabled={props.saving}
                          onClick={() => {
                            setActionsOpen(false)
                            props.onOpenDraft()
                          }}
                          className="flex w-full items-center gap-2 border-b border-line/5 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
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
                          className="flex w-full items-center gap-2 border-t border-line/5 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-40"
                        >
                          ⑃ Split Bill
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={empty || props.saving}
            onClick={props.onPay}
            className="flex-1 rounded-xl bg-brand-strong py-3.5 text-base font-bold text-white
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
