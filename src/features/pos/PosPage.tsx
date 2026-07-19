import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatRupiah, generateInvoiceNumber } from '../../lib/format'
import { getNumberSetting, isModuleEnabled } from '../../lib/settings'
import { getLoyaltyConfig } from '../../lib/loyalty'
import { useSettings } from '../../lib/SettingsContext'
import { useUI } from '../../lib/UIContext'
import type { Category, FacilityType, Product } from '../../types'
import CartPanel from './CartPanel'
import ProductCard from './ProductCard'
import {
  fetchCategories,
  fetchProducts,
  getDraftForEdit,
  saveOrder,
  type PaymentInput,
} from './posRepository'
import { buildUnitOptions, findByBarcode } from '../products/productsRepository'
import OpenDraftModal from './OpenDraftModal'
import { validateVoucher, validateTenderVoucher } from '../vouchers/voucherRepository'
import { listMembers, type Member } from '../members/membersRepository'
import PaymentModal from './PaymentModal'
import SplitBillModal from './SplitBillModal'
import MergeBillModal from './MergeBillModal'
import type { CartItem } from '../../types'
import { itemUnitPrice, useCart } from './useCart'

export default function PosPage() {
  const { settings } = useSettings()
  const { toggleSidebar } = useUI()
  const location = useLocation()
  const tableNumber = (location.state as { tableNumber?: string } | null)?.tableNumber
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const taxRate = getNumberSetting(settings, 'tax_rate', 0.1)
  const taxEnabled = settings.tax_enabled === '1'

  const cart = useCart()
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<number | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [customerName, setCustomerName] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [facilityType, setFacilityType] = useState<FacilityType>('DINE_IN')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState(() => generateInvoiceNumber())
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherId, setVoucherId] = useState<number | undefined>()
  const [discount, setDiscount] = useState(0)
  const [voucherMessage, setVoucherMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [customers, setCustomers] = useState<Member[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [showOpenDraft, setShowOpenDraft] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)
  const mergeBillEnabled = isModuleEnabled(settings, 'module_merge_bill')
  const showVoucher = isModuleEnabled(settings, 'pos_show_voucher')
  const showPreorder = isModuleEnabled(settings, 'pos_show_preorder')
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderDeadline, setPreorderDeadline] = useState('')
  const [dpAmount, setDpAmount] = useState(0)
  const [scanMode, setScanMode] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loyalty = useMemo(() => getLoyaltyConfig(settings), [settings])

  // Total tagihan berjalan (untuk modal pembayaran).
  const orderTax = taxEnabled ? Math.round((cart.subtotal - discount) * taxRate) : 0
  const orderTotal = cart.subtotal - Math.min(discount, cart.subtotal) + orderTax

  useEffect(() => {
    setCategories(fetchCategories())
    setCustomers(listMembers())
  }, [])

  const handleSelectCustomer = (c: { id: number; name: string }) => {
    setCustomerName(c.name)
    const m = customers.find((x) => x.id === c.id)
    if (m) setMember(m)
  }

  const handleOpenDraft = (draftId: number) => {
    const draft = getDraftForEdit(draftId, outletId)
    setShowOpenDraft(false)
    if (!draft) {
      showToast('Draft tidak ditemukan.')
      return
    }
    cart.replace(draft.items)
    setInvoiceNumber(draft.invoice_number)
    setFacilityType(draft.facility_type)
    setOrderNote(draft.note ?? '')
    setEditingDraftId(draft.id)
    clearVoucher()
    const m = draft.member_id ? customers.find((x) => x.id === draft.member_id) ?? null : null
    setMember(m)
    setCustomerName(m?.name ?? '')
    showToast(`Draft ${draft.invoice_number} dibuka.`)
  }

  useEffect(() => {
    setProducts(fetchProducts(outletId, activeCategory, keyword))
  }, [outletId, activeCategory, keyword])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const refreshProducts = () => setProducts(fetchProducts(outletId, activeCategory, keyword))

  // Tambah item ke keranjang + snackbar konfirmasi per item.
  const handleAddProduct = (product: Product) => {
    cart.addProduct(product)
    showToast(`✓ ${product.name} ditambahkan · ${formatRupiah(product.price)}`)
  }

  // Fokuskan input saat mode scan diaktifkan (siap terima barcode scanner).
  useEffect(() => {
    if (scanMode) searchRef.current?.focus()
  }, [scanMode])

  // Enter di kolom cari: pada mode scan, cari produk berdasarkan barcode/SKU persis.
  const handleSearchEnter = () => {
    if (!scanMode) return
    const code = keyword.trim()
    if (!code) return
    const product = findByBarcode(code, outletId)
    if (!product) {
      showToast(`Barcode "${code}" tidak ditemukan.`)
    } else if ((product.stock ?? 0) <= 0) {
      showToast(`${product.name} stok habis.`)
    } else {
      handleAddProduct(product)
    }
    setKeyword('')
    searchRef.current?.focus()
  }

  const clearVoucher = () => {
    setVoucherCode('')
    setVoucherId(undefined)
    setDiscount(0)
    setVoucherMessage(null)
  }

  const handleFindMember = () => {
    const found = listMembers(memberQuery)[0]
    if (found) {
      setMember(found)
      setMemberQuery('')
    } else {
      showToast('Member tidak ditemukan.')
    }
  }

  const handleApplyVoucher = () => {
    const result = validateVoucher(voucherCode, cart.subtotal)
    if (result.ok && result.voucher) {
      setVoucherId(result.voucher.id)
      setDiscount(result.discount ?? 0)
      setVoucherCode(result.voucher.code)
      setVoucherMessage({ ok: true, text: result.message })
    } else {
      setVoucherId(undefined)
      setDiscount(0)
      setVoucherMessage({ ok: false, text: result.message })
    }
  }

  const finishOrder = async (status: 'DRAFT' | 'COMPLETED', payments?: PaymentInput[]) => {
    if (cart.items.length === 0 || saving) return
    setSaving(true)
    try {
      const result = await saveOrder({
        outletId,
        items: cart.items,
        facilityType,
        customerName,
        tableNumber,
        taxRate,
        taxEnabled,
        status,
        discountAmount: discount,
        voucherId,
        memberId: member?.id,
        loyalty,
        payments,
        note: orderNote,
        invoiceNumber,
        replaceDraftId: editingDraftId ?? undefined,
      })
      showToast(
        status === 'DRAFT'
          ? `Draft tersimpan · ${result.invoiceNumber}`
          : `Pembayaran selesai · ${result.invoiceNumber}` +
              (result.pointsEarned > 0 ? ` · +${result.pointsEarned} poin` : ''),
      )
      resetOrder()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  const resetOrder = () => {
    cart.clear()
    clearVoucher()
    setMember(null)
    setMemberQuery('')
    setCustomerName('')
    setOrderNote('')
    setIsPreorder(false)
    setPreorderDeadline('')
    setDpAmount(0)
    setEditingDraftId(null)
    setInvoiceNumber(generateInvoiceNumber())
    refreshProducts()
  }

  const createPreorder = async () => {
    if (cart.items.length === 0 || saving) return
    const dp = Math.min(dpAmount, orderTotal)
    setSaving(true)
    try {
      const result = await saveOrder({
        outletId,
        items: cart.items,
        facilityType,
        customerName,
        tableNumber,
        taxRate,
        taxEnabled,
        status: 'PREPARING',
        discountAmount: discount,
        voucherId,
        memberId: member?.id,
        sendToKitchen: false,
        isPreorder: true,
        preorderDeadline: preorderDeadline || null,
        downPaymentReceived: dp,
        payments: dp > 0 ? [{ method: 'CASH', amountPaid: dp, tenderedAmount: dp }] : [],
        note: orderNote,
        invoiceNumber,
        replaceDraftId: editingDraftId ?? undefined,
      })
      showToast(`Pre-Order tersimpan · ${result.invoiceNumber} · DP ${formatRupiah(dp)}`)
      resetOrder()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  const handlePay = () => {
    if (showPreorder && isPreorder) createPreorder()
    else setShowPayment(true)
  }

  const handleSplitConfirm = async (bills: CartItem[][]) => {
    setShowSplit(false)
    if (saving) return
    setSaving(true)
    try {
      let parentId: number | undefined
      for (const billItems of bills) {
        const sub = billItems.reduce((s, it) => s + itemUnitPrice(it) * it.quantity, 0)
        const billTax = taxEnabled ? Math.round(sub * taxRate) : 0
        const billTotalAmt = sub + billTax
        const res = await saveOrder({
          outletId,
          items: billItems,
          facilityType,
          tableNumber,
          taxRate,
          taxEnabled,
          status: 'COMPLETED',
          sendToKitchen: false,
          parentTransactionId: parentId,
          payments: [{ method: 'CASH', amountPaid: billTotalAmt, tenderedAmount: billTotalAmt }],
          // Draft yang dibuka dihapus sekali, saat nota pertama disimpan.
          replaceDraftId: parentId === undefined ? editingDraftId ?? undefined : undefined,
        })
        if (parentId === undefined) parentId = res.transactionId
      }
      showToast(`${bills.length} nota split bill dibuat.`)
      resetOrder()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal split bill')
    } finally {
      setSaving(false)
    }
  }

  const categoryPills = useMemo(
    () => [{ id: undefined, name: 'Semua' } as const, ...categories],
    [categories],
  )

  return (
    <div className="flex h-full">
      {/* Panel Produk (kiri 65%) */}
      <section className="flex min-w-0 flex-1 flex-col" style={{ flexBasis: '65%' }}>
        {/* Header */}
        <header className="flex items-center gap-3 bg-white/70 px-4 py-3 backdrop-blur">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-ink hover:bg-background"
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
              {scanMode ? '🔦' : '🔍'}
            </span>
            <input
              ref={searchRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchEnter()}
              placeholder={
                scanMode ? 'Scan barcode produk lalu Enter…' : 'Cari nama produk atau SKU…'
              }
              className={
                'w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-strong ' +
                (scanMode ? 'border-status-occupied ring-1 ring-status-occupied/30' : 'border-black/10')
              }
            />
          </div>
          <button
            onClick={() => setScanMode((v) => !v)}
            title="Mode scan barcode: tambahkan produk dengan memindai barcode"
            className={
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ' +
              (scanMode
                ? 'bg-status-occupied text-white shadow'
                : 'border border-black/10 bg-white text-ink hover:bg-brand-soft')
            }
          >
            <span className="text-base leading-none">▮▮▮</span>
            <span className="hidden sm:inline">{scanMode ? 'Scan: ON' : 'Scan'}</span>
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            {mergeBillEnabled && (
              <button
                onClick={() => setShowMerge(true)}
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold
                           text-ink transition hover:bg-brand-soft"
                title="Gabungkan beberapa bill tersimpan menjadi satu"
              >
                ⿻ Gabung Bill
              </button>
            )}
            {tableNumber && (
              <span className="rounded-lg bg-status-occupied px-2.5 py-1 text-xs font-semibold text-white">
                Meja {tableNumber}
              </span>
            )}
            <span className="hidden sm:inline">👤 Kasir</span>
          </div>
        </header>

        {/* Kategori pills */}
        <nav className="flex flex-wrap gap-2 px-4 py-3">
          {categoryPills.map((c) => {
            const active = activeCategory === c.id
            return (
              <button
                key={c.name}
                onClick={() => setActiveCategory(c.id)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-medium transition ' +
                  (active
                    ? 'bg-status-occupied text-white shadow'
                    : 'bg-white text-ink hover:bg-brand-soft')
                }
              >
                {c.name}
              </button>
            )
          })}
        </nav>

        {/* Grid produk */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {products.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-soft">Produk tidak ditemukan.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={handleAddProduct} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Panel Transaksi (kanan 35%) */}
      <div className="w-[35%] min-w-[320px] max-w-[440px]">
        <CartPanel
          items={cart.items}
          invoiceNumber={invoiceNumber}
          onInvoiceChange={setInvoiceNumber}
          customerName={customerName}
          customers={customers.map((m) => ({ id: m.id, name: m.name, phone: m.phone }))}
          onSelectCustomer={handleSelectCustomer}
          facilityType={facilityType}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          saving={saving}
          showVoucher={showVoucher}
          showPreorder={showPreorder}
          voucherCode={voucherCode}
          discount={discount}
          voucherMessage={voucherMessage}
          member={member ? { name: member.name, points: member.points } : null}
          memberQuery={memberQuery}
          onMemberQueryChange={setMemberQuery}
          onFindMember={handleFindMember}
          onClearMember={() => setMember(null)}
          isPreorder={isPreorder}
          preorderDeadline={preorderDeadline}
          dpAmount={dpAmount}
          onTogglePreorder={setIsPreorder}
          onDeadlineChange={setPreorderDeadline}
          onDpChange={setDpAmount}
          onVoucherCodeChange={setVoucherCode}
          onApplyVoucher={handleApplyVoucher}
          onRemoveVoucher={clearVoucher}
          onCustomerNameChange={setCustomerName}
          onFacilityChange={setFacilityType}
          onQuantityChange={cart.setQuantity}
          onUnitChange={(productId, unit) => {
            const item = cart.items.find((it) => it.product.id === productId)
            if (!item) return
            const opts = buildUnitOptions(
              item.product.unit,
              item.product.price,
              item.product.unit_conversions,
            )
            const opt = opts.find((o) => o.unit === unit)
            if (opt) cart.setUnit(productId, opt)
          }}
          onNotesChange={cart.setNotes}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
          onRemove={cart.removeProduct}
          onSaveDraft={() => finishOrder('DRAFT')}
          onOpenDraft={() => setShowOpenDraft(true)}
          onPay={handlePay}
          onSplit={() => setShowSplit(true)}
        />
      </div>

      {/* Modal pembayaran berganda */}
      {showPayment && (
        <PaymentModal
          total={orderTotal}
          onCheckVoucher={validateTenderVoucher}
          onCancel={() => setShowPayment(false)}
          onConfirm={(payments) => {
            setShowPayment(false)
            finishOrder('COMPLETED', payments)
          }}
        />
      )}

      {/* Modal split bill */}
      {showSplit && (
        <SplitBillModal
          items={cart.items}
          taxRate={taxRate}
          taxEnabled={taxEnabled}
          onCancel={() => setShowSplit(false)}
          onConfirm={handleSplitConfirm}
        />
      )}

      {/* Modal buka draft */}
      {showOpenDraft && (
        <OpenDraftModal
          outletId={outletId}
          onCancel={() => setShowOpenDraft(false)}
          onOpen={handleOpenDraft}
        />
      )}

      {/* Modal merge bill */}
      {showMerge && (
        <MergeBillModal
          outletId={outletId}
          taxRate={taxRate}
          taxEnabled={taxEnabled}
          onCancel={() => setShowMerge(false)}
          onMerged={(msg) => {
            setShowMerge(false)
            showToast(msg)
            refreshProducts()
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3
                        text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
