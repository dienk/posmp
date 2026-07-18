import { useEffect, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import {
  generateVouchers,
  listCampaigns,
  listVouchersByCampaign,
  type DiscountType,
  type Voucher,
  type VoucherCampaign,
} from './voucherRepository'

const DISCOUNT_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: 'Persentase (%)',
  FIXED: 'Diskon Nominal (Rp)',
  VALUE_DEPOSIT: 'Gift Card / Deposit (Rp)',
}

export default function VoucherPage() {
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [sample, setSample] = useState<Voucher[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('Promo Milad')
  const [prefix, setPrefix] = useState('MILAD10')
  const [type, setType] = useState<DiscountType>('PERCENTAGE')
  const [value, setValue] = useState(10)
  const [minPurchase, setMinPurchase] = useState(50000)
  const [maxDiscount, setMaxDiscount] = useState(25000)
  const [usageLimit, setUsageLimit] = useState(1)
  const [quantity, setQuantity] = useState(100)

  const reload = () => setCampaigns(listCampaigns())
  useEffect(reload, [])

  useEffect(() => {
    if (selected != null) setSample(listVouchersByCampaign(selected, 24))
    else setSample([])
  }, [selected])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleGenerate = async () => {
    if (busy || !prefix.trim() || quantity < 1) return
    setBusy(true)
    try {
      const campaignId = await generateVouchers({
        campaignName: name.trim() || 'Kampanye',
        prefix: prefix.trim().toUpperCase(),
        discountType: type,
        discountValue: value,
        minPurchase,
        maxDiscount: type === 'PERCENTAGE' ? maxDiscount : null,
        usageLimit,
        quantity,
        expiryDate: null,
      })
      reload()
      setSelected(campaignId)
      showToast(`${quantity} voucher berhasil dibuat.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat voucher')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Voucher Generator</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[360px_1fr]">
        {/* Form generator */}
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Buat Voucher Massal
          </h2>
          <div className="space-y-3">
            <Field label="Nama Kampanye">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Awalan Kode (Prefix)">
              <input
                className={inputCls}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="MILAD10"
              />
              <p className="mt-1 text-xs text-ink-soft">Contoh hasil: {prefix.toUpperCase()}-A7K2QX</p>
            </Field>
            <Field label="Jenis Diskon">
              <select
                className={inputCls}
                value={type}
                onChange={(e) => setType(e.target.value as DiscountType)}
              >
                {Object.entries(DISCOUNT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={type === 'PERCENTAGE' ? 'Nilai (%)' : 'Nilai (Rp)'}>
                <input
                  type="number"
                  className={inputCls}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                />
              </Field>
              <Field label="Min. Belanja (Rp)">
                <input
                  type="number"
                  className={inputCls}
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(Number(e.target.value))}
                />
              </Field>
            </div>
            {type === 'PERCENTAGE' && (
              <Field label="Maks. Diskon (Rp)">
                <input
                  type="number"
                  className={inputCls}
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(Number(e.target.value))}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batas Pakai / kode">
                <input
                  type="number"
                  className={inputCls}
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(Number(e.target.value))}
                />
              </Field>
              <Field label="Jumlah Kode">
                <input
                  type="number"
                  className={inputCls}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Field>
            </div>
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="w-full rounded-xl bg-status-occupied py-3 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
            >
              {busy ? 'Membuat…' : `Generate ${quantity} Voucher`}
            </button>
          </div>
        </section>

        {/* Daftar kampanye & sampel kode */}
        <section className="space-y-4">
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Kampanye ({campaigns.length})
            </h2>
            {campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Belum ada kampanye voucher.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {campaigns.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelected(c.id)}
                      className={
                        'flex w-full items-center justify-between px-2 py-3 text-left transition ' +
                        (selected === c.id ? 'bg-brand-soft' : 'hover:bg-background')
                      }
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{c.campaign_name}</p>
                        <p className="text-xs text-ink-soft">
                          {c.prefix}-•••• ·{' '}
                          {c.discount_type === 'PERCENTAGE'
                            ? `${c.discount_value}%`
                            : formatRupiah(c.discount_value)}{' '}
                          · min {formatRupiah(c.min_purchase)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-ink-soft">
                        {c.used_total}/{c.voucher_count} terpakai
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected != null && (
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Contoh Kode (maks. 24)
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {sample.map((v) => (
                  <span
                    key={v.id}
                    className={
                      'rounded-lg border border-dashed px-2 py-1.5 text-center font-mono text-xs ' +
                      (v.used_count >= v.usage_limit
                        ? 'border-ink-soft/40 text-ink-soft line-through'
                        : 'border-brand-strong text-ink')
                    }
                  >
                    {v.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
