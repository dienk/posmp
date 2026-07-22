import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { useSettings } from '../../lib/SettingsContext'
import { enabledPaymentMethods } from '../settings/paymentMethods'
import type { PaymentInput } from './posRepository'

export interface TenderVoucherCheck {
  ok: boolean
  message: string
  voucherId?: number
  value?: number
}

interface Row {
  method: string
  amount: number
  qrisRef: string
  voucherCode?: string
  voucherId?: number
  voucherMsg?: { ok: boolean; text: string }
}

interface Props {
  total: number
  onCancel: () => void
  onConfirm: (payments: PaymentInput[]) => void
  /** Validasi voucher gift card sebagai alat bayar. */
  onCheckVoucher?: (code: string) => TenderVoucherCheck
}

const QUICK_CASH = [0, 50000, 100000, 150000, 200000]

export default function PaymentModal({ total, onCancel, onConfirm, onCheckVoucher }: Props) {
  const { settings } = useSettings()
  const methods = useMemo(() => enabledPaymentMethods(settings), [settings])
  const firstMethod = methods[0]?.key ?? 'CASH'
  const [rows, setRows] = useState<Row[]>([{ method: firstMethod, amount: total, qrisRef: '' }])

  const paid = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows])
  const remaining = Math.max(0, total - paid)
  const change = Math.max(0, paid - total)
  const canConfirm = paid >= total && total > 0

  const addRow = (method: string) =>
    setRows((prev) => [...prev, { method, amount: method === 'VOUCHER' ? 0 : remaining, qrisRef: '' }])
  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const checkVoucher = (idx: number, code: string) => {
    if (!onCheckVoucher) return
    const res = onCheckVoucher(code)
    if (res.ok && res.value) {
      // Sisa tagihan di luar baris voucher ini.
      const otherPaid = rows.reduce((s, r, i) => (i === idx ? s : s + (r.amount || 0)), 0)
      const applied = Math.min(res.value, Math.max(0, total - otherPaid))
      updateRow(idx, {
        amount: applied,
        voucherId: res.voucherId,
        voucherMsg: { ok: true, text: `${res.message} (saldo ${res.value.toLocaleString('id-ID')})` },
      })
    } else {
      updateRow(idx, { amount: 0, voucherId: undefined, voucherMsg: { ok: false, text: res.message } })
    }
  }

  const handleConfirm = () => {
    // Validasi: uang diterima tidak boleh kurang dari total tagihan.
    if (paid < total || total <= 0) return
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
          voucherId: r.method === 'VOUCHER' ? r.voucherId : undefined,
        }
      })
    onConfirm(payments)
  }

  const labelOf = (m: string) => methods.find((x) => x.key === m)?.label ?? m

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-panel shadow-2xl">
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
            {methods.map((m) => (
              <button
                key={m.key}
                onClick={() => addRow(m.key)}
                className="rounded-lg border border-line/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-background"
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
                    className="min-w-0 flex-1 rounded-lg border border-line/10 px-3 py-2 text-right text-sm outline-none focus:border-brand-strong"
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
                        className="rounded-md bg-panel px-2 py-1 text-xs font-medium text-ink hover:bg-brand-soft"
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
                    className="mt-2 w-full rounded-lg border border-line/10 px-3 py-1.5 text-sm outline-none focus:border-brand-strong"
                  />
                )}
                {r.method === 'VOUCHER' && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        value={r.voucherCode ?? ''}
                        onChange={(e) => updateRow(idx, { voucherCode: e.target.value })}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && checkVoucher(idx, r.voucherCode ?? '')
                        }
                        placeholder="Kode gift card"
                        className="min-w-0 flex-1 rounded-lg border border-line/10 px-3 py-1.5 text-sm uppercase outline-none focus:border-brand-strong"
                      />
                      <button
                        onClick={() => checkVoucher(idx, r.voucherCode ?? '')}
                        disabled={!r.voucherCode?.trim()}
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
                      >
                        Cek
                      </button>
                    </div>
                    {r.voucherMsg && (
                      <p
                        className={
                          'mt-1 text-xs ' +
                          (r.voucherMsg.ok ? 'text-status-empty' : 'text-status-occupied')
                        }
                      >
                        {r.voucherMsg.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ringkasan */}
          <dl className="space-y-1 border-t border-line/5 pt-3 text-sm">
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

        <div className="border-t border-line/5 p-4">
          {remaining > 0 && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-status-occupied/10 px-3 py-2
                          text-xs font-semibold text-status-occupied">
              <span aria-hidden>⚠️</span>
              <span>
                Uang diterima kurang {formatRupiah(remaining)} dari total tagihan. Lengkapi nominal
                atau tambah metode pembayaran.
              </span>
            </p>
          )}
          <Button onClick={handleConfirm} disabled={!canConfirm} className="w-full">
            {remaining > 0 ? `Kurang ${formatRupiah(remaining)}` : 'Selesaikan Pembayaran'}
          </Button>
        </div>
      </div>
    </div>
  )
}
