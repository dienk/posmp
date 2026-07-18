import { useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { getOutlet, saveSettings } from './settingsRepository'

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
]

const ALL_TOGGLES = [...MODULES, ...POS_FEATURES]

export default function SettingsPage() {
  const { settings, reloadSettings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const outlet = useMemo(() => getOutlet(outletId), [outletId])

  const [name, setName] = useState(outlet?.name ?? '')
  const [address, setAddress] = useState(outlet?.address ?? '')
  const [phone, setPhone] = useState(outlet?.phone ?? '')
  const [taxPct, setTaxPct] = useState(getNumberSetting(settings, 'tax_rate', 0.1) * 100)
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled === '1')
  const [pointsPer, setPointsPer] = useState(getNumberSetting(settings, 'points_per_amount', 1000))
  const [modules, setModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_TOGGLES.map((m) => [m.key, settings[m.key] === '1'])),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const next: Record<string, string> = {
        tax_rate: String(Math.max(0, taxPct) / 100),
        tax_enabled: taxEnabled ? '1' : '0',
        points_per_amount: String(Math.max(0, Math.round(pointsPer))),
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
      <header className="flex items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
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
        <section className="rounded-card bg-white p-5 shadow-card">
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
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Transaksi & Loyalitas
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="h-4 w-4 accent-status-occupied"
              />
              <span className="text-sm text-ink">Pajak aktif</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Tarif Pajak (%)</span>
              <input
                type="number"
                className={inputCls}
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Rp per 1 poin
              </span>
              <input
                type="number"
                className={inputCls}
                value={pointsPer}
                onChange={(e) => setPointsPer(Number(e.target.value))}
              />
            </label>
          </div>
        </section>

        {/* Modularitas */}
        <section className="rounded-card bg-white p-5 shadow-card">
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
        <section className="rounded-card bg-white p-5 shadow-card">
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
