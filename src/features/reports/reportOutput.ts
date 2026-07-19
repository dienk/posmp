import { formatRupiah } from '../../lib/format'
import { computeRange, type RangePreset } from './dateRange'
import type { ReportColumn, ReportDef } from './reportDefs'

export type PaperSize = 'A4' | 'Letter' | 'Legal' | 'F4'
export type Orientation = 'portrait' | 'landscape'

export interface ReportTemplate {
  title: string
  subtitle: string
  footer: string
  paper: PaperSize
  orientation: Orientation
  hiddenCols: string[]
}

/** Dimensi kertas dalam mm [lebar, tinggi] (potret). */
export const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  F4: [210, 330],
}

export function defaultTemplate(def: ReportDef, outletName: string): ReportTemplate {
  return {
    title: def.label,
    subtitle: outletName,
    footer: '',
    paper: 'A4',
    orientation: 'portrait',
    hiddenCols: [],
  }
}

export function getReportTemplate(
  settings: Record<string, string>,
  def: ReportDef,
  outletName: string,
): ReportTemplate {
  const base = defaultTemplate(def, outletName)
  try {
    const raw = settings[`report_tpl_${def.key}`]
    if (!raw) return base
    const t = JSON.parse(raw)
    return {
      title: typeof t.title === 'string' ? t.title : base.title,
      subtitle: typeof t.subtitle === 'string' ? t.subtitle : base.subtitle,
      footer: typeof t.footer === 'string' ? t.footer : base.footer,
      paper: t.paper in PAPER_MM ? t.paper : base.paper,
      orientation: t.orientation === 'landscape' ? 'landscape' : 'portrait',
      hiddenCols: Array.isArray(t.hiddenCols) ? t.hiddenCols.filter((c: unknown) => typeof c === 'string') : [],
    }
  } catch {
    return base
  }
}

export function reportTemplateToSettings(key: string, tpl: ReportTemplate): Record<string, string> {
  return { [`report_tpl_${key}`]: JSON.stringify(tpl) }
}

export function visibleColumns(def: ReportDef, tpl: ReportTemplate): ReportColumn[] {
  return def.columns.filter((c) => !tpl.hiddenCols.includes(c.key))
}

/** Nilai untuk tampilan/cetak (uang diformat Rupiah). */
export function displayCell(v: unknown, type?: string): string {
  if (v == null || v === '') return '—'
  if (type === 'money') return formatRupiah(Number(v) || 0)
  return String(v)
}

type Row = Record<string, unknown>

// ── Filter ───────────────────────────────────────────────────────────────────
export interface ReportFilter {
  preset: RangePreset | 'all'
  from: string // 'YYYY-MM-DD' (kustom)
  to: string
  keyword: string
}

export const DEFAULT_FILTER: ReportFilter = { preset: 'all', from: '', to: '', keyword: '' }

/** Terapkan filter (rentang tanggal + kata kunci) pada baris laporan. */
export function applyReportFilter(def: ReportDef, rows: Row[], filter: ReportFilter): Row[] {
  let out = rows
  if (def.dateField && filter.preset !== 'all') {
    const range =
      filter.preset === 'custom'
        ? { from: filter.from, to: filter.to }
        : computeRange(filter.preset)
    if (range.from && range.to) {
      out = out.filter((r) => {
        const v = r[def.dateField as string]
        if (v == null) return false
        const d = String(v).slice(0, 10)
        return d >= range.from && d <= range.to
      })
    }
  }
  const k = filter.keyword.trim().toLowerCase()
  if (k) {
    out = out.filter((r) =>
      def.columns.some((c) => displayCell(r[c.key], c.type).toLowerCase().includes(k)),
    )
  }
  return out
}

/** true bila filter mengubah hasil (untuk indikator "aktif"). */
export function isFilterActive(filter: ReportFilter): boolean {
  return filter.preset !== 'all' || filter.keyword.trim().length > 0
}

// ── CSV ───────────────────────────────────────────────────────────────────
export function toCSV(def: ReportDef, rows: Row[], tpl: ReportTemplate): string {
  const cols = visibleColumns(def, tpl)
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.map((c) => esc(c.label)).join(',')
  const lines = rows.map((r) => cols.map((c) => esc(r[c.key] ?? '')).join(','))
  return [header, ...lines].join('\n')
}

// ── JSON ──────────────────────────────────────────────────────────────────
export function toJSON(def: ReportDef, rows: Row[], tpl: ReportTemplate): string {
  const cols = visibleColumns(def, tpl)
  const out = rows.map((r) => Object.fromEntries(cols.map((c) => [c.label, r[c.key] ?? null])))
  return JSON.stringify(out, null, 2)
}

// ── HTML (cetak / PDF) ──────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildReportHtml(def: ReportDef, rows: Row[], tpl: ReportTemplate): string {
  const cols = visibleColumns(def, tpl)
  const [w, h] = PAPER_MM[tpl.paper]
  const size = tpl.orientation === 'landscape' ? `${h}mm ${w}mm` : `${w}mm ${h}mm`
  const align = (t?: string) => (t === 'money' || t === 'number' ? 'right' : 'left')
  const head = cols.map((c) => `<th style="text-align:${align(c.type)}">${esc(c.label)}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        '<tr>' +
        cols
          .map(
            (c) =>
              `<td style="text-align:${align(c.type)}">${esc(displayCell(r[c.key], c.type))}</td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('')
  const stamp = new Date().toLocaleString('id-ID')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tpl.title)}</title>
    <style>
      @page { size: ${size}; margin: 12mm }
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11px;margin:0}
      h1{font-size:16px;margin:0 0 2px} .sub{color:#555;font-size:11px}
      .meta{color:#888;font-size:10px;margin:2px 0 10px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:4px 6px}
      thead th{background:#f2f2f2;font-weight:700}
      tbody tr:nth-child(even){background:#fafafa}
      .foot{margin-top:12px;color:#555;font-size:10px;white-space:pre-line}
      @media print{ thead{display:table-header-group} }
    </style></head><body>
    <h1>${esc(tpl.title)}</h1>
    ${tpl.subtitle ? `<div class="sub">${esc(tpl.subtitle)}</div>` : ''}
    <div class="meta">${rows.length} baris · dicetak ${esc(stamp)}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${tpl.footer ? `<div class="foot">${esc(tpl.footer)}</div>` : ''}
    </body></html>`
}

// ── Unduh & cetak ───────────────────────────────────────────────────────────
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + content : content], {
    type: mime + ';charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function printReportHtml(html: string): void {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  window.setTimeout(() => w.print(), 300)
}
