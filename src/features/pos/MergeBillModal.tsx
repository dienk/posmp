import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { listOpenBills, mergeBills, type OpenBill } from './posRepository'

interface Props {
  outletId: number
  taxRate: number
  taxEnabled: boolean
  serviceRate: number
  serviceEnabled: boolean
  onCancel: () => void
  onMerged: (msg: string) => void
}

export default function MergeBillModal({
  outletId,
  taxRate,
  taxEnabled,
  serviceRate,
  serviceEnabled,
  onCancel,
  onMerged,
}: Props) {
  const [bills, setBills] = useState<OpenBill[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBills(listOpenBills(outletId))
  }, [outletId])

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedBills = useMemo(() => bills.filter((b) => selected.has(b.id)), [bills, selected])
  const canMerge = selectedBills.length >= 2

  // Estimasi total gabungan (jumlah total tiap bill; nilai final dihitung ulang di repository).
  const estimate = useMemo(
    () => selectedBills.reduce((s, b) => s + b.total_amount, 0),
    [selectedBills],
  )

  const handleMerge = async () => {
    if (!canMerge || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await mergeBills({
        serviceRate,
        serviceEnabled,
        billIds: [...selected],
        outletId,
        taxRate,
        taxEnabled,
      })
      onMerged(
        `${selectedBills.length} bill digabung → ${res.invoiceNumber} · ${formatRupiah(res.total)}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menggabungkan bill')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl">
        <div className="flex items-center justify-between bg-status-occupied px-5 py-4 text-white">
          <p className="text-lg font-bold">Merge Bill / Gabung Tagihan</p>
          <button onClick={onCancel} className="text-2xl leading-none hover:opacity-80">
            ×
          </button>
        </div>

        <div className="border-b border-line/5 px-5 py-3 text-xs text-ink-soft">
          Pilih 2 bill tersimpan (Draft) atau lebih untuk digabung menjadi satu tagihan. Meja bill
          yang digabung akan dikosongkan.
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
          {bills.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">
              Belum ada bill tersimpan (Draft) untuk digabung.
            </p>
          ) : (
            bills.map((b) => {
              const on = selected.has(b.id)
              return (
                <label
                  key={b.id}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ' +
                    (on ? 'border-status-occupied bg-status-occupied/5' : 'border-line/10 hover:bg-background')
                  }
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(b.id)}
                    className="h-5 w-5 accent-status-occupied"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{b.invoice_number}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {b.table_number ? `Meja ${b.table_number} · ` : ''}
                      {b.item_count} item
                      {b.note ? ` · ✎ ${b.note}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink">
                    {formatRupiah(b.total_amount)}
                  </span>
                </label>
              )
            })
          )}

          {error && <p className="text-sm font-medium text-status-occupied">{error}</p>}
        </div>

        <div className="border-t border-line/5 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-ink-soft">
              {selectedBills.length} bill dipilih
            </span>
            <span className="font-bold text-ink">{formatRupiah(estimate)}</span>
          </div>
          <Button onClick={handleMerge} disabled={!canMerge || busy} className="w-full">
            {busy ? 'Menggabungkan…' : canMerge ? `Gabungkan ${selectedBills.length} Bill` : 'Pilih minimal 2 bill'}
          </Button>
        </div>
      </div>
    </div>
  )
}
