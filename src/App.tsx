import { useEffect, useState } from 'react'
import { initDatabase } from './db/database'
import { loadSettings } from './lib/settings'
import PosPage from './features/pos/PosPage'

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready'; settings: Record<string, string> }
  | { phase: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<BootState>({ phase: 'loading' })

  useEffect(() => {
    let mounted = true
    initDatabase()
      .then(() => {
        if (!mounted) return
        setState({ phase: 'ready', settings: loadSettings() })
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      mounted = false
    }
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="text-sm">Menyiapkan database lokal…</p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-status-occupied">Gagal memuat database</p>
        <p className="max-w-md text-sm text-ink-soft">{state.message}</p>
      </div>
    )
  }

  return <PosPage settings={state.settings} />
}
