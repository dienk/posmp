import { useEffect, useState } from 'react'

/**
 * Jam bergaya smartwatch: "watch face" membulat berisi hari, jam waktu-nyata
 * (dengan detik), dan tanggal. Berdetak sendiri tiap detik. Muka jam sengaja
 * gelap (seperti smartwatch) dengan cincin aksen dari token tema (`brand-strong`)
 * agar tetap serasi di semua tema. Ukuran `lg` (dashboard) atau `sm` (sidebar).
 */
export default function SmartwatchClock({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const p = (n: number) => String(n).padStart(2, '0')
  const hh = p(now.getHours())
  const mm = p(now.getMinutes())
  const ss = p(now.getSeconds())
  const day = now.toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase()
  const date = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  const lg = size === 'lg'

  return (
    <div className={'relative ' + (lg ? 'w-full max-w-[18rem]' : 'w-full')}>
      {/* Tombol "crown" khas smartwatch di sisi kanan */}
      <span
        aria-hidden
        className={
          'absolute top-1/2 -translate-y-1/2 rounded-full bg-brand-strong shadow-md ' +
          (lg ? '-right-1.5 h-8 w-2' : '-right-1 h-5 w-1.5')
        }
      />
      {/* Bezel + muka jam */}
      <div
        className={
          'relative overflow-hidden bg-gradient-to-b from-slate-700 to-slate-950 ' +
          'shadow-2xl ring-2 ring-brand-strong/50 ' +
          (lg ? 'rounded-[2rem] p-5' : 'rounded-2xl p-3')
        }
      >
        <div className="text-center">
          <p
            className={
              'font-bold uppercase text-red-400 ' +
              (lg ? 'text-xs tracking-[0.35em]' : 'text-[10px] tracking-[0.2em]')
            }
          >
            {day}
          </p>
          <p
            className={
              'font-mono font-extrabold leading-none tabular-nums text-white ' +
              (lg ? 'my-1.5 text-5xl' : 'my-1 text-2xl')
            }
          >
            {hh}
            <span className="animate-pulse text-red-400">:</span>
            {mm}
            <span className={'align-top text-slate-400 ' + (lg ? 'text-2xl' : 'text-sm')}>
              {ss}
            </span>
          </p>
          <p className={'text-slate-300 ' + (lg ? 'text-sm' : 'text-[11px]')}>{date}</p>
        </div>
      </div>
    </div>
  )
}
