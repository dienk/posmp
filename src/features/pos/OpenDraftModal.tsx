import { useEffect, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import { listOpenBills, type OpenBill } from './posRepository'

interface Props {
  outletId: number
  onCancel: () => void
  onOpen: (draftId: number) => void
}

export default function OpenDraftModal({ outletId, onCancel, onOpen }: Props) {
  const [drafts, setDrafts] = useState<OpenBill[]>([])

  useEffect(() => {
    setDrafts(listOpenBills(outletId))
  }, [outletId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-status-occupied px-5 py-4 text-white">
          <p className="text-lg font-bold">Buka Draft</p>
          <button onClick={onCancel} className="text-2xl leading-none hover:opacity-80">
            ×
          </button>
        </div>

        <div className="border-b border-black/5 px-5 py-3 text-xs text-ink-soft">
          Pilih bill tersimpan (Draft) untuk dimuat ke keranjang & dilanjutkan. Isi keranjang saat ini
          akan digantikan.
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
          {drafts.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">
              Belum ada bill tersimpan (Draft).
            </p>
          ) : (
            drafts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpen(d.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-black/10 p-3 text-left transition hover:border-status-occupied hover:bg-status-occupied/5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-status-waiting/15 text-lg">
                  📝
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{d.invoice_number}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {d.table_number ? `Meja ${d.table_number} · ` : ''}
                    {d.item_count} item
                    {d.note ? ` · ✎ ${d.note}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-ink">
                  {formatRupiah(d.total_amount)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
