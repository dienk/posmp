import { useEffect, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import type { FacilityType } from '../../types'
import { issueQueue } from '../queue/queueRepository'
import { nowServing } from './kioskRepository'
import { FullscreenButton } from './FullscreenButton'

const CHOICES: { facility: FacilityType; label: string; icon: string; color: string }[] = [
  { facility: 'DINE_IN', label: 'Makan di Tempat', icon: '🍽️', color: 'bg-status-occupied' },
  { facility: 'TAKEAWAY', label: 'Bawa Pulang', icon: '🥡', color: 'bg-brand-strong' },
  { facility: 'DELIVERY', label: 'Antar / Layanan', icon: '🛵', color: 'bg-status-empty' },
]

export default function KioskQueuePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [issued, setIssued] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serving, setServing] = useState<string[]>([])

  const reloadServing = () => setServing(nowServing(outletId))
  useEffect(reloadServing, [outletId])
  useRealtime('queue:update', reloadServing)

  // Kembali ke layar awal otomatis setelah nomor diterbitkan.
  useEffect(() => {
    if (!issued) return
    const t = window.setTimeout(() => setIssued(null), 8000)
    return () => window.clearTimeout(t)
  }, [issued])

  const take = async (facility: FacilityType) => {
    if (busy) return
    setBusy(true)
    try {
      const num = await issueQueue(outletId, facility)
      setIssued(num)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-soft to-background">
      <header className="flex items-center gap-3 px-8 py-5">
        <h1 className="text-2xl font-extrabold text-ink">Ambil Nomor Antrean</h1>
        <div className="ml-auto">
          <FullscreenButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8">
        {issued ? (
          <div className="w-full max-w-lg rounded-3xl bg-panel p-10 text-center shadow-2xl">
            <p className="text-lg font-semibold text-ink-soft">Nomor Antrean Anda</p>
            <p className="my-4 text-8xl font-black tracking-tight text-status-occupied">{issued}</p>
            <p className="text-lg text-ink">Silakan tunggu, nomor Anda akan dipanggil. 🙏</p>
            <button
              onClick={() => setIssued(null)}
              className="mt-8 rounded-2xl bg-ink px-8 py-3 text-lg font-bold text-white hover:brightness-110"
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            <p className="mb-8 text-xl text-ink-soft">Pilih jenis layanan untuk mengambil nomor:</p>
            <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
              {CHOICES.map((c) => (
                <button
                  key={c.facility}
                  onClick={() => take(c.facility)}
                  disabled={busy}
                  className={
                    'flex flex-col items-center gap-3 rounded-3xl p-10 text-white shadow-card transition hover:brightness-95 disabled:opacity-50 ' +
                    c.color
                  }
                >
                  <span className="text-6xl">{c.icon}</span>
                  <span className="text-xl font-bold">{c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {serving.length > 0 && (
        <footer className="border-t border-black/5 bg-panel/70 px-8 py-4 backdrop-blur">
          <span className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Sedang dipanggil:
          </span>{' '}
          <span className="text-lg font-extrabold text-status-empty">{serving.join(' · ')}</span>
        </footer>
      )}
    </div>
  )
}
