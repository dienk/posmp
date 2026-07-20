import { useEffect, useState } from 'react'

/** Tombol toggle mode layar penuh (untuk menjalankan tampilan sebagai kiosk). */
export function FullscreenButton() {
  const [fs, setFs] = useState(false)

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  return (
    <button
      onClick={toggle}
      title="Mode layar penuh (kiosk)"
      className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-background"
    >
      {fs ? '✕ Keluar' : '⛶ Layar Penuh'}
    </button>
  )
}
