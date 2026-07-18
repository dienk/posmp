import { useEffect, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { callQueueNumber } from '../../lib/tts'
import type { FacilityType } from '../../types'
import {
  fetchActiveQueue,
  issueQueue,
  setQueueStatus,
  type QueueTicket,
} from './queueRepository'

const TYPE_LABEL: Record<FacilityType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Take Away',
  DELIVERY: 'Delivery',
}

export default function QueuePage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const [tickets, setTickets] = useState<QueueTicket[]>([])

  const reload = () => setTickets(fetchActiveQueue(outletId))
  useEffect(reload, [outletId])

  const handleIssue = async (facility: FacilityType) => {
    await issueQueue(outletId, facility)
    reload()
  }

  const handleReady = async (t: QueueTicket) => {
    await setQueueStatus(t.id, 'READY')
    callQueueNumber(t.queue_number)
    reload()
  }

  const handleComplete = async (t: QueueTicket) => {
    await setQueueStatus(t.id, 'COMPLETED')
    reload()
  }

  const preparing = tickets.filter((t) => t.status === 'PREPARING')
  const ready = tickets.filter((t) => t.status === 'READY')

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Sistem Antrean</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleIssue('DINE_IN')}
            className="rounded-lg bg-status-occupied px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
          >
            + Antrean Dine In (A)
          </button>
          <button
            onClick={() => handleIssue('TAKEAWAY')}
            className="rounded-lg bg-brand-strong px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
          >
            + Take Away (B)
          </button>
          <a
            href="#/monitor"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-background"
          >
            🖥️ Buka Monitor TV
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
        <QueueColumn
          title="Sedang Disiapkan"
          accent="text-status-waiting"
          empty="Tidak ada antrean diproses."
          tickets={preparing}
          renderActions={(t) => (
            <button
              onClick={() => handleReady(t)}
              className="rounded-lg bg-status-empty px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
            >
              Tandai Siap 🔔
            </button>
          )}
        />
        <QueueColumn
          title="Siap Diambil"
          accent="text-status-empty"
          empty="Belum ada yang siap."
          tickets={ready}
          renderActions={(t) => (
            <div className="flex gap-2">
              <button
                onClick={() => callQueueNumber(t.queue_number)}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-background"
              >
                Panggil Ulang
              </button>
              <button
                onClick={() => handleComplete(t)}
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
              >
                Selesai
              </button>
            </div>
          )}
        />
      </div>
    </div>
  )
}

function QueueColumn({
  title,
  accent,
  empty,
  tickets,
  renderActions,
}: {
  title: string
  accent: string
  empty: string
  tickets: QueueTicket[]
  renderActions: (t: QueueTicket) => React.ReactNode
}) {
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className={`mb-3 text-sm font-bold uppercase tracking-wide ${accent}`}>
        {title} · {tickets.length}
      </h2>
      {tickets.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-background px-4 py-3"
            >
              <div>
                <p className="text-2xl font-extrabold text-ink">{t.queue_number}</p>
                <p className="text-xs text-ink-soft">{TYPE_LABEL[t.facility_type]}</p>
              </div>
              {renderActions(t)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
