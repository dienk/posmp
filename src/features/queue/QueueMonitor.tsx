import { useEffect, useState } from 'react'
import { reloadDatabase } from '../../db/database'
import { subscribe } from '../../lib/realtime'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { fetchActiveQueue, type QueueTicket } from './queueRepository'

/**
 * Tampilan monitor publik untuk Smart TV.
 * Tab ini read-only & terpisah dari kasir, jadi salinan sql.js in-memory-nya
 * bisa basi. Karena itu setiap penyegaran memuat ulang snapshot DB dari
 * IndexedDB dulu (reloadDatabase) — dipicu event realtime lintas-tab
 * (`queue:update`/`order:update`) plus polling cadangan tiap 3 detik.
 */
export default function QueueMonitor() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const [tickets, setTickets] = useState<QueueTicket[]>([])

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      await reloadDatabase()
      if (alive) setTickets(fetchActiveQueue(outletId))
    }
    refresh()
    const unsubQueue = subscribe('queue:update', refresh)
    const unsubOrder = subscribe('order:update', refresh)
    const id = window.setInterval(refresh, 3000)
    return () => {
      alive = false
      unsubQueue()
      unsubOrder()
      window.clearInterval(id)
    }
  }, [outletId])

  const preparing = tickets.filter((t) => t.status === 'PREPARING')
  const ready = tickets.filter((t) => t.status === 'READY')

  return (
    <div className="flex h-full flex-col bg-ink text-panel">
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-4">
          <img
            src="/logo-mark.png"
            alt="POS Merah Putih"
            className="h-14 w-14 rounded-xl bg-panel p-1"
          />
          <h1 className="text-3xl font-extrabold">POSMerahPutih</h1>
        </div>
        <span className="text-lg text-white/70">Antrean Pesanan</span>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-6 px-10 pb-10">
        <MonitorColumn
          title="SEDANG DISIAPKAN"
          tint="bg-status-waiting/20 text-status-waiting"
          tickets={preparing}
        />
        <MonitorColumn
          title="SIAP DIAMBIL"
          tint="bg-status-empty/20 text-status-empty"
          tickets={ready}
          highlight
        />
      </div>
    </div>
  )
}

function MonitorColumn({
  title,
  tint,
  tickets,
  highlight,
}: {
  title: string
  tint: string
  tickets: QueueTicket[]
  highlight?: boolean
}) {
  return (
    <section className="flex flex-col rounded-3xl bg-white/5 p-6">
      <h2 className={`mb-5 rounded-full px-5 py-2 text-center text-xl font-bold ${tint}`}>{title}</h2>
      <div className="grid flex-1 grid-cols-3 content-start gap-4">
        {tickets.length === 0 ? (
          <p className="col-span-3 mt-10 text-center text-xl text-white/40">—</p>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              className={
                'flex items-center justify-center rounded-2xl py-8 text-5xl font-black ' +
                (highlight ? 'animate-pulse bg-status-empty text-white' : 'bg-white/10 text-white')
              }
            >
              {t.queue_number}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
