import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatRupiah, generateInvoiceNumber } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import type { Category, FacilityType, Product } from '../../types'
import CartPanel from './CartPanel'
import ProductCard from './ProductCard'
import { fetchCategories, fetchProducts, saveOrder, type PaymentInput } from './posRepository'
import { validateVoucher } from '../vouchers/voucherRepository'
import { listMembers, type Member } from '../members/membersRepository'
import PaymentModal from './PaymentModal'
import { useCart } from './useCart'

export default function PosPage() {
  const { settings } = useSettings()
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
  const [showPayment, setShowPayment] = useState(false)
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderDeadline, setPreorderDeadline] = useState('')
  const [dpAmount, setDpAmount] = useState(0)

  const pointsPerAmount = getNumberSetting(settings, 'points_per_amount', 0)

  // Total tagihan berjalan (untuk modal pembayaran).
  const orderTax = taxEnabled ? Math.round((cart.subtotal - discount) * taxRate) : 0
  const orderTotal = cart.subtotal - Math.min(discount, cart.subtotal) + orderTax

  useEffect(() => {
    setCategories(fetchCategories())
  }, [])

  useEffect(() => {
    setProducts(fetchProducts(outletId, activeCategory, keyword))
  }, [outletId, activeCategory, keyword])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const refreshProducts = () => setProducts(fetchProducts(outletId, activeCategory, keyword))

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
        pointsPerAmount,
        payments,
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
    setIsPreorder(false)
    setPreorderDeadline('')
    setDpAmount(0)
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
    if (isPreorder) createPreorder()
    else setShowPayment(true)
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
          <button className="rounded-lg p-2 text-ink hover:bg-background" aria-label="Menu">
            ☰
          </button>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
              🔍
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama produk atau SKU…"
              className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm
                         outline-none focus:border-brand-strong"
            />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
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
                <ProductCard key={p.id} product={p} onSelect={cart.addProduct} />
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
          customerName={customerName}
          facilityType={facilityType}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          saving={saving}
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
          onRemove={cart.removeProduct}
          onSaveDraft={() => finishOrder('DRAFT')}
          onPay={handlePay}
        />
      </div>

      {/* Modal pembayaran berganda */}
      {showPayment && (
        <PaymentModal
          total={orderTotal}
          onCancel={() => setShowPayment(false)}
          onConfirm={(payments) => {
            setShowPayment(false)
            finishOrder('COMPLETED', payments)
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
