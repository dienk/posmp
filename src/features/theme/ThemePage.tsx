import { useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import {
  applyTheme,
  channelsToHex,
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  hexToChannels,
  PALETTE_ROLES,
  parseCustomVars,
  rgb,
  themeVars,
  THEMES,
  type Theme,
} from '../../lib/themes'
import { updateAppSettings } from '../settings/settingsRepository'

export default function ThemePage() {
  const { settings, reloadSettings } = useSettings()
  const [current, setCurrent] = useState(settings.theme ?? DEFAULT_THEME_ID)
  const [customVars, setCustomVars] = useState<Theme['vars']>(
    () => parseCustomVars(settings.theme_custom) ?? themeVars(settings.theme ?? DEFAULT_THEME_ID),
  )
  const [toast, setToast] = useState<string | null>(null)

  const flash = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2000)
  }

  const choosePreset = async (id: string) => {
    applyTheme(id) // umpan balik langsung
    setCurrent(id)
    await updateAppSettings({ theme: id })
    reloadSettings()
    flash('Tema diterapkan.')
  }

  // Ubah satu peran warna kustom + terapkan langsung (live preview).
  const setRole = (key: keyof Theme['vars'], hex: string) => {
    const next = { ...customVars, [key]: hexToChannels(hex) }
    setCustomVars(next)
    if (current === CUSTOM_THEME_ID) applyTheme(CUSTOM_THEME_ID, next)
  }

  const previewCustom = () => {
    setCurrent(CUSTOM_THEME_ID)
    applyTheme(CUSTOM_THEME_ID, customVars)
  }

  const loadFromActivePreset = () => {
    const base = themeVars(settings.theme && settings.theme !== CUSTOM_THEME_ID ? settings.theme : DEFAULT_THEME_ID)
    setCustomVars(base)
    if (current === CUSTOM_THEME_ID) applyTheme(CUSTOM_THEME_ID, base)
    flash('Palet dimuat dari preset.')
  }

  const applyCustom = async () => {
    setCurrent(CUSTOM_THEME_ID)
    applyTheme(CUSTOM_THEME_ID, customVars)
    await updateAppSettings({ theme: CUSTOM_THEME_ID, theme_custom: JSON.stringify(customVars) })
    reloadSettings()
    flash('Tema kustom disimpan & diterapkan.')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Tema</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {/* Preset */}
        <section>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Tema Bawaan
          </h2>
          <p className="mb-4 text-sm text-ink-soft">
            Pilih tema warna aplikasi. Warna status (hijau/merah/kuning) tetap sama agar makna tetap
            jelas.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((th) => {
              const active = current === th.id
              return (
                <button
                  key={th.id}
                  onClick={() => choosePreset(th.id)}
                  className={
                    'overflow-hidden rounded-card border-2 bg-panel text-left shadow-card transition hover:-translate-y-0.5 ' +
                    (active ? 'border-status-occupied' : 'border-transparent')
                  }
                >
                  {/* Pratinjau mini */}
                  <div className="p-4" style={{ backgroundColor: rgb(th.vars['--c-background']) }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className="rounded-lg px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: rgb(th.vars['--c-brand']),
                          color: rgb(th.vars['--c-ink']),
                        }}
                      >
                        Menu
                      </span>
                      <span
                        className="rounded-lg px-3 py-1 text-xs font-bold text-white"
                        style={{ backgroundColor: 'rgb(229 57 53)' }}
                      >
                        Bayar
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div
                        className="h-10 flex-1 rounded-md"
                        style={{ backgroundColor: rgb(th.vars['--c-surface']) }}
                      />
                      <div
                        className="h-10 flex-1 rounded-md"
                        style={{ backgroundColor: rgb(th.vars['--c-brand-strong']) }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-4 pt-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{th.name}</p>
                      <p className="text-xs text-ink-soft">{th.desc}</p>
                    </div>
                    {active && (
                      <span className="rounded-full bg-status-empty/15 px-2 py-0.5 text-xs font-semibold text-status-empty">
                        Aktif
                      </span>
                    )}
                  </div>
                  {/* Rincian palet: swatch setiap peran warna */}
                  <div className="flex gap-1 px-4 pb-3 pt-2">
                    {PALETTE_ROLES.map((r) => (
                      <span
                        key={r.key}
                        title={`${r.label}: ${channelsToHex(th.vars[r.key])}`}
                        className="h-5 flex-1 rounded border border-line/10"
                        style={{ backgroundColor: rgb(th.vars[r.key]) }}
                      />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Tema kustom */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Tema Kustom</h2>
            {current === CUSTOM_THEME_ID && (
              <span className="rounded-full bg-status-empty/15 px-2 py-0.5 text-xs font-semibold text-status-empty">
                Aktif
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={loadFromActivePreset} className="ml-auto">
              Muat dari preset
            </Button>
            <Button variant="ghost" size="sm" onClick={previewCustom}>
              Pratinjau
            </Button>
          </div>
          <p className="mb-4 text-sm text-ink-soft">
            Sesuaikan tiap peran warna. Perubahan langsung terlihat saat tema kustom aktif; tekan
            <b> Simpan Tema Kustom</b> untuk menyimpan.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_280px]">
            {/* Editor warna */}
            <div className="grid gap-2 sm:grid-cols-2">
              {PALETTE_ROLES.map((r) => (
                <label
                  key={r.key}
                  className="flex items-center gap-3 rounded-lg border border-line/10 px-3 py-2"
                >
                  <input
                    type="color"
                    value={channelsToHex(customVars[r.key])}
                    onChange={(e) => setRole(r.key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-line/10 bg-transparent p-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{r.label}</p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {r.hint} · {channelsToHex(customVars[r.key])}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Pratinjau kustom */}
            <div className="overflow-hidden rounded-card border border-line/10">
              <div className="p-4" style={{ backgroundColor: rgb(customVars['--c-background']) }}>
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="rounded-lg px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: rgb(customVars['--c-brand']),
                      color: rgb(customVars['--c-ink']),
                    }}
                  >
                    Menu
                  </span>
                  <span
                    className="rounded-lg px-3 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: 'rgb(229 57 53)' }}
                  >
                    Bayar
                  </span>
                </div>
                <div className="mb-2 flex gap-2">
                  <div
                    className="h-10 flex-1 rounded-md"
                    style={{ backgroundColor: rgb(customVars['--c-surface']) }}
                  />
                  <div
                    className="h-10 flex-1 rounded-md"
                    style={{ backgroundColor: rgb(customVars['--c-brand-strong']) }}
                  />
                </div>
                <p className="text-sm font-bold" style={{ color: rgb(customVars['--c-ink']) }}>
                  Nasi Goreng · Rp 25.000
                </p>
                <p className="text-xs" style={{ color: rgb(customVars['--c-ink-soft']) }}>
                  Contoh teks sekunder
                </p>
              </div>
            </div>
          </div>

          <Button onClick={applyCustom} className="mt-4 w-full sm:w-auto">
            Simpan Tema Kustom
          </Button>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-panel shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
