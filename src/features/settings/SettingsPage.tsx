import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { getOutlet, saveSettings } from './settingsRepository'
import { defaultTax } from '../taxes/taxesRepository'
import { callQueueNumber, DEFAULT_QUEUE_CALL_TEXT } from '../../lib/tts'
import {
  getPaymentMethods,
  serializePaymentMethods,
  type PayMethod,
} from './paymentMethods'
import {
  computePoints,
  getLoyaltyConfig,
  loyaltyToSettings,
  MEMBER_TIERS,
  type LoyaltyConfig,
} from '../../lib/loyalty'

const MODULES: { key: string; label: string; desc: string }[] = [
  { key: 'module_table_layout', label: 'Tata Letak Meja', desc: 'Denah meja & status (F&B)' },
  { key: 'module_kds', label: 'Kitchen Display', desc: 'Layar dapur real-time' },
  { key: 'module_queue', label: 'Antrean', desc: 'Nomor antrean & monitor TV' },
  { key: 'module_self_order', label: 'Self-Order', desc: 'Menu QR pelanggan' },
  { key: 'module_marketplace', label: 'Marketplace', desc: 'Integrasi Shopee/Tokopedia/TikTok' },
]

// Fitur opsional pada layar kasir (tidak menyembunyikan menu navigasi).
const POS_FEATURES: { key: string; label: string; desc: string }[] = [
  {
    key: 'module_merge_bill',
    label: 'Merge Bill',
    desc: 'Gabungkan beberapa bill tersimpan (Draft) menjadi satu tagihan',
  },
  {
    key: 'pos_show_voucher',
    label: 'Kode Voucher',
    desc: 'Tampilkan kolom kode voucher di layar kasir',
  },
  {
    key: 'pos_show_preorder',
    label: 'Pre-Order (pesan di muka)',
    desc: 'Tampilkan opsi pre-order & uang muka di layar kasir',
  },
]

const ALL_TOGGLES = [...MODULES, ...POS_FEATURES]

