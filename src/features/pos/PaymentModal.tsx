import { useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format'
import type { PaymentInput, PaymentMethod } from './posRepository'

const METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Tunai', icon: '💵' },
  { value: 'QRIS', label: 'QRIS', icon: '📱' },
  { value: 'DEBIT_CARD', label: 'Debit', icon: '💳' },
  { value: 'CREDIT_CARD', label: 'Kredit', icon: '💳' },
]

interface Row {
  method: PaymentMethod
  amount: number
  qrisRef: string
}

interface Props {
  total: number
  onCancel: () => void
  onConfirm: (payments: PaymentInput[]) => void
}

const QUICK_CASH = [0, 50000, 100000, 150000, 200000]

export default function PaymentModal({ total, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>([{ method: 'CASH', amount: total, qrisRef: '' }])

  const paid = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows])
  const remaining = Math.max(0, total - paid)
  const change = Math.max(0, paid - total)
  const canConfirm = paid >= total && total > 0

  const addRow = (method: PaymentMethod) =>
    setRows((prev) => [...prev, { method, amount: remaining, qrisRef: '' }])
  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const handleConfirm = () => {
    // Alokasikan amountPaid berurutan; kelebihan menjadi kembalian (biasanya tunai).
    let rem = total
    const payments: PaymentInput[] = rows
      .filter((r) => r.amount > 0)
      .map((r) => {
        const applied = Math.min(r.amount, rem)
        rem -= applied
        return {
          method: r.method,
          amountPaid: applied,
          tenderedAmount: r.amount,
          changeAmount: r.amount - applied,
          qrisReference: r.method === 'QRIS' ? r.qrisRef || undefined : undefined,
        }
      })
    onConfirm(payments)
  }

  const labelOf = (m: PaymentMethod) => METHODS.find((x) => x.value === m)?.label ?? m

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-status-occupied px-5 py-4 text-white">
          <div>
            <p className="text-xs opacity-90">Total Tagihan</p>
            <p className="text-2xl font-extrabold">{formatRupiah(total)}</p>
          </div>
          <button onClick={onCancel} className="text-2xl leading-none hover:opacity-80">
            ×
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {/* Metode pembayaran */}
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => addRow(m.value)}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-background"
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Baris pembayaran */}
          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div key={idx} className="rounded-xl bg-background p-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-sm font-semibold text-ink">{labelOf(r.method)}</span>
                  <input
                    type="number"
                    min={0}
                    value={r.amount}
                    onChange={(e) => updateRow(idx, { amount: Number(e.target.value) })}
                    className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-right text-sm outline-none focus:border-brand-strong"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-status-occupied hover:opacity-70"
                      aria-label="Hapus"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {r.method === 'CASH' && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_CASH.map((q) => (
                      <button
                        key={q}
                        onClick={() => updateRow(idx, { amount: q === 0 ? total : q })}
                        className="rounded-md bg-white px-2 py-1 text-xs font-medium text-ink hover:bg-brand-soft"
                      >
                        {q === 0 ? 'Uang Pas' : formatRupiah(q)}
                      </button>
                    ))}
                  </div>
                )}
                {r.method === 'QRIS' && (
                  <input
                    value={r.qrisRef}
                    onChange={(e) => updateRow(idx, { qrisRef: e.target.value })}
                    placeholder="No. Referensi / RRN (opsional)"
                    className="mt-2 w-full rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Ringkasan */}
          <dl className="space-y-1 border-t border-black/5 pt-3 text-sm">
            <div className="flex justify-between text-ink-soft">
              <dt>Terbayar</dt>
              <dd>{formatRupiah(paid)}</dd>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between font-semibold text-status-occupied">
                <dt>Kurang</dt>
                <dd>{formatRupiah(remaining)}</dd>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between font-semibold text-status-empty">
                <dt>Kembalian</dt>
                <dd>{formatRupiah(change)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="border-t border-black/5 p-4">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full rounded-xl bg-status-empty py-3.5 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {remaining > 0 ? `Kurang ${formatRupiah(remaining)}` : 'Selesaikan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
