import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import type { CartItem } from '../../types'
import { itemUnitPrice } from './useCart'

interface Props {
  items: CartItem[]
  taxRate: number
  taxEnabled: boolean
  serviceRate: number
  serviceEnabled: boolean
  onCancel: () => void
  onConfirm: (bills: CartItem[][]) => void
}

function billTotal(
  items: CartItem[],
  taxRate: number,
  taxEnabled: boolean,
  serviceRate: number,
  serviceEnabled: boolean,
): number {
  const sub = items.reduce((s, it) => s + itemUnitPrice(it) * it.quantity, 0)
  const service = serviceEnabled ? Math.round(sub * serviceRate) : 0
  const tax = taxEnabled ? Math.round((sub + service) * taxRate) : 0
  return sub + service + tax
}

export default function SplitBillModal({
  items,
  taxRate,
  taxEnabled,
  serviceRate,
  serviceEnabled,
  onCancel,
  onConfirm,
}: Props) {
  const [billCount, setBillCount] = useState(2)
  // Indeks nota untuk setiap item keranjang (default semua di Nota 1).
  const [assign, setAssign] = useState<number[]>(() => items.map(() => 0))

  const bills = useMemo(() => {
    const groups: CartItem[][] = Array.from({ length: billCount }, () => [])
    items.forEach((it, i) => {
      const b = Math.min(assign[i] ?? 0, billCount - 1)
      groups[b].push(it)
    })
    return groups
  }, [items, assign, billCount])

  const nonEmpty = bills.filter((b) => b.length > 0)
  const canConfirm = nonEmpty.length >= 2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl">
        <div className="flex items-center justify-between bg-status-occupied px-5 py-4 text-white">
          <p className="text-lg font-bold">Split Bill / Pisah Tagihan</p>
          <button onClick={onCancel} className="text-2xl leading-none hover:opacity-80">
            ×
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-line/5 px-5 py-3 text-sm">
          <span className="text-ink-soft">Jumlah nota:</span>
          <button
            onClick={() => setBillCount((n) => Math.max(2, n - 1))}
            className="h-7 w-7 rounded-full bg-background text-ink"
          >
            −
          </button>
          <span className="w-6 text-center font-bold">{billCount}</span>
          <button
            onClick={() => setBillCount((n) => Math.min(6, n + 1))}
            className="h-7 w-7 rounded-full bg-background text-ink"
          >
            +
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
          {items.map((it, i) => (
            <div key={it.product.id} className="flex items-center justify-between gap-2 rounded-lg bg-background p-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {it.quantity}× {it.product.name}
              </span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: billCount }, (_, b) => (
                  <button
                    key={b}
                    onClick={() => setAssign((prev) => prev.map((v, idx) => (idx === i ? b : v)))}
                    className={
                      'h-7 w-7 rounded-md text-xs font-bold ' +
                      ((assign[i] ?? 0) === b
                        ? 'bg-status-occupied text-white'
                        : 'bg-panel text-ink hover:bg-brand-soft')
                    }
                  >
                    {b + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3 grid gap-2">
            {bills.map((b, i) => (
              <div
                key={i}
                className="flex justify-between rounded-lg border border-line/10 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-ink">
                  Nota {i + 1} <span className="text-ink-soft">({b.length} item)</span>
                </span>
                <span className="font-bold text-ink">
                  {formatRupiah(billTotal(b, taxRate, taxEnabled, serviceRate, serviceEnabled))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line/5 p-4">
          <Button onClick={() => onConfirm(nonEmpty)} disabled={!canConfirm} className="w-full">
            {canConfirm ? `Buat ${nonEmpty.length} Nota` : 'Bagi ke minimal 2 nota'}
          </Button>
        </div>
      </div>
    </div>
  )
}
