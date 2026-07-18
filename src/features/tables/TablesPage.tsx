import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import type { DiningTable, TableStatus } from '../../types'
import {
  addTable,
  fetchTables,
  removeTable,
  updateTablePosition,
  updateTableStatus,
} from './tablesRepository'

const CELL = 130 // ukuran sel grid dalam px
const STATUS_STYLE: Record<TableStatus, { bg: string; label: string }> = {
  EMPTY: { bg: 'bg-status-empty', label: 'Kosong' },
  OCCUPIED: { bg: 'bg-status-occupied', label: 'Terisi' },
  WAITING_BILL: { bg: 'bg-status-waiting', label: 'Menunggu Tagihan' },
}

export default function TablesPage() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const outletId = getNumberSetting(settings, 'active_outlet_id', 1)

  const [tables, setTables] = useState<DiningTable[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)

  const reload = () => setTables(fetchTables(outletId))
  useEffect(reload, [outletId])

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId],
  )
  const counts = useMemo(() => {
    const c = { EMPTY: 0, OCCUPIED: 0, WAITING_BILL: 0 }
    for (const t of tables) c[t.status]++
    return c
  }, [tables])

  const onPointerDown = (e: React.PointerEvent, table: DiningTable) => {
    setSelectedId(table.id)
    if (!editMode) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = {
      id: table.id,
      offsetX: e.clientX - rect.left - table.grid_x * CELL,
      offsetY: e.clientY - rect.top - table.grid_y * CELL,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const x = Math.max(0, e.clientX - rect.left - drag.offsetX)
    const y = Math.max(0, e.clientY - rect.top - drag.offsetY)
    setTables((prev) =>
      prev.map((t) =>
        t.id === drag.id ? { ...t, grid_x: x / CELL, grid_y: y / CELL } : t,
      ),
    )
  }

  const onPointerUp = async () => {
    const drag = dragState.current
    dragState.current = null
    if (!drag) return
    const t = tables.find((tb) => tb.id === drag.id)
    if (!t) return
    const gx = Math.round(t.grid_x)
    const gy = Math.round(t.grid_y)
    await updateTablePosition(drag.id, gx, gy)
    setTables((prev) => prev.map((tb) => (tb.id === drag.id ? { ...tb, grid_x: gx, grid_y: gy } : tb)))
  }

  const handleSetStatus = async (status: TableStatus) => {
    if (!selected) return
    await updateTableStatus(selected.id, status)
    reload()
  }

  const handleAddTable = async () => {
    const nextNum = tables.length + 1
    await addTable(outletId, `T-${String(nextNum).padStart(2, '0')}`, 4, 'INDOOR', 0, 0)
    reload()
  }

  const handleRemove = async () => {
    if (!selected) return
    await removeTable(selected.id)
    setSelectedId(null)
    reload()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-white/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Tata Letak Meja</h1>
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <Legend color="bg-status-empty" label={`Kosong · ${counts.EMPTY}`} />
          <Legend color="bg-status-occupied" label={`Terisi · ${counts.OCCUPIED}`} />
          <Legend color="bg-status-waiting" label={`Tagihan · ${counts.WAITING_BILL}`} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setEditMode((v) => !v)}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition ' +
              (editMode ? 'bg-status-occupied text-white' : 'bg-white text-ink hover:bg-brand-soft')
            }
          >
            {editMode ? 'Selesai Atur' : '✎ Atur Layout'}
          </button>
          {editMode && (
            <button
              onClick={handleAddTable}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-strong"
            >
              + Tambah Meja
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative min-h-0 flex-1 overflow-auto p-6"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(113,120,136,0.18) 1px, transparent 1px)',
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        >
          {tables.map((t) => {
            const style = STATUS_STYLE[t.status]
            return (
              <button
                key={t.id}
                onPointerDown={(e) => onPointerDown(e, t)}
                style={{
                  left: t.grid_x * CELL + 8,
                  top: t.grid_y * CELL + 8,
                  touchAction: 'none',
                }}
                className={
                  `absolute flex h-24 w-24 flex-col items-center justify-center rounded-2xl text-white shadow-card transition ${style.bg} ` +
                  (selectedId === t.id ? 'ring-4 ring-brand-strong' : '') +
                  (editMode ? ' cursor-move' : ' cursor-pointer')
                }
              >
                <span className="text-lg font-bold">{t.table_number}</span>
                <span className="text-[10px] opacity-90">👤 {t.capacity}</span>
                <span className="text-[10px] opacity-90">{style.label}</span>
              </button>
            )
          })}
          {tables.length === 0 && (
            <p className="mt-10 text-center text-sm text-ink-soft">
              Belum ada meja. Aktifkan “Atur Layout” lalu tambah meja.
            </p>
          )}
        </div>

        {/* Panel detail */}
        {selected && (
          <aside className="w-72 shrink-0 border-l border-black/5 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">Meja {selected.table_number}</h2>
              <button onClick={() => setSelectedId(null)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {selected.section_name} · Kapasitas {selected.capacity} orang
            </p>
            <div className="mt-3">
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold text-white ${STATUS_STYLE[selected.status].bg}`}
              >
                {STATUS_STYLE[selected.status].label}
              </span>
            </div>

            {!editMode ? (
              <div className="mt-5 grid gap-2">
                <button
                  onClick={() =>
                    navigate('/', { state: { tableNumber: selected.table_number } })
                  }
                  className="rounded-xl bg-status-occupied py-2.5 text-sm font-semibold text-white hover:brightness-95"
                >
                  {selected.status === 'EMPTY' ? 'Buka Pesanan' : 'Tambah Pesanan'}
                </button>
                <button
                  onClick={() => handleSetStatus('WAITING_BILL')}
                  className="rounded-xl bg-status-waiting py-2.5 text-sm font-semibold text-white hover:brightness-95"
                >
                  Minta Tagihan
                </button>
                <button
                  onClick={() => handleSetStatus('EMPTY')}
                  className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold text-ink hover:bg-background"
                >
                  Kosongkan Meja
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-2">
                <p className="text-xs text-ink-soft">Seret meja di canvas untuk mengatur posisi.</p>
                <button
                  onClick={handleRemove}
                  className="rounded-xl border border-status-occupied py-2.5 text-sm font-semibold text-status-occupied hover:bg-status-occupied/10"
                >
                  Hapus Meja
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  )
}
