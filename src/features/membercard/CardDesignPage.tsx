import { useState } from 'react'
import { useSettings } from '../../lib/SettingsContext'
import { updateAppSettings } from '../settings/settingsRepository'
import { MemberCard } from './MemberCard'
import { CARD_DEFAULTS, cardConfigToSettings, getCardConfig, GRADIENTS, type CardConfig } from './cardConfig'
import type { CardMember } from './cardRender'

// Member contoh untuk pratinjau.
const SAMPLE: CardMember = {
  name: 'Budi Santoso',
  member_number: 'MP12345678',
  tier: 'GOLD',
  expiry_date: '2027-12-31',
  points: 1250,
}

export default function CardDesignPage() {
  const { settings, reloadSettings } = useSettings()
  const [cfg, setCfg] = useState<CardConfig>(() => getCardConfig(settings))
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof CardConfig>(k: K, v: CardConfig[K]) => setCfg((p) => ({ ...p, [k]: v }))
  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateAppSettings(cardConfigToSettings(cfg))
      reloadSettings()
      showToast('Desain kartu tersimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Desain Kartu Member</h1>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Desain'}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[360px_1fr]">
        {/* Form */}
        <section className="space-y-4">
          <div className="rounded-card bg-panel p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Teks</h2>
            <div className="space-y-3">
              <Field label="Judul">
                <input className={inputCls} value={cfg.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field label="Sub-judul">
                <input className={inputCls} value={cfg.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="rounded-card bg-panel p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Warna Latar</h2>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {GRADIENTS.map((g) => (
                <button
                  key={g.name}
                  onClick={() => setCfg((p) => ({ ...p, bgStart: g.start, bgEnd: g.end, textLight: g.light }))}
                  title={g.name}
                  className={
                    'h-10 rounded-lg border-2 ' +
                    (cfg.bgStart === g.start && cfg.bgEnd === g.end ? 'border-ink' : 'border-transparent')
                  }
                  style={{ background: `linear-gradient(135deg, ${g.start}, ${g.end})` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm text-ink">
                Awal
                <input type="color" value={cfg.bgStart} onChange={(e) => set('bgStart', e.target.value)} />
              </label>
              <label className="flex items-center gap-1 text-sm text-ink">
                Akhir
                <input type="color" value={cfg.bgEnd} onChange={(e) => set('bgEnd', e.target.value)} />
              </label>
              <label className="ml-auto flex items-center gap-2 text-sm text-ink">
                Teks terang
                <input
                  type="checkbox"
                  checked={cfg.textLight}
                  onChange={(e) => set('textLight', e.target.checked)}
                  className="h-5 w-5 accent-status-occupied"
                />
              </label>
            </div>
          </div>

          <div className="rounded-card bg-panel p-5 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Elemen</h2>
            <div className="space-y-2">
              <Toggle label="Logo" checked={cfg.showLogo} onChange={(v) => set('showLogo', v)} />
              <Toggle label="Barcode" checked={cfg.showBarcode} onChange={(v) => set('showBarcode', v)} />
              <Toggle label="Tingkatan (tier)" checked={cfg.showTier} onChange={(v) => set('showTier', v)} />
              <Toggle label="Masa berlaku" checked={cfg.showExpiry} onChange={(v) => set('showExpiry', v)} />
              <Toggle label="Poin" checked={cfg.showPoints} onChange={(v) => set('showPoints', v)} />
            </div>
            <button
              onClick={() => setCfg(CARD_DEFAULTS)}
              className="mt-3 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Kembalikan ke bawaan
            </button>
          </div>
        </section>

        {/* Pratinjau */}
        <section className="rounded-card bg-panel p-6 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-soft">Pratinjau</h2>
          <div className="flex justify-center">
            <MemberCard member={SAMPLE} config={cfg} />
          </div>
          <p className="mt-4 text-center text-xs text-ink-soft">
            Data di atas hanya contoh. Kartu asli memakai data member yang dipilih.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
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