export default function SettingsPage() {
  const { settings, reloadSettings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const outlet = useMemo(() => getOutlet(outletId), [outletId])

  const [name, setName] = useState(outlet?.name ?? '')
  const [address, setAddress] = useState(outlet?.address ?? '')
  const [phone, setPhone] = useState(outlet?.phone ?? '')
  const taxRatePct = getNumberSetting(settings, 'tax_rate', 0.1) * 100
  const activeTax = useMemo(() => defaultTax(), [])
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled === '1')
  const [serviceEnabled, setServiceEnabled] = useState(settings.service_charge_enabled === '1')
  const [serviceRatePct, setServiceRatePct] = useState(
    getNumberSetting(settings, 'service_charge_rate', 0.05) * 100,
  )
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(() => getLoyaltyConfig(settings))
  const setLoy = <K extends keyof LoyaltyConfig>(key: K, value: LoyaltyConfig[K]) =>
    setLoyalty((prev) => ({ ...prev, [key]: value }))
  const setTierMult = (tier: (typeof MEMBER_TIERS)[number], value: number) =>
    setLoyalty((prev) => ({
      ...prev,
      tierMultiplier: { ...prev.tierMultiplier, [tier]: value },
    }))
  const [callText, setCallText] = useState(settings.queue_call_text ?? DEFAULT_QUEUE_CALL_TEXT)
  const [modules, setModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_TOGGLES.map((m) => [m.key, settings[m.key] === '1'])),
  )
  const [payMethods, setPayMethods] = useState<PayMethod[]>(() => getPaymentMethods(settings))
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState('💰')
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggleMethod = (key: string) =>
    setPayMethods((prev) => prev.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m)))
  const removeMethod = (key: string) =>
    setPayMethods((prev) => prev.filter((m) => m.key !== key))
  const addMethod = () => {
    const label = newLabel.trim()
    if (!label) return
    if (payMethods.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
      showToast('Metode dengan nama itu sudah ada.')
      return
    }
    setPayMethods((prev) => [
      ...prev,
      { key: label, label, icon: newIcon.trim() || '💰', enabled: true, builtin: false },
    ])
    setNewLabel('')
    setNewIcon('💰')
  }

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const next: Record<string, string> = {
        tax_enabled: taxEnabled ? '1' : '0',
        service_charge_enabled: serviceEnabled ? '1' : '0',
        service_charge_rate: String(Math.max(0, serviceRatePct) / 100),
        queue_call_text: callText.trim() || DEFAULT_QUEUE_CALL_TEXT,
        payment_methods: serializePaymentMethods(payMethods),
        ...loyaltyToSettings(loyalty),
        ...Object.fromEntries(ALL_TOGGLES.map((m) => [m.key, modules[m.key] ? '1' : '0'])),
      }
      await saveSettings(next, outletId, { name, address, phone })
      reloadSettings()
      showToast('Pengaturan tersimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Pengaturan</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Outlet */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Outlet</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Nama Outlet</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Alamat</span>
              <input
                className={inputCls}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Telepon</span>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
        </section>

        {/* Transaksi */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Transaksi
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="h-4 w-4 accent-status-occupied"
              />
              <span className="text-sm text-ink">Pajak aktif</span>
            </label>
            <div className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Tarif Pajak (%)</span>
              <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm">
                <span className="font-semibold text-ink">{taxRatePct}%</span>
                <span className="text-xs text-ink-soft">
                  {activeTax ? `· ${activeTax.name}` : ''}
                </span>
                <Link
                  to="/taxes"
                  className="ml-auto text-xs font-semibold text-status-occupied hover:underline"
                >
                  Kelola Pajak →
                </Link>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={serviceEnabled}
                onChange={(e) => setServiceEnabled(e.target.checked)}
                className="h-4 w-4 accent-status-occupied"
              />
              <span className="text-sm text-ink">Service charge aktif</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Tarif Service Charge (%)
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={!serviceEnabled}
                className={inputCls + (serviceEnabled ? '' : ' opacity-50')}
                value={serviceRatePct}
                onChange={(e) => setServiceRatePct(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Service charge (biaya layanan) dihitung dari subtotal setelah diskon; pajak dihitung di
            atas subtotal + service charge. Muncul di kasir, transaksi, & struk.
          </p>
        </section>

        {/* Program Loyalitas (Poin) */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Program Loyalitas (Poin)
            </h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={loyalty.enabled}
                onChange={(e) => setLoy('enabled', e.target.checked)}
                className="h-4 w-4 accent-status-empty"
              />
              <span className="text-sm font-medium text-ink">Aktif</span>
            </label>
          </div>

          <div className={loyalty.enabled ? '' : 'pointer-events-none opacity-50'}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Rp per 1 poin</span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={loyalty.perAmount}
                  onChange={(e) => setLoy('perAmount', Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Dasar hitung</span>
                <select
                  className={inputCls}
                  value={loyalty.basis}
                  onChange={(e) => setLoy('basis', e.target.value as LoyaltyConfig['basis'])}
                >
                  <option value="total">Total akhir (setelah pajak &amp; diskon)</option>
                  <option value="subtotal">Subtotal (sebelum pajak)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Pembulatan</span>
                <select
                  className={inputCls}
                  value={loyalty.rounding}
                  onChange={(e) => setLoy('rounding', e.target.value as LoyaltyConfig['rounding'])}
                >
                  <option value="floor">Ke bawah (floor)</option>
                  <option value="round">Terdekat (round)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Min. transaksi (Rp)
                </span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={loyalty.minPurchase}
                  onChange={(e) => setLoy('minPurchase', Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Maks. poin / transaksi (0 = tanpa batas)
                </span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={loyalty.maxPerTransaction}
                  onChange={(e) => setLoy('maxPerTransaction', Number(e.target.value))}
                />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Pengali Poin per Tier
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {MEMBER_TIERS.map((t) => (
                  <label key={t} className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">{t}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        className={inputCls}
                        value={loyalty.tierMultiplier[t]}
                        onChange={(e) => setTierMult(t, Number(e.target.value))}
                      />
                      <span className="text-xs text-ink-soft">×</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-ink-soft">
              Contoh belanja <b>Rp 50.000</b>:{' '}
              {MEMBER_TIERS.map((t, i) => (
                <span key={t}>
                  {i > 0 && ' · '}
                  {t}{' '}
                  <b className="text-ink">
                    {computePoints(loyalty, { total: 50000, subtotal: 50000 }, t)}
                  </b>{' '}
                  poin
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* Antrean */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Antrean</h2>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">
              Kalimat Panggilan Suara
            </span>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={callText}
                onChange={(e) => setCallText(e.target.value)}
                placeholder={DEFAULT_QUEUE_CALL_TEXT}
              />
              <button
                type="button"
                onClick={() => callQueueNumber('A-01', callText)}
                className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
                title="Dengarkan contoh panggilan untuk nomor A-01"
              >
                🔊 Coba
              </button>
            </div>
          </label>
          <p className="mt-2 text-xs text-ink-soft">
            Gunakan <code className="rounded bg-background px-1">{'{no}'}</code> sebagai tempat nomor
            antrean (dieja per karakter). Contoh: “Nomor antrian {'{no}'}, silakan diambil.”
          </p>
        </section>

        {/* Modularitas */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Modul Aktif
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className="flex items-center justify-between rounded-xl bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{m.label}</p>
                  <p className="text-xs text-ink-soft">{m.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules[m.key] ?? false}
                  onChange={(e) => setModules((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                  className="h-5 w-5 accent-status-empty"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Modul yang dimatikan akan disembunyikan dari menu navigasi.
          </p>
        </section>

        {/* Fitur Kasir (POS) */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Fitur Kasir
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {POS_FEATURES.map((m) => (
              <label
                key={m.key}
                className="flex items-center justify-between rounded-xl bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{m.label}</p>
                  <p className="text-xs text-ink-soft">{m.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules[m.key] ?? false}
                  onChange={(e) => setModules((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                  className="h-5 w-5 accent-status-empty"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Fitur ini muncul sebagai tombol di layar kasir saat diaktifkan. Bawaan: nonaktif.
          </p>
        </section>

        {/* Metode Pembayaran */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Metode Pembayaran
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {payMethods.map((m) => (
              <div
                key={m.key}
                className="flex items-center justify-between rounded-xl bg-background px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg leading-none">{m.icon}</span>
                  <span className="truncate text-sm font-semibold text-ink">{m.label}</span>
                  {m.builtin ? (
                    <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                      Bawaan
                    </span>
                  ) : (
                    <button
                      onClick={() => removeMethod(m.key)}
                      className="text-xs font-semibold text-status-occupied hover:opacity-70"
                      title="Hapus metode"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={() => toggleMethod(m.key)}
                  className="h-5 w-5 accent-status-empty"
                />
              </div>
            ))}
          </div>

          {/* Tambah metode kustom */}
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/5 pt-3">
            <label className="block w-16">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Ikon</span>
              <input
                className={inputCls + ' text-center'}
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                maxLength={2}
                placeholder="💰"
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Metode baru (mis. GoPay, OVO, Transfer BCA)
              </span>
              <input
                className={inputCls}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMethod()}
                placeholder="Nama metode pembayaran"
              />
            </label>
            <button
              onClick={addMethod}
              disabled={!newLabel.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
            >
              + Tambah
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Metode aktif muncul di layar bayar kasir. Metode kustom cukup mencatat nominal
            (tanpa uang pas/QRIS/gift card). Nama metode kustom tampil apa adanya di struk.
          </p>
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
