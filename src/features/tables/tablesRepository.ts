import { execute, query } from '../../db/database'
import type { DiningTable, TableStatus } from '../../types'

export function fetchTables(outletId: number): DiningTable[] {
  return query<DiningTable>(
    `SELECT id, outlet_id, table_number, section_name, grid_x, grid_y, capacity, max_capacity, status
     FROM dining_tables WHERE outlet_id = ? ORDER BY id`,
    [outletId],
  )
}

export async function updateTableStatus(id: number, status: TableStatus): Promise<void> {
  await execute('UPDATE dining_tables SET status = ? WHERE id = ?', [status, id])
}

export async function updateTablePosition(id: number, gridX: number, gridY: number): Promise<void> {
  await execute('UPDATE dining_tables SET grid_x = ?, grid_y = ? WHERE id = ?', [gridX, gridY, id])
}

export async function addTable(
  outletId: number,
  tableNumber: string,
  capacity: number,
  section: string,
  gridX: number,
  gridY: number,
  maxCapacity: number = capacity,
): Promise<number> {
  return execute(
    `INSERT INTO dining_tables (outlet_id, table_number, section_name, capacity, max_capacity, grid_x, grid_y, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'EMPTY')`,
    [outletId, tableNumber, section, capacity, maxCapacity, gridX, gridY],
  )
}

export async function removeTable(id: number): Promise<void> {
  await execute('DELETE FROM dining_tables WHERE id = ?', [id])
}

// ── Master Meja (Data Master) ────────────────────────────────────────────────

export interface TableMaster extends DiningTable {
  outlet_name: string | null
}

export interface TableMasterInput {
  outlet_id: number
  table_number: string
  section_name: string
  capacity: number
  max_capacity: number
}

/** Semua meja lintas outlet + nama outlet. Bisa difilter per outlet. */
export function listTablesMaster(outletId?: number): TableMaster[] {
  const where = outletId ? 'WHERE t.outlet_id = ?' : ''
  const params = outletId ? [outletId] : []
  return query<TableMaster>(
    `SELECT t.id, t.outlet_id, t.table_number, t.section_name, t.grid_x, t.grid_y,
            t.capacity, t.max_capacity, t.status, o.name AS outlet_name
     FROM dining_tables t
     LEFT JOIN outlets o ON o.id = t.outlet_id
     ${where}
     ORDER BY o.name, t.table_number`,
    params,
  )
}

export async function createTableMaster(input: TableMasterInput): Promise<number> {
  return execute(
    `INSERT INTO dining_tables (outlet_id, table_number, section_name, capacity, max_capacity, grid_x, grid_y, status)
     VALUES (?, ?, ?, ?, ?, 0, 0, 'EMPTY')`,
    [
      input.outlet_id,
      input.table_number.trim(),
      input.section_name,
      input.capacity,
      input.max_capacity,
    ],
  )
}

export async function updateTableMaster(id: number, input: TableMasterInput): Promise<void> {
  await execute(
    `UPDATE dining_tables
     SET outlet_id = ?, table_number = ?, section_name = ?, capacity = ?, max_capacity = ?
     WHERE id = ?`,
    [
      input.outlet_id,
      input.table_number.trim(),
      input.section_name,
      input.capacity,
      input.max_capacity,
      id,
    ],
  )
}
