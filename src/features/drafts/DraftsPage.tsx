import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { deleteDraft, listOpenBills, type OpenBill } from '../pos/posRepository'
import { transactionItems, type TxItem } from '../history/historyRepository'

export default function DraftsPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [drafts, setDrafts] = useState<OpenBill[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<TxItem[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(() => setDrafts(listOpenBills(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  useEffect(() => {
    setItems(selectedId ? transactionItems(selectedId) : [])
  }, [selectedId, drafts])

  const selected = useMemo(() => drafts.find((d) => d.id === selectedId) ?? null, [drafts, selectedId])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2800)
  }

  const total = useMemo(() => drafts.reduce((s, d) => s + d.total_amount, 0), [drafts])

  const handleDelete = async (d: OpenBill) => {
    if (busy) return
    setBusy(true)
    try {
      await deleteDraft(d.id, outletId)
      if (selectedId === d.id) setSelectedId(null)
      reload()
      showToast(`Draft ${d.invoice_number} dibatalkan.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membatalkan draft')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Transaksi Draft</h1>
        <span className="text-xs text-ink-soft">
          {drafts.length} draft · {formatRupiah(total)}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
        {/* Daftar draft */}
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          {drafts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">
              Belum ada transaksi draft. Simpan bill dari layar Kasir untuk menyimpannya sebagai draft.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelectedId(d.id)}
                    className={
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition ' +
                      (selectedId === d.id ? 'bg-brand-soft' : 'hover:bg-background')
                    }
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-status-waiting/15 text-lg">
                      📝
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{d.invoice_number}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {d.table_number ? `Meja ${d.table_number} · ` : ''}
                        {d.item_count} item · {d.transaction_date}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-ink">
                      {formatRupiah(d.total_amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Detail draft */}
        <section>
          {selected ? (
            <div className="rounded-card bg-panel p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">{selected.invoice_number}</h2>
              <p className="mb-3 text-xs text-ink-soft">
                {selected.table_number ? `Meja ${selected.table_number} · ` : ''}
                {selected.transaction_date}
              </p>

              <ul className="mb-3 divide-y divide-black/5">
                {items.map((it) => (
                  <li key={it.product_id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-ink-soft">{formatRupiah(it.subtotal)}</span>
                    </div>
                    {it.notes && <p className="mt-0.5 text-xs italic text-ink-soft">✎ {it.notes}</p>}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-black/5 pt-2 text-sm font-bold text-ink">
                <span>Total</span>
                <span>{formatRupiah(selected.total_amount)}</span>
              </div>

              {selected.note && (
                <div className="mt-3 rounded-lg bg-brand-soft px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                    Catatan Transaksi
                  </p>
                  <p className="text-sm text-ink">{selected.note}</p>
                </div>
              )}

              <button
                onClick={() => handleDelete(selected)}
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
              >
                {busy ? 'Memproses…' : 'Batalkan Draft'}
              </button>
              <p className="mt-2 text-center text-xs text-ink-soft">
                Membatalkan draft menghapusnya & mengosongkan meja terkait.
              </p>
            </div>
          ) : (
            <div className="rounded-card bg-panel p-5 text-center text-sm text-ink-soft shadow-card">
              Pilih draft untuk melihat detail.
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
