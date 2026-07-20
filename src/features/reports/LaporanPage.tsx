import { useCallback, useEffect, useMemo, useState } from 'react'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import { getOutlet, updateAppSettings } from '../settings/settingsRepository'
import { RANGE_PRESETS } from './dateRange'
import { getReport, REPORT_GROUPS, REPORTS } from './reportDefs'
import {
  applyReportFilter,
  buildReportHtml,
  DEFAULT_FILTER,
  displayCell,
  downloadText,
  getReportTemplate,
  isFilterActive,
  PAPER_MM,
  printReportHtml,
  reportTemplateToSettings,
  toCSV,
  toJSON,
  visibleColumns,
  type Orientation,
  type PaperSize,
  type ReportFilter,
  type ReportTemplate,
} from './reportOutput'

type Row = Record<string, unknown>

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

export default function LaporanPage() {
  const { settings, reloadSettings } = useSettings()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)
  const outletName = useMemo(() => getOutlet(outletId)?.name ?? 'POSMerahPutih', [outletId])

  const [selectedKey, setSelectedKey] = useState<string>(REPORTS[0].key)
  const [rows, setRows] = useState<Row[]>([])
  const [tpl, setTpl] = useState<ReportTemplate>(() =>
    getReportTemplate(settings, REPORTS[0], outletName),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER)
  const [showFilter, setShowFilter] = useState(false)

  const def = getReport(selectedKey) ?? REPORTS[0]
  const filteredRows = useMemo(() => applyReportFilter(def, rows, filter), [def, rows, filter])
  const filterOn = isFilterActive(filter)

  const reload = useCallback(() => {
    const d = getReport(selectedKey)
    if (d) {
      try {
        setRows(d.fetch(outletId))
      } catch {
        setRows([])
      }
    }
  }, [selectedKey, outletId])
  useEffect(reload, [reload])
  useRealtime('order:update', reload)

  // Muat template & reset filter saat ganti laporan.
  useEffect(() => {
    setTpl(getReportTemplate(settings, def, outletName))
    setFilter(DEFAULT_FILTER)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const setT = <K extends keyof ReportTemplate>(k: K, v: ReportTemplate[K]) =>
    setTpl((p) => ({ ...p, [k]: v }))

  const toggleCol = (key: string) =>
    setTpl((p) => ({
      ...p,
      hiddenCols: p.hiddenCols.includes(key)
        ? p.hiddenCols.filter((c) => c !== key)
        : [...p.hiddenCols, key],
    }))

  const saveTemplate = async () => {
    try {
      await updateAppSettings(reportTemplateToSettings(def.key, tpl))
      reloadSettings()
      showToast('Template laporan tersimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan template')
    }
  }

  const cols = visibleColumns(def, tpl)
  const fileBase = `laporan-${def.key}`

  return (
    <div className="flex h-full">
      {/* Sub-menu daftar laporan */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-black/5 bg-panel/70 p-3">
        <h1 className="mb-2 px-2 text-lg font-bold text-ink">Laporan</h1>
        {REPORT_GROUPS.map((g) => (
          <div key={g} className="mb-3">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              {g}
            </p>
            {REPORTS.filter((r) => r.group === g).map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedKey(r.key)}
                className={
                  'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition ' +
                  (r.key === selectedKey
                    ? 'bg-brand text-ink shadow'
                    : 'text-ink-soft hover:bg-brand-soft')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Isi laporan */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 bg-panel/70 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-ink">{tpl.title}</h2>
            <p className="text-xs text-ink-soft">
              {def.desc} ·{' '}
              {filterOn ? `${filteredRows.length} dari ${rows.length} baris` : `${rows.length} baris`}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilter(true)}
              className={
                'rounded-lg px-3 py-2 text-sm font-semibold transition ' +
                (filterOn
                  ? 'bg-status-occupied text-white'
                  : 'border border-black/10 text-ink hover:bg-background')
              }
            >
              🔎 Filter{filterOn ? ' •' : ''}
            </button>
            <button
              onClick={() => setShowTemplate((v) => !v)}
              className={
                'rounded-lg px-3 py-2 text-sm font-semibold transition ' +
                (showTemplate
                  ? 'bg-brand text-ink'
                  : 'border border-black/10 text-ink hover:bg-background')
              }
            >
              ✎ Template
            </button>
            <button
              onClick={() => downloadText(`${fileBase}.csv`, toCSV(def, filteredRows, tpl), 'text/csv')}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
            >
              ⬇ CSV
            </button>
            <button
              onClick={() =>
                downloadText(`${fileBase}.json`, toJSON(def, filteredRows, tpl), 'application/json')
              }
              className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
            >
              ⬇ JSON
            </button>
            <button
              onClick={() => printReportHtml(buildReportHtml(def, filteredRows, tpl))}
              className="rounded-lg bg-status-occupied px-3 py-2 text-sm font-bold text-white hover:brightness-95"
            >
              🖨️ Cetak / PDF
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Editor template */}
          {showTemplate && (
            <section className="rounded-card bg-panel p-5 shadow-card">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Template Laporan
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Judul</span>
                  <input
                    className={inputCls}
                    value={tpl.title}
                    onChange={(e) => setT('title', e.target.value)}
                  />
                </label>
                <label className="block lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Sub-judul</span>
                  <input
                    className={inputCls}
                    value={tpl.subtitle}
                    onChange={(e) => setT('subtitle', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Ukuran Kertas</span>
                  <select
                    className={inputCls}
                    value={tpl.paper}
                    onChange={(e) => setT('paper', e.target.value as PaperSize)}
                  >
                    {(Object.keys(PAPER_MM) as PaperSize[]).map((p) => (
                      <option key={p} value={p}>
                        {p} ({PAPER_MM[p][0]}×{PAPER_MM[p][1]}mm)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Orientasi</span>
                  <select
                    className={inputCls}
                    value={tpl.orientation}
                    onChange={(e) => setT('orientation', e.target.value as Orientation)}
                  >
                    <option value="portrait">Potret</option>
                    <option value="landscape">Lanskap</option>
                  </select>
                </label>
                <label className="block lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Catatan Kaki</span>
                  <input
                    className={inputCls}
                    value={tpl.footer}
                    onChange={(e) => setT('footer', e.target.value)}
                  />
                </label>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-ink-soft">Kolom yang ditampilkan</p>
                <div className="flex flex-wrap gap-2">
                  {def.columns.map((c) => {
                    const on = !tpl.hiddenCols.includes(c.key)
                    return (
                      <button
                        key={c.key}
                        onClick={() => toggleCol(c.key)}
                        className={
                          'rounded-full px-3 py-1 text-xs font-semibold transition ' +
                          (on
                            ? 'bg-brand text-ink'
                            : 'border border-black/10 text-ink-soft line-through hover:bg-background')
                        }
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={saveTemplate}
                className="mt-4 rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Simpan Template
              </button>
            </section>
          )}

          {/* Pratinjau data */}
          <section className="overflow-hidden rounded-card bg-panel shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left text-xs uppercase text-ink-soft">
                    {cols.map((c) => (
                      <th
                        key={c.key}
                        className={
                          'px-4 py-3 ' +
                          (c.type === 'money' || c.type === 'number' ? 'text-right' : '')
                        }
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="border-b border-black/5 hover:bg-background">
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={
                            'px-4 py-2.5 ' +
                            (c.type === 'money' || c.type === 'number'
                              ? 'text-right font-medium text-ink'
                              : 'text-ink-soft')
                          }
                        >
                          {displayCell(r[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={cols.length}
                        className="px-4 py-10 text-center text-sm text-ink-soft"
                      >
                        {filterOn
                          ? 'Tidak ada baris yang cocok dengan filter.'
                          : 'Belum ada data untuk laporan ini.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Dialog filter */}
      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setShowFilter(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-panel p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-ink">Filter Laporan · {def.label}</p>
              <button
                onClick={() => setShowFilter(false)}
                className="text-xl leading-none text-ink-soft hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {def.dateField ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-soft">Periode</span>
                    <select
                      className={inputCls}
                      value={filter.preset}
                      onChange={(e) =>
                        setFilter((f) => ({ ...f, preset: e.target.value as ReportFilter['preset'] }))
                      }
                    >
                      <option value="all">Semua Waktu</option>
                      {RANGE_PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {filter.preset === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={filter.from}
                        max={filter.to || undefined}
                        onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
                        className={inputCls}
                      />
                      <span className="text-xs text-ink-soft">s/d</span>
                      <input
                        type="date"
                        value={filter.to}
                        min={filter.from || undefined}
                        onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-lg bg-background px-3 py-2 text-xs text-ink-soft">
                  Laporan ini tak punya kolom tanggal — gunakan pencarian kata kunci.
                </p>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Kata Kunci</span>
                <input
                  value={filter.keyword}
                  onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
                  placeholder="cari di semua kolom…"
                  className={inputCls}
                />
              </label>

              <p className="text-xs text-ink-soft">
                Menampilkan <b className="text-ink">{filteredRows.length}</b> dari {rows.length} baris.
                Filter juga diterapkan pada unduhan & cetak.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setFilter(DEFAULT_FILTER)}
                className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold text-ink hover:bg-background"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilter(false)}
                className="rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
