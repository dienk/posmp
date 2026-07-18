import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import PaymentModal from '../pos/PaymentModal'
import {
  listPreorders,
  preorderItems,
  settlePreorder,
  type Preorder,
  type PreorderItem,
} from './preorderRepository'

export default function PreorderPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const pointsPerAmount = getNumberSetting(settings, 'points_per_amount', 0)

  const [orders, setOrders] = useState<Preorder[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<PreorderItem[]>([])
  const [showPay, setShowPay] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(() => setOrders(listPreorders(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  useEffect(() => {
    setItems(selectedId ? preorderItems(selectedId) : [])
  }, [selectedId])

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  )

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const isOverdue = (deadline: string | null) =>
    deadline ? new Date(deadline) < new Date(new Date().toDateString()) : false

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Pre-Order & Uang Muka</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-card bg-white p-2 shadow-card">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Belum ada pre-order aktif.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setSelectedId(o.id)}
                    className={
                      'flex w-full items-center justify-between px-3 py-3 text-left transition ' +
                      (selectedId === o.id ? 'bg-brand-soft' : 'hover:bg-background')
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{o.invoice_number}</p>
                      <p className="text-xs text-ink-soft">
                        {o.member_name ?? 'Umum'} · Ambil:{' '}
                        {o.preorder_deadline ? (
                          <span className={isOverdue(o.preorder_deadline) ? 'font-semibold text-status-occupied' : ''}>
                            {o.preorder_deadline}
                            {isOverdue(o.preorder_deadline) ? ' (lewat)' : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink">{formatRupiah(o.total_amount)}</p>
                      <p className="text-xs text-status-occupied">
                        Sisa {formatRupiah(o.remaining)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          {selected ? (
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">{selected.invoice_number}</h2>
              <p className="mb-3 text-xs text-ink-soft">
                Tenggat ambil: {selected.preorder_deadline ?? '—'}
              </p>

              <ul className="mb-3 divide-y divide-black/5">
                {items.map((it, i) => (
                  <li key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-ink">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="text-ink-soft">{formatRupiah(it.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1 border-t border-black/5 pt-2 text-sm">
                <div className="flex justify-between text-ink">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-semibold">{formatRupiah(selected.total_amount)}</dd>
                </div>
                <div className="flex justify-between text-status-empty">
                  <dt>Uang muka dibayar</dt>
                  <dd>{formatRupiah(selected.down_payment_received)}</dd>
                </div>
                <div className="flex justify-between text-status-occupied">
                  <dt className="font-semibold">Sisa pelunasan</dt>
                  <dd className="font-semibold">{formatRupiah(selected.remaining)}</dd>
                </div>
              </dl>

              <button
                onClick={() => setShowPay(true)}
                className="mt-4 w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
              >
                Lunasi & Ambil ({formatRupiah(selected.remaining)})
              </button>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-card bg-white text-sm text-ink-soft shadow-card">
              Pilih pre-order untuk melihat detail.
            </div>
          )}
        </section>
      </div>

      {showPay && selected && (
        <PaymentModal
          total={selected.remaining}
          onCancel={() => setShowPay(false)}
          onConfirm={async (payments) => {
            setShowPay(false)
            try {
              const res = await settlePreorder(selected.id, outletId, payments, pointsPerAmount)
              showToast(
                `Pre-Order ${selected.invoice_number} lunas` +
                  (res.pointsEarned > 0 ? ` · +${res.pointsEarned} poin` : ''),
              )
              setSelectedId(null)
              reload()
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Gagal melunasi')
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
