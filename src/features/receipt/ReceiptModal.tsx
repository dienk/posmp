import { formatRupiah } from '../../lib/format'
import { useSettings } from '../../lib/SettingsContext'
import type { ReceiptData, TxItem } from '../history/historyRepository'
import {
  getReceiptConfig,
  RECEIPT_WIDTH_PX,
  type ReceiptAlign,
  type ReceiptConfig,
} from './receiptConfig'

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

const ALIGN_CLASS: Record<ReceiptAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/** Cetak hanya struk lewat iframe tersembunyi (tidak mengganggu tampilan app). */
function printReceipt(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Tampilan baris item: jumlah & satuan terpilih, harga per satuan, judul baris. */
function itemDisplay(it: TxItem, c: ReceiptConfig) {
  const qty = it.unit_qty ?? it.quantity
  const label = it.unit ?? it.base_unit
  const perUnit = it.unit_qty && it.unit_qty > 0 ? Math.round(it.subtotal / it.unit_qty) : it.unit_price
  const head = c.showItemUnit && label ? `${qty} ${label} ${it.name}` : `${qty}x ${it.name}`
  const priceUnit = c.showItemUnit && label ? `${formatRupiah(perUnit)} / ${label}` : formatRupiah(perUnit)
  return { head, priceUnit }
}

export function buildReceiptHtml(d: ReceiptData, c: ReceiptConfig): string {
  const line = (l: string, r: string) =>
    `<div style="display:flex;justify-content:space-between"><span>${escapeHtml(l)}</span><span>${escapeHtml(r)}</span></div>`
  const items = d.items
    .map((it) => {
      const { head, priceUnit } = itemDisplay(it, c)
      return (
        line(head, formatRupiah(it.subtotal)) +
        `<div style="color:#666;font-size:11px">@ ${priceUnit}</div>` +
        (c.showItemNote && it.notes
          ? `<div style="color:#666;font-size:11px">✎ ${escapeHtml(it.notes)}</div>`
          : '')
      )
    })
    .join('')
  const pays = d.payments
    .map((p) => line(METHOD_LABEL[p.payment_method] ?? p.payment_method, formatRupiah(p.amount_paid)))
    .join('')
  const change = d.payments.reduce((s, p) => s + p.change_amount, 0)
  const width = RECEIPT_WIDTH_PX[c.paperWidth]
  const block = (html: string) =>
    `<div style="text-align:${c.align};white-space:pre-line">${html}</div>`
  // Logo relatif (default aplikasi) di-absolutkan agar termuat di iframe cetak.
  const logoSrc = c.logo.startsWith('/') ? location.origin + c.logo : c.logo
  const logo = c.logo
    ? `<div style="text-align:${c.align}"><img src="${logoSrc}" style="max-width:100%;max-height:96px"/></div>`
    : ''
  const header =
    block(
      `<div class="b" style="font-size:14px">${escapeHtml(d.outlet.name)}</div>` +
        (c.tagline ? `<div style="font-size:11px">${escapeHtml(c.tagline)}</div>` : '') +
        (c.showAddress && d.outlet.address ? `<div style="font-size:11px">${escapeHtml(d.outlet.address)}</div>` : '') +
        (c.showPhone && d.outlet.phone ? `<div style="font-size:11px">${escapeHtml(d.outlet.phone)}</div>` : ''),
    )
  const footer = block(
    `<div>${escapeHtml(c.footer)}</div>` +
      (c.note ? `<div style="font-size:10px;color:#666">${escapeHtml(c.note)}</div>` : ''),
  )
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.invoice_number)}</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;width:${width}px;margin:0 auto;padding:8px}
      hr{border:none;border-top:1px dashed #999;margin:6px 0}.b{font-weight:bold}
      @media print{@page{margin:6mm}}
    </style></head><body>
    ${c.logoPosition === 'top' ? logo : ''}
    ${header}
    <hr>
    ${line('No', d.invoice_number)}
    ${line('Tgl', d.transaction_date)}
    ${line('Tipe', SOURCE_LABEL[d.order_source] ?? d.order_source)}
    ${d.table_number ? line('Meja', d.table_number) : ''}
    ${c.showMember && d.member_name ? line('Member', d.member_name) : ''}
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
    ${c.showPoints && d.points_earned > 0 ? line('Poin diperoleh', String(d.points_earned)) : ''}
    <hr>
    ${footer}
    ${c.logoPosition === 'bottom' ? logo : ''}
    </body></html>`
}

/** Tampilan struk di layar (dipakai modal & preview desain). */
export function ReceiptView({ data, config }: { data: ReceiptData; config: ReceiptConfig }) {
  const change = data.payments.reduce((s, p) => s + p.change_amount, 0)
  const alignCls = ALIGN_CLASS[config.align]
  const logo = config.logo ? (
    <div className={alignCls}>
      <img src={config.logo} alt="logo" className="inline-block max-h-24 max-w-full" />
    </div>
  ) : null

  return (
    <div
      className="mx-auto font-mono text-xs text-ink"
      style={{ maxWidth: RECEIPT_WIDTH_PX[config.paperWidth] }}
    >
      {config.logoPosition === 'top' && logo}
      <div className={`${alignCls} whitespace-pre-line`}>
        <p className="text-sm font-bold">{data.outlet.name}</p>
        {config.tagline && <p className="text-[11px]">{config.tagline}</p>}
        {config.showAddress && data.outlet.address && (
          <p className="text-[11px]">{data.outlet.address}</p>
        )}
        {config.showPhone && data.outlet.phone && <p className="text-[11px]">{data.outlet.phone}</p>}
      </div>
      <Dashed />
      <Row l="No" r={data.invoice_number} />
      <Row l="Tgl" r={data.transaction_date} />
      {data.table_number && <Row l="Meja" r={data.table_number} />}
      {config.showMember && data.member_name && <Row l="Member" r={data.member_name} />}
      <Dashed />
      {data.items.map((it, i) => {
        const { head, priceUnit } = itemDisplay(it, config)
        return (
          <div key={i}>
            <Row l={head} r={formatRupiah(it.subtotal)} />
            <p className="text-[11px] text-ink-soft">@ {priceUnit}</p>
            {config.showItemNote && it.notes && (
              <p className="text-[11px] text-ink-soft">✎ {it.notes}</p>
            )}
          </div>
        )
      })}
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
      {config.showPoints && data.points_earned > 0 && (
        <Row l="Poin diperoleh" r={String(data.points_earned)} />
      )}
      <Dashed />
      <div className={`${alignCls} whitespace-pre-line`}>
        <p>{config.footer}</p>
        {config.note && <p className="text-[10px] text-ink-soft">{config.note}</p>}
      </div>
      {config.logoPosition === 'bottom' && <div className="mt-2">{logo}</div>}
    </div>
  )
}

export default function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const { settings } = useSettings()
  const config = getReceiptConfig(settings)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <p className="text-sm font-bold text-ink">Struk</p>
          <button onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ReceiptView data={data} config={config} />
        </div>
        <div className="border-t border-black/5 p-3">
          <button
            onClick={() => printReceipt(buildReceiptHtml(data, config))}
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
