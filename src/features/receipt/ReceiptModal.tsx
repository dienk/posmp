import { formatRupiah } from '../../lib/format'
import type { ReceiptData } from '../history/historyRepository'

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

interface Props {
  data: ReceiptData
  onClose: () => void
}

/** Cetak hanya struk lewat iframe tersembunyi (tidak mengganggu tampilan app). */
function printReceipt(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  window.setTimeout(() => iframe.remove(), 1000)
}

function buildHtml(d: ReceiptData): string {
  const line = (l: string, r: string) =>
    `<div style="display:flex;justify-content:space-between"><span>${l}</span><span>${r}</span></div>`
  const items = d.items
    .map(
      (it) =>
        `${line(`${it.quantity}x ${it.name}`, formatRupiah(it.subtotal))}` +
        `<div style="color:#666;font-size:11px">@ ${formatRupiah(it.unit_price)}</div>`,
    )
    .join('')
  const pays = d.payments
    .map((p) => line(METHOD_LABEL[p.payment_method] ?? p.payment_method, formatRupiah(p.amount_paid)))
    .join('')
  const change = d.payments.reduce((s, p) => s + p.change_amount, 0)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${d.invoice_number}</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;width:280px;margin:0 auto;padding:8px}
      hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .c{text-align:center}.b{font-weight:bold}
      @media print{@page{margin:6mm}}
    </style></head><body>
    <div class="c b">${d.outlet.name}</div>
    ${d.outlet.address ? `<div class="c" style="font-size:11px">${d.outlet.address}</div>` : ''}
    ${d.outlet.phone ? `<div class="c" style="font-size:11px">${d.outlet.phone}</div>` : ''}
    <hr>
    ${line('No', d.invoice_number)}
    ${line('Tgl', d.transaction_date)}
    ${line('Tipe', SOURCE_LABEL[d.order_source] ?? d.order_source)}
    ${d.table_number ? line('Meja', d.table_number) : ''}
    ${d.member_name ? line('Member', d.member_name) : ''}
    <hr>
    ${items}
    <hr>
    ${line('Subtotal', formatRupiah(d.subtotal_amount))}
    ${d.discount_amount > 0 ? line('Diskon', '-' + formatRupiah(d.discount_amount)) : ''}
    ${d.tax_amount > 0 ? line('Pajak', formatRupiah(d.tax_amount)) : ''}
    <div class="b">${line('TOTAL', formatRupiah(d.total_amount))}</div>
    <hr>
    ${pays}
    ${change > 0 ? line('Kembali', formatRupiah(change)) : ''}
    ${d.points_earned > 0 ? line('Poin diperoleh', String(d.points_earned)) : ''}
    <hr>
    <div class="c">Terima kasih 🙏</div>
    <div class="c" style="font-size:10px;color:#666">POSMerahPutih</div>
    </body></html>`
}

export default function ReceiptModal({ data, onClose }: Props) {
  const change = data.payments.reduce((s, p) => s + p.change_amount, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <p className="text-sm font-bold text-ink">Struk</p>
          <button onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 font-mono text-xs text-ink">
          <p className="text-center text-sm font-bold">{data.outlet.name}</p>
          {data.outlet.address && <p className="text-center text-[11px]">{data.outlet.address}</p>}
          {data.outlet.phone && <p className="text-center text-[11px]">{data.outlet.phone}</p>}
          <Dashed />
          <Row l="No" r={data.invoice_number} />
          <Row l="Tgl" r={data.transaction_date} />
          {data.table_number && <Row l="Meja" r={data.table_number} />}
          {data.member_name && <Row l="Member" r={data.member_name} />}
          <Dashed />
          {data.items.map((it, i) => (
            <div key={i}>
              <Row l={`${it.quantity}x ${it.name}`} r={formatRupiah(it.subtotal)} />
              <p className="text-[11px] text-ink-soft">@ {formatRupiah(it.unit_price)}</p>
            </div>
          ))}
          <Dashed />
          <Row l="Subtotal" r={formatRupiah(data.subtotal_amount)} />
          {data.discount_amount > 0 && <Row l="Diskon" r={'-' + formatRupiah(data.discount_amount)} />}
          {data.tax_amount > 0 && <Row l="Pajak" r={formatRupiah(data.tax_amount)} />}
          <div className="font-bold">
            <Row l="TOTAL" r={formatRupiah(data.total_amount)} />
          </div>
          <Dashed />
          {data.payments.map((p, i) => (
            <Row key={i} l={METHOD_LABEL[p.payment_method] ?? p.payment_method} r={formatRupiah(p.amount_paid)} />
          ))}
          {change > 0 && <Row l="Kembali" r={formatRupiah(change)} />}
          {data.points_earned > 0 && <Row l="Poin diperoleh" r={String(data.points_earned)} />}
          <Dashed />
          <p className="text-center">Terima kasih 🙏</p>
        </div>

        <div className="border-t border-black/5 p-3">
          <button
            onClick={() => printReceipt(buildHtml(data))}
            className="w-full rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
          >
            🖨️ Cetak Struk
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ l, r }: { l: string; r: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0 truncate">{l}</span>
      <span className="whitespace-nowrap">{r}</span>
    </div>
  )
}
function Dashed() {
  return <div className="my-1.5 border-t border-dashed border-ink-soft/40" />
}
