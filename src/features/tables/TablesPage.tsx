import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNumberSetting } from '../../lib/settings'
import { useSettings } from '../../lib/SettingsContext'
import { useRealtime } from '../../lib/useRealtime'
import type { DiningTable, TableStatus } from '../../types'
import {
  addTable,
  deleteSection,
  fetchTables,
  removeTable,
  renameSection,
  updateTablePosition,
  updateTableSection,
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
  const [activeSection, setActiveSection] = useState<string>('ALL') // 'ALL' = semua ruangan
  const [addingRoom, setAddingRoom] = useState(false)
  const [newRoom, setNewRoom] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)

  const reload = () => setTables(fetchTables(outletId))
  useEffect(reload, [outletId])
  useRealtime('tables:update', reload)

  // Daftar ruangan: dari data meja + ruangan aktif (agar ruangan baru tetap muncul walau belum ada mejanya).
  const sections = useMemo(() => {
    const set = new Set<string>()
    for (const t of tables) if (t.section_name) set.add(t.section_name)
    if (activeSection !== 'ALL') set.add(activeSection)
    return Array.from(set).sort()
  }, [tables, activeSection])

  // Jumlah meja per ruangan (untuk panel Kelola Ruangan).
  const roomCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tables) m[t.section_name] = (m[t.section_name] ?? 0) + 1
    return m
  }, [tables])

  // Meja yang tampil di canvas mengikuti ruangan terpilih.
  const visibleTables = useMemo(
    () => (activeSection === 'ALL' ? tables : tables.filter((t) => t.section_name === activeSection)),
    [tables, activeSection],
  )

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId],
  )
  const counts = useMemo(() => {
    const c = { EMPTY: 0, OCCUPIED: 0, WAITING_BILL: 0 }
    for (const t of visibleTables) c[t.status]++
    return c
  }, [visibleTables])

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
    // Meja baru masuk ke ruangan yang sedang dipilih (atau ruangan pertama bila melihat "Semua").
    const section = activeSection !== 'ALL' ? activeSection : sections[0] ?? 'INDOOR'
    await addTable(outletId, `T-${String(nextNum).padStart(2, '0')}`, 4, section, 0, 0)
    reload()
  }

  const handleRemove = async () => {
    if (!selected) return
    await removeTable(selected.id)
    setSelectedId(null)
    reload()
  }

  const handleChangeSection = async (section: string) => {
    if (!selected) return
    await updateTableSection(selected.id, section)
    reload()
  }

  const handleAddRoom = () => {
    const name = newRoom.trim().toUpperCase()
    if (!name) return
    setActiveSection(name)
    setNewRoom('')
    setAddingRoom(false)
  }

  const handleRenameRoom = async (from: string, to: string) => {
    const name = to.trim().toUpperCase()
    if (!name || name === from) return
    await renameSection(outletId, from, name)
    if (activeSection === from) setActiveSection(name)
    reload()
  }

  const handleDeleteRoom = async (section: string) => {
    await deleteSection(outletId, section)
    if (activeSection === section) setActiveSection('ALL')
    if (selected && selected.section_name === section) setSelectedId(null)
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

        {/* Pemilih ruangan */}
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ruangan</span>
          <RoomPill
            active={activeSection === 'ALL'}
            label="Semua"
            onClick={() => setActiveSection('ALL')}
          />
          {sections.map((s) => (
            <RoomPill
              key={s}
              active={activeSection === s}
              label={s}
              onClick={() => setActiveSection(s)}
            />
          ))}
          {editMode &&
            (addingRoom ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRoom()
                    if (e.key === 'Escape') {
                      setAddingRoom(false)
                      setNewRoom('')
                    }
                  }}
                  placeholder="Nama ruangan"
                  className="w-32 rounded-full border border-black/10 px-3 py-1 text-xs outline-none focus:border-brand-strong"
                />
                <button
                  onClick={handleAddRoom}
                  disabled={!newRoom.trim()}
                  className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
                >
                  Simpan
                </button>
              </span>
            ) : (
              <button
                onClick={() => setAddingRoom(true)}
                className="rounded-full border border-dashed border-black/20 px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-brand-soft"
              >
                + Ruangan
              </button>
            ))}
          {editMode && sections.length > 0 && (
            <button
              onClick={() => setManageOpen(true)}
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-brand-soft"
            >
              ⚙ Kelola Ruangan
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
          {visibleTables.map((t) => {
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
          {visibleTables.length === 0 && (
            <p className="mt-10 text-center text-sm text-ink-soft">
              {tables.length === 0
                ? 'Belum ada meja. Aktifkan “Atur Layout” lalu tambah meja.'
                : activeSection === 'ALL'
                  ? 'Belum ada meja.'
                  : `Belum ada meja di ruangan ${activeSection}. Aktifkan “Atur Layout” lalu tambah meja.`}
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
              {selected.section_name} · Kapasitas {selected.capacity}
              {selected.max_capacity > selected.capacity ? `–${selected.max_capacity}` : ''} orang
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
              <div className="mt-5 grid gap-3">
                <p className="text-xs text-ink-soft">Seret meja di canvas untuk mengatur posisi.</p>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">Ruangan</span>
                  <select
                    value={selected.section_name}
                    onChange={(e) => handleChangeSection(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-strong"
                  >
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
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

      {manageOpen && (
        <ManageRoomsModal
          sections={sections}
          roomCounts={roomCounts}
          onRename={handleRenameRoom}
          onDelete={handleDeleteRoom}
          onClose={() => setManageOpen(false)}
        />
      )}
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

function RoomPill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full px-3 py-1 text-xs font-semibold transition ' +
        (active ? 'bg-status-occupied text-white shadow' : 'bg-white text-ink hover:bg-brand-soft')
      }
    >
      {label}
    </button>
  )
}

function ManageRoomsModal({
  sections,
  roomCounts,
  onRename,
  onDelete,
  onClose,
}: {
  sections: string[]
  roomCounts: Record<string, number>
  onRename: (from: string, to: string) => void | Promise<void>
  onDelete: (section: string) => void | Promise<void>
  onClose: () => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const startRename = (s: string) => {
    setConfirmDelete(null)
    setRenaming(s)
    setRenameValue(s)
  }
  const saveRename = (from: string) => {
    onRename(from, renameValue)
    setRenaming(null)
    setRenameValue('')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Kelola Ruangan</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>

        {sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Belum ada ruangan.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {sections.map((s) => {
              const count = roomCounts[s] ?? 0
              return (
                <li key={s} className="py-2.5">
                  {renaming === s ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(s)
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm uppercase outline-none focus:border-brand-strong"
                      />
                      <button
                        onClick={() => saveRename(s)}
                        disabled={!renameValue.trim() || renameValue.trim().toUpperCase() === s}
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setRenaming(null)}
                        className="rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft hover:bg-background"
                      >
                        Batal
                      </button>
                    </div>
                  ) : confirmDelete === s ? (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-xs text-status-occupied">
                        Hapus “{s}”{count > 0 ? ` beserta ${count} meja` : ''}?
                      </span>
                      <button
                        onClick={() => {
                          onDelete(s)
                          setConfirmDelete(null)
                        }}
                        className="rounded-lg bg-status-occupied px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
                      >
                        Hapus
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft hover:bg-background"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {s}
                      </span>
                      <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-ink-soft">
                        {count} meja
                      </span>
                      <button
                        onClick={() => startRename(s)}
                        title="Ganti nama"
                        className="shrink-0 rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-background"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => {
                          setRenaming(null)
                          setConfirmDelete(s)
                        }}
                        title="Hapus ruangan"
                        className="shrink-0 rounded-lg px-2 py-1 text-sm text-status-occupied hover:bg-status-occupied/10"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-ink-soft">
          Ganti nama memindah semua meja ke nama baru (bila sama dengan ruangan lain, keduanya
          tergabung). Menghapus ruangan ikut menghapus seluruh meja di dalamnya.
        </p>
      </div>
    </div>
  )
}
