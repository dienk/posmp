import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSettings } from '../../lib/SettingsContext'
import { getActivePersona } from './accessRepository'

/**
 * Gerbang PIN untuk menu Kasir. Bila persona aktif mengaktifkan "Wajib PIN
 * buka/tutup Kasir" (dan punya PIN), layar Kasir dikunci sampai PIN benar
 * dimasukkan. Tombol "Kunci Kasir" mengunci kembali (buka lagi perlu PIN).
 * Aditif: persona tanpa pengaturan ini tak terpengaruh.
 */
export default function KasirPinGate({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const persona = useMemo(() => getActivePersona(settings), [settings])
  const needPin = !!(persona?.pinKasir && persona?.pin)

  const [unlocked, setUnlocked] = useState(!needPin)
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)

  // Sinkron saat kebutuhan/persona berubah (mis. ganti persona / ubah setelan).
  useEffect(() => {
    setUnlocked(!needPin)
    setEntry('')
    setError(false)
  }, [needPin, persona?.id])

  // Validasi saat panjang PIN terpenuhi (di effect agar tak setState saat render).
  useEffect(() => {
    if (!needPin || unlocked || !persona?.pin) return
    if (entry.length < persona.pin.length) return
    if (entry === persona.pin) {
      setUnlocked(true)
      setEntry('')
      setError(false)
    } else {
      setError(true)
      setEntry('')
    }
  }, [entry, needPin, unlocked, persona])

  if (needPin && !unlocked) {
    const press = (d: string) => {
      setError(false)
      setEntry((prev) => (prev.length >= 6 ? prev : prev + d))
    }
    const pinLen = persona!.pin!.length
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-xs rounded-2xl bg-panel p-6 text-center shadow-panel">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
            🔒
          </div>
          <h1 className="text-lg font-bold text-ink">Buka Kasir</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Masukkan PIN untuk <b>{persona!.name}</b>
          </p>

          {/* Titik PIN */}
          <div className={'mt-5 flex justify-center gap-3 ' + (error ? 'animate-pulse' : '')}>
            {Array.from({ length: pinLen }).map((_, i) => (
              <span
                key={i}
                className={
                  'h-3.5 w-3.5 rounded-full border ' +
                  (i < entry.length
                    ? 'border-brand-strong bg-brand-strong'
                    : error
                      ? 'border-status-occupied'
                      : 'border-ink-soft/50')
                }
              />
            ))}
          </div>
          {error && (
            <p className="mt-2 text-xs font-semibold text-status-occupied">PIN salah, coba lagi.</p>
          )}

          {/* Keypad angka */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                className="flex h-14 items-center justify-center rounded-xl bg-background text-xl font-bold text-ink transition hover:bg-brand-soft active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => {
                setError(false)
                setEntry('')
              }}
              className="flex h-14 items-center justify-center rounded-xl text-sm font-semibold text-ink-soft transition hover:bg-background"
            >
              Hapus
            </button>
            <button
              onClick={() => press('0')}
              className="flex h-14 items-center justify-center rounded-xl bg-background text-xl font-bold text-ink transition hover:bg-brand-soft active:scale-95"
            >
              0
            </button>
            <button
              onClick={() => {
                setError(false)
                setEntry((p) => p.slice(0, -1))
              }}
              aria-label="Hapus satu digit"
              className="flex h-14 items-center justify-center rounded-xl text-xl text-ink-soft transition hover:bg-background"
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {children}
      {needPin && (
        <button
          onClick={() => {
            setUnlocked(false)
            setEntry('')
            setError(false)
          }}
          title="Kunci Kasir — perlu PIN untuk membuka lagi"
          className="btn-ghost btn-sm fixed bottom-4 left-4 z-40 shadow-card"
        >
          🔒 Kunci Kasir
        </button>
      )}
    </div>
  )
}
