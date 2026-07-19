import { useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { getOutlet, updateAppSettings } from '../settings/settingsRepository'
import type { ReceiptData } from '../history/historyRepository'
import { ReceiptView } from './ReceiptModal'
import {
  fileToScaledDataUrl,
  getReceiptConfig,
  receiptConfigToSettings,
  urlToScaledDataUrl,
  type ReceiptAlign,
  type LogoPosition,
  type ReceiptConfig,
} from './receiptConfig'

export default function ReceiptDesignPage() {
  const { settings, reloadSettings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const outlet = useMemo(() => getOutlet(outletId), [outletId])

  const [cfg, setCfg] = useState<ReceiptConfig>(() => getReceiptConfig(settings))
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  const set = <K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }))

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // izinkan pilih file yang sama lagi
    if (!file) return
    try {
      set('logo', await fileToScaledDataUrl(file))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat gambar')
    }
  }

  const handleLogoUrl = async () => {
    if (!logoUrl.trim() || loadingUrl) return
    setLoadingUrl(true)
    try {
      set('logo', await urlToScaledDataUrl(logoUrl))
      setLogoUrl('')
      showToast('Logo dari URL berhasil dipasang.')
    } catch {
      showToast('Tidak bisa mengunduh dari URL (CORS/akses). Coba unggah file atau URL publik.')
    } finally {
      setLoadingUrl(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAppSettings(receiptConfigToSettings(cfg))
      reloadSettings()
      showToast('Desain struk tersimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  // Data contoh untuk preview.
  const sample: ReceiptData = {
    outlet: {
      name: outlet?.name ?? 'POSMerahPutih',
      address: outlet?.address ?? 'Jl. Merdeka No. 17, Jakarta',
      phone: outlet?.phone ?? '021-5550100',
    },
    invoice_number: 'INV-260718-120000-01',
    transaction_date: '2026-07-18 12:00:00',
    order_source: 'POS_OFFLINE',
    facility_type: 'DINE_IN',
    table_number: 'T-04',
    member_name: 'Budi Santoso',
    subtotal_amount: 135000,
    discount_amount: 5000,
    service_charge_amount: 6500,
    tax_amount: 13000,
    total_amount: 143000,
    points_earned: 143,
    status: 'COMPLETED',
    items: [
      { product_id: 1, name: 'Nasi Goreng Spesial', quantity: 1, unit_price: 25000, subtotal: 25000, notes: 'Pedas, tanpa timun', unit: null, unit_qty: null, base_unit: 'porsi' },
      { product_id: 2, name: 'Es Teh Manis', quantity: 2, unit_price: 5000, subtotal: 10000, notes: null, unit: null, unit_qty: null, base_unit: 'gelas' },
      { product_id: 3, name: 'Air Mineral', quantity: 24, unit_price: 4167, subtotal: 100000, notes: null, unit: 'dus', unit_qty: 1, base_unit: 'botol' },
    ],
    payments: [
      { payment_method: 'CASH', amount_paid: 143000, tendered_amount: 150000, change_amount: 7000, qris_reference_number: null },
    ],
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Desain Struk</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Desain'}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <section className="space-y-4">
          {/* Logo */}
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Logo / Gambar
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink-soft/40 bg-background">
                {cfg.logo ? (
                  <img src={cfg.logo} alt="logo" className="max-h-full max-w-full" />
                ) : (
                  <span className="text-2xl text-ink-soft">🖼️</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label className="cursor-pointer rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-brand-strong">
                  Pilih Gambar
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </label>
                {cfg.logo && (
                  <button
                    onClick={() => set('logo', '')}
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-status-occupied hover:bg-background"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Logo dari URL</span>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogoUrl()}
                  placeholder="https://…/logo.png"
                />
                <button
                  onClick={handleLogoUrl}
                  disabled={!logoUrl.trim() || loadingUrl}
                  className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
                >
                  {loadingUrl ? 'Memuat…' : 'Muat'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                URL harus dapat diakses publik & mengizinkan CORS.
              </p>
            </div>

            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Posisi Logo</span>
              <div className="flex gap-2">
                {(['top', 'bottom'] as LogoPosition[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => set('logoPosition', p)}
                    className={segBtn(cfg.logoPosition === p)}
                  >
                    {p === 'top' ? 'Atas' : 'Bawah'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Teks (multiline) */}
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Teks</h2>
            <div className="space-y-3">
              <Field label="Tagline (boleh beberapa baris)">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={cfg.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  placeholder="mis. Kopi & Dapur Nusantara"
                />
              </Field>
              <Field label="Ucapan Penutup (boleh beberapa baris)">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={cfg.footer}
                  onChange={(e) => set('footer', e.target.value)}
                />
              </Field>
              <Field label="Catatan Tambahan (kecil, boleh beberapa baris)">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={cfg.note}
                  onChange={(e) => set('note', e.target.value)}
                  placeholder={'mis. IG @posmerahputih\nWA 0812xxxx'}
                />
              </Field>
            </div>
          </div>

          {/* Perataan */}
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Perataan Header & Footer
            </h2>
            <div className="flex gap-2">
              {(['left', 'center', 'right'] as ReceiptAlign[]).map((a) => (
                <button key={a} onClick={() => set('align', a)} className={segBtn(cfg.align === a)}>
                  {a === 'left' ? '⟸ Kiri' : a === 'center' ? '☰ Tengah' : 'Kanan ⟹'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Tampilkan
            </h2>
            <div className="space-y-2">
              <Toggle label="Alamat outlet" checked={cfg.showAddress} onChange={(v) => set('showAddress', v)} />
              <Toggle label="Telepon outlet" checked={cfg.showPhone} onChange={(v) => set('showPhone', v)} />
              <Toggle label="Nama member" checked={cfg.showMember} onChange={(v) => set('showMember', v)} />
              <Toggle label="Poin diperoleh" checked={cfg.showPoints} onChange={(v) => set('showPoints', v)} />
              <Toggle label="Catatan item" checked={cfg.showItemNote} onChange={(v) => set('showItemNote', v)} />
              <Toggle label="Satuan item" checked={cfg.showItemUnit} onChange={(v) => set('showItemUnit', v)} />
            </div>
          </div>

          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              Lebar Kertas
            </h2>
            <div className="flex gap-2">
              {([58, 80] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => set('paperWidth', w)}
                  className={
                    'flex-1 rounded-lg py-2 text-sm font-semibold transition ' +
                    (cfg.paperWidth === w
                      ? 'bg-status-occupied text-white'
                      : 'bg-background text-ink hover:bg-brand-soft')
                  }
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Preview langsung */}
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Pratinjau
          </h2>
          <div className="flex justify-center">
            <div className="rounded-lg border border-dashed border-ink-soft/30 bg-white p-4 shadow-inner">
              <ReceiptView data={sample} config={cfg} />
            </div>
          </div>
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

const segBtn = (active: boolean) =>
  'flex-1 rounded-lg py-2 text-sm font-semibold transition ' +
  (active ? 'bg-status-occupied text-white' : 'bg-background text-ink hover:bg-brand-soft')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
      <span className="text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-status-empty"
      />
    </label>
  )
}
