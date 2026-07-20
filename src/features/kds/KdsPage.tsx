import { useCallback, useEffect, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import {
  fetchKdsTickets,
  markTicketReady,
  toggleItemCooked,
  type KdsTicket,
} from './kdsRepository'

/** Menit berlalu sejak `ordered_at` (disimpan UTC oleh SQLite). */
function minutesSince(orderedAt: string, nowMs: number): number {
  const t = new Date(orderedAt.replace(' ', 'T') + 'Z').getTime()
  return Math.max(0, Math.floor((nowMs - t) / 60000))
}

function ageStyle(mins: number): string {
  if (mins >= 25) return 'border-status-occupied bg-status-occupied/5'
  if (mins >= 15) return 'border-status-waiting bg-status-waiting/10'
  return 'border-transparent bg-panel'
}

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}

export default function KdsPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const [tickets, setTickets] = useState<KdsTicket[]>([])
  const [now, setNow] = useState(() => Date.now())

  const reload = useCallback(() => setTickets(fetchKdsTickets(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('kds:update', reload)

  // Detak jam untuk memperbarui aging timer.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex h-full flex-col bg-ink/5">
      <header className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <h1 className="text-lg font-bold">Kitchen Display System</h1>
        <span className="flex items-center gap-2 text-sm text-white/80">
          <span className="h-2 w-2 animate-pulse rounded-full bg-status-empty" />
          Sinkron Lokal Aktif · {tickets.length} tiket
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tickets.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">
            Tidak ada pesanan di dapur. Kirim pesanan dari Kasir atau Self-Order.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tickets.map((t, idx) => {
              const mins = minutesSince(t.ordered_at, now)
              const allDone = t.items.every((i) => i.cooking_status === 'COOKED')
              return (
                <div
                  key={t.id}
                  className={`flex flex-col rounded-card border-2 shadow-card ${ageStyle(mins)}`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-black/5 p-3">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        #{idx + 1} ·{' '}
                        {t.table_number ? `Meja ${t.table_number}` : SOURCE_LABEL[t.order_source] ?? t.order_source}
                      </p>
                      <p className="text-xs text-ink-soft">{t.invoice_number}</p>
                    </div>
                    <span
                      className={
                        'rounded-lg px-2 py-1 text-xs font-bold ' +
                        (mins >= 25
                          ? 'bg-status-occupied text-white'
                          : mins >= 15
                            ? 'bg-status-waiting text-white'
                            : 'bg-background text-ink')
                      }
                    >
                      {mins}m
                    </span>
                  </div>

                  <ul className="flex-1 space-y-1 p-3">
                    {t.items.map((it) => {
                      const done = it.cooking_status === 'COOKED' || it.cooking_status === 'SERVED'
                      return (
                        <li key={it.detail_id}>
                          <button
                            onClick={() => toggleItemCooked(it.detail_id, !done)}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-background"
                          >
                            <span
                              className={
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ' +
                                (done
                                  ? 'border-status-empty bg-status-empty text-white'
                                  : 'border-ink-soft')
                              }
                            >
                              {done ? '✓' : ''}
                            </span>
                            <span className={done ? 'text-ink-soft line-through' : 'text-ink'}>
                              <span className="font-semibold">{it.quantity}×</span> {it.name}
                              {it.notes && (
                                <span className="block text-xs italic text-status-occupied">
                                  “{it.notes}”
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  <button
                    onClick={() => markTicketReady(t.id, t.transaction_id)}
                    className={
                      'm-3 mt-0 rounded-xl py-2.5 text-sm font-bold text-white transition ' +
                      (allDone
                        ? 'bg-status-empty hover:brightness-95'
                        : 'bg-brand-strong hover:brightness-95')
                    }
                  >
                    Tandai Siap Saji
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
