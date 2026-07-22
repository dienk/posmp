import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { getNumberSetting, isTransferApprovalRequired } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { getActivePersona } from '../access/accessRepository'
import { createApproval } from '../approvals/approvalsRepository'
import { listWarehouses, type Warehouse } from '../warehouses/warehousesRepository'
import {
  applyStockTransfer,
  listStockTransfers,
  listTransferProducts,
  stockTransferDetail,
  type StockTransferDetail,
  type StockTransferSummary,
  type TransferProduct,
} from './stockTransferRepository'

const inputCls =
  'w-full rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

interface Line {
  productId: number
  quantity: number
}
type Tab = 'transfer' | 'riwayat'

export default function StockTransferPage() {
  const { settings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const needApproval = isTransferApprovalRequired(settings)
  const requester = useMemo(() => getActivePersona(settings)?.name ?? 'Admin', [settings])

  const [tab, setTab] = useState<Tab>('transfer')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fromWh, setFromWh] = useState<number>(0)
  const [toWh, setToWh] = useState<number>(0)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [products, setProducts] = useState<TransferProduct[]>([])
  const [entries, setEntries] = useState<StockTransferSummary[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<StockTransferDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const ws = listWarehouses(outletId)
    setWarehouses(ws)
    setFromWh((p) => (ws.some((w) => w.id === p) ? p : ws[0]?.id ?? 0))
    setToWh((p) => (ws.some((w) => w.id === p) ? p : ws[1]?.id ?? ws[0]?.id ?? 0))
  }, [outletId])

  const reloadEntries = () => setEntries(listStockTransfers(outletId))
  useEffect(reloadEntries, [outletId])
  useEffect(() => {
    if (fromWh) setProducts(listTransferProducts(outletId, fromWh))
  }, [outletId, fromWh])
  useEffect(() => {
    setDetail(selected ? stockTransferDetail(selected) : null)
  }, [selected, entries])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const stockOf = (pid: number) => products.find((p) => p.id === pid)?.stock ?? 0
  const availableProducts = useMemo(
    () => products.filter((p) => !lines.some((l) => l.productId === p.id)),
    [products, lines],
  )
  const addLine = () => {
    const first = availableProducts[0]
    if (!first) return
    setLines((prev) => [...prev, { productId: first.id, quantity: 1 }])
  }
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx))
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0)

  const resetForm = () => {
    setLines([])
    setNote('')
  }

  const warehouseName = (id: number) => warehouses.find((w) => w.id === id)?.name ?? '—'

  const handleSubmit = async () => {
    if (fromWh === toWh) return showToast('Gudang asal & tujuan tidak boleh sama.')
    const valid = lines.filter((l) => l.quantity > 0)
    if (valid.length === 0) return showToast('Tambahkan minimal satu item.')
    const overStock = valid.find((l) => l.quantity > stockOf(l.productId))
    if (overStock)
      return showToast('Qty melebihi stok gudang asal untuk sebagian item.')

    setBusy(true)
    try {
      if (needApproval) {
        await createApproval({
          outletId,
          type: 'STOCK_TRANSFER',
          title: `Transfer ${warehouseName(fromWh)} → ${warehouseName(toWh)}`,
          summary: `${valid.length} item · ${totalQty} pcs`,
          payload: {
            outletId,
            fromWarehouseId: fromWh,
            toWarehouseId: toWh,
            fromWarehouseName: warehouseName(fromWh),
            toWarehouseName: warehouseName(toWh),
            lines: valid,
            note,
          },
          requestedBy: requester,
        })
        showToast('Transfer diajukan untuk persetujuan.')
      } else {
        const res = await applyStockTransfer(outletId, fromWh, toWh, valid, note)
        showToast(`Transfer tercatat · ${res.reference}`)
      }
      resetForm()
      reloadEntries()
      setProducts(listTransferProducts(outletId, fromWh))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan transfer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Transfer Stok</h1>
        {needApproval && (
          <span className="rounded-full bg-status-waiting/20 px-2.5 py-0.5 text-xs font-semibold text-status-waiting">
            Perlu persetujuan
          </span>
        )}
        <nav className="ml-auto flex gap-1 rounded-xl bg-background p-1">
          {(
            [
              ['transfer', 'Transfer'],
              ['riwayat', 'Riwayat'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition ' +
                (tab === key ? 'bg-panel text-ink shadow-sm' : 'text-ink-soft hover:text-ink')
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'transfer' && (
          <section className="mx-auto max-w-3xl rounded-card bg-panel p-5 shadow-card">
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Gudang Asal</span>
                <select className={inputCls} value={fromWh} onChange={(e) => setFromWh(Number(e.target.value))}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Gudang Tujuan</span>
                <select className={inputCls} value={toWh} onChange={(e) => setToWh(Number(e.target.value))}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan</span>
                <input
                  className="field-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="mis. penyeimbangan stok"
                />
              </label>
            </div>

            {fromWh === toWh && (
              <p className="mb-2 rounded-lg bg-status-occupied/10 px-3 py-2 text-xs font-semibold text-status-occupied">
                Gudang asal & tujuan sama — pilih gudang berbeda.
              </p>
            )}

            <div className="space-y-2">
              {lines.map((l, idx) => {
                const opts = products.filter(
                  (p) => p.id === l.productId || !lines.some((x) => x.productId === p.id),
                )
                const avail = stockOf(l.productId)
                const over = l.quantity > avail
                return (
                  <div key={idx} className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="mb-1 block text-[11px] text-ink-soft">Produk</span>
                      <select
                        className={inputCls}
                        value={l.productId}
                        onChange={(e) => updateLine(idx, { productId: Number(e.target.value) })}
                      >
                        {opts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (stok {p.stock})</option>
                        ))}
                      </select>
                    </label>
                    <label className="block w-24">
                      <span className="mb-1 block text-[11px] text-ink-soft">Qty</span>
                      <input
                        type="number"
                        min={1}
                        max={avail}
                        className={inputCls + (over ? ' border-status-occupied' : '')}
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                      />
                    </label>
                    <div className="w-24 pb-2 text-right">
                      <span className="block text-[11px] text-ink-soft">Stok asal</span>
                      <span className={'text-sm font-semibold ' + (over ? 'text-status-occupied' : 'text-ink')}>
                        {avail}
                      </span>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="mb-2 px-2 text-status-occupied hover:opacity-70"
                      aria-label="Hapus baris"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            <Button size="sm" onClick={addLine} disabled={availableProducts.length === 0} className="mt-3">
              + Tambah Item
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/5 pt-3">
              <span className="text-sm text-ink-soft">
                {lines.length} item · {totalQty} pcs
              </span>
              <Button onClick={handleSubmit} disabled={busy || lines.length === 0}>
                {needApproval ? 'Ajukan Transfer' : 'Simpan Transfer'}
              </Button>
            </div>
          </section>
        )}

        {tab === 'riwayat' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-card bg-panel shadow-card">
              {entries.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-ink-soft">Belum ada transfer.</p>
              ) : (
                <ul className="divide-y divide-line/5">
                  {entries.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelected(e.id)}
                        className={
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition ' +
                          (selected === e.id ? 'bg-brand-soft' : 'hover:bg-background')
                        }
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg">🔁</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{e.reference_number}</p>
                          <p className="truncate text-xs text-ink-soft">
                            {e.from_warehouse_name ?? '—'} → {e.to_warehouse_name ?? '—'} · {e.total_qty} pcs · {e.transfer_date}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              {detail ? (
                <div className="rounded-card bg-panel p-5 shadow-card">
                  <h2 className="text-base font-bold text-ink">{detail.reference_number}</h2>
                  <p className="mb-3 text-xs text-ink-soft">
                    {detail.from_warehouse_name ?? '—'} → {detail.to_warehouse_name ?? '—'} · {detail.transfer_date}
                  </p>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-line/5 text-left text-[11px] uppercase text-ink-soft">
                        <th className="py-1">Produk</th>
                        <th className="py-1 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i} className="border-b border-line/5">
                          <td className="py-1.5 text-ink">{l.product_name}</td>
                          <td className="py-1.5 text-right text-ink-soft">{l.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between border-t border-line/5 pt-2 text-sm font-bold text-ink">
                    <span>Total</span>
                    <span>{detail.total_qty} pcs</span>
                  </div>
                  {detail.note && (
                    <div className="mt-3 rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Catatan</p>
                      <p className="text-sm text-ink">{detail.note}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-card bg-panel p-5 text-center text-sm text-ink-soft shadow-card">
                  Pilih transfer untuk melihat detail.
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">{toast}</div>
      )}
    </div>
  )
}
