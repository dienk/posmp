import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { publish } from '../../lib/realtime'
import { useRealtime } from '../../lib/useRealtime'
import {
  listTransactions,
  processRefund,
  transactionItems,
  type TxItem,
  type TxSummary,
} from './historyRepository'

const SOURCE_LABEL: Record<string, string> = {
  POS_OFFLINE: 'Kasir',
  SELF_ORDER: 'Self-Order',
  SHOPEE: 'Shopee',
  TOKOPEDIA: 'Tokopedia',
  TIKTOK: 'TikTok',
}

export default function HistoryPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [txs, setTxs] = useState<TxSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<TxItem[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(() => setTxs(listTransactions(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  useEffect(() => {
    setItems(selectedId ? transactionItems(selectedId) : [])
    setReason('')
  }, [selectedId])

  const selected = useMemo(() => txs.find((t) => t.id === selectedId) ?? null, [txs, selectedId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const handleRefund = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const res = await processRefund(selected.id, outletId, reason)
      publish('order:update') // refresh dashboard/laporan
      showToast(
        `Refund ${res.refundInvoice} · ${formatRupiah(res.totalRefund)}` +
          (res.pointsReverted > 0 ? ` · −${res.pointsReverted} poin` : ''),
      )
      reload()
      setSelectedId(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal refund')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Riwayat Transaksi & Refund</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
        {/* Daftar transaksi */}
        <section className="rounded-card bg-white p-2 shadow-card">
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada transaksi.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {txs.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={
                      'flex w-full items-center justify-between px-3 py-3 text-left transition ' +
                      (selectedId === t.id ? 'bg-brand-soft' : 'hover:bg-background')
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.invoice_number}</p>
                      <p className="text-xs text-ink-soft">
                        {t.transaction_date} · {SOURCE_LABEL[t.order_source] ?? t.order_source}
                        {t.member_name ? ` · ${t.member_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink">{formatRupiah(t.total_amount)}</p>
                      <span
                        className={
                          'text-xs font-semibold ' +
                          (t.status === 'REFUNDED' ? 'text-status-occupied' : 'text-status-empty')
                        }
                      >
                        {t.status === 'REFUNDED' ? 'Refunded' : 'Lunas'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Detail + refund */}
        <section>
          {selected ? (
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">{selected.invoice_number}</h2>
              <p className="mb-3 text-xs text-ink-soft">{selected.transaction_date}</p>

              <ul className="mb-3 divide-y divide-black/5">
                {items.map((it) => (
                  <li key={it.product_id} className="flex justify-between py-2 text-sm">
                    <span className="text-ink">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="text-ink-soft">{formatRupiah(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-black/5 pt-2 text-sm font-bold text-ink">
                <span>Total</span>
                <span>{formatRupiah(selected.total_amount)}</span>
              </div>

              {selected.status === 'REFUNDED' ? (
                <div className="mt-4 rounded-lg bg-status-occupied/10 px-3 py-2 text-center text-sm font-semibold text-status-occupied">
                  Transaksi ini sudah direfund.
                </div>
              ) : (
                <div className="mt-4">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Alasan refund (opsional)"
                    className="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  />
                  <button
                    onClick={handleRefund}
                    disabled={busy}
                    className="w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
                  >
                    {busy ? 'Memproses…' : `Refund ${formatRupiah(selected.total_amount)}`}
                  </button>
                  <p className="mt-2 text-xs text-ink-soft">
                    Refund akan mengembalikan stok
                    {selected.points_earned > 0 && selected.member_id
                      ? ` dan menarik ${selected.points_earned} poin member`
                      : ''}
                    .
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-card bg-white text-sm text-ink-soft shadow-card">
              Pilih transaksi untuk melihat detail.
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
