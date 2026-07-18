import { useState } from 'react'
import { useSettings } from '../../lib/SettingsContext'
import { applyTheme, DEFAULT_THEME_ID, rgb, THEMES } from '../../lib/themes'
import { updateAppSettings } from '../settings/settingsRepository'

export default function ThemePage() {
  const { settings, reloadSettings } = useSettings()
  const [current, setCurrent] = useState(settings.theme ?? DEFAULT_THEME_ID)
  const [toast, setToast] = useState<string | null>(null)

  const choose = async (id: string) => {
    applyTheme(id) // umpan balik langsung
    setCurrent(id)
    await updateAppSettings({ theme: id })
    reloadSettings()
    setToast('Tema diterapkan.')
    window.setTimeout(() => setToast(null), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Tema</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                onClick={() => choose(th.id)}
                className={
                  'overflow-hidden rounded-card border-2 bg-white text-left shadow-card transition hover:-translate-y-0.5 ' +
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

                <div className="flex items-center justify-between px-4 py-3">
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
              </button>
            )
          })}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
