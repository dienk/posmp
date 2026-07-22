import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { formatRupiah } from '../../lib/format'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { publish } from '../../lib/realtime'
import { useRealtime } from '../../lib/useRealtime'
import ReceiptModal from '../receipt/ReceiptModal'
import {
  getReceipt,
  listTransactions,
  processRefund,
  transactionItems,
  transactionPayments,
  type ReceiptData,
  type TxItem,
  type TxPayment,
  type TxSummary,
} from './historyRepository'

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  DEBIT_CARD: 'Debit',
  CREDIT_CARD: 'Kredit',
  VOUCHER: 'Voucher',
}

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
  const [payments, setPayments] = useState<TxPayment[]>([])
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Filter daftar: pencarian invoice/member + rentang tanggal.
  const [keyword, setKeyword] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const reload = useCallback(() => setTxs(listTransactions(outletId)), [outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  useEffect(() => {
    setItems(selectedId ? transactionItems(selectedId) : [])
    setPayments(selectedId ? transactionPayments(selectedId) : [])
    setReason('')
  }, [selectedId])

  const selected = useMemo(() => txs.find((t) => t.id === selectedId) ?? null, [txs, selectedId])

  // Terapkan filter tanggal (YYYY-MM-DD) & kata kunci (invoice/member/sumber).
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return txs.filter((t) => {
      const day = (t.transaction_date ?? '').slice(0, 10)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      if (
        k &&
        !(
          t.invoice_number.toLowerCase().includes(k) ||
          (t.member_name ?? '').toLowerCase().includes(k) ||
          (SOURCE_LABEL[t.order_source] ?? t.order_source).toLowerCase().includes(k)
        )
      )
        return false
      return true
    })
  }, [txs, keyword, dateFrom, dateTo])
  const filterOn = !!(keyword || dateFrom || dateTo)

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
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Riwayat Transaksi & Refund</h1>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="🔍 Cari invoice / member…"
          className="field-input w-56"
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          Dari
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="field-input w-40 py-1.5"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          s/d
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="field-input w-40 py-1.5"
          />
        </label>
        {filterOn && (
          <button
            onClick={() => {
              setKeyword('')
              setDateFrom('')
              setDateTo('')
            }}
            className="text-xs font-semibold text-status-occupied hover:underline"
          >
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-ink-soft">
          {filterOn ? `${filtered.length} dari ${txs.length}` : `${txs.length}`} transaksi
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
        {/* Daftar transaksi */}
        <section className="rounded-card bg-panel p-2 shadow-card">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              {txs.length === 0 ? 'Belum ada transaksi.' : 'Tidak ada transaksi yang cocok.'}
            </p>
          ) : (
            <ul className="divide-y divide-line/5">
              {filtered.map((t) => (
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
            <div className="rounded-card bg-panel p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">{selected.invoice_number}</h2>
              <p className="mb-3 text-xs text-ink-soft">{selected.transaction_date}</p>

              <ul className="mb-3 divide-y divide-line/5">
                {items.map((it) => (
                  <li key={it.product_id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-ink-soft">{formatRupiah(it.subtotal)}</span>
                    </div>
                    {it.notes && (
                      <p className="mt-0.5 text-xs italic text-ink-soft">✎ {it.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-line/5 pt-2 text-sm font-bold text-ink">
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

              {payments.length > 0 && (
                <div className="mt-3 rounded-lg bg-background p-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                    Pembayaran
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {payments.map((p, i) => (
                      <li key={i} className="flex justify-between text-ink">
                        <span>
                          {METHOD_LABEL[p.payment_method] ?? p.payment_method}
                          {p.qris_reference_number ? ` · ${p.qris_reference_number}` : ''}
                        </span>
                        <span>{formatRupiah(p.amount_paid)}</span>
                      </li>
                    ))}
                    {payments.some((p) => p.change_amount > 0) && (
                      <li className="flex justify-between text-status-empty">
                        <span>Kembalian</span>
                        <span>
                          {formatRupiah(payments.reduce((s, p) => s + p.change_amount, 0))}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={() => {
                  const r = getReceipt(selected.id)
                  if (r) setReceipt(r)
                }}
                className="mt-3 w-full rounded-xl border border-line/10 py-2.5 text-sm font-semibold text-ink hover:bg-background"
              >
                🧾 Lihat Struk
              </button>

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
                    className="field-input mb-2"
                  />
                  <Button
                    variant="danger-outline"
                    onClick={handleRefund}
                    disabled={busy}
                    className="w-full"
                  >
                    {busy ? 'Memproses…' : `Refund ${formatRupiah(selected.total_amount)}`}
                  </Button>
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
            <div className="flex h-40 items-center justify-center rounded-card bg-panel text-sm text-ink-soft shadow-card">
              Pilih transaksi untuk melihat detail.
            </div>
          )}
        </section>
      </div>

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">
          {toast}
        </div>
      )}
    </div>
  )
}
