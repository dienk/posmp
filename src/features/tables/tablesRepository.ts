import { execute, query } from '../../db/database'
import type { DiningTable, TableStatus } from '../../types'

export function fetchTables(outletId: number): DiningTable[] {
  return query<DiningTable>(
    `SELECT id, outlet_id, table_number, section_name, grid_x, grid_y, capacity, status
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
): Promise<number> {
  return execute(
    `INSERT INTO dining_tables (outlet_id, table_number, section_name, capacity, grid_x, grid_y, status)
     VALUES (?, ?, ?, ?, ?, ?, 'EMPTY')`,
    [outletId, tableNumber, section, capacity, gridX, gridY],
  )
}

export async function removeTable(id: number): Promise<void> {
  await execute('DELETE FROM dining_tables WHERE id = ?', [id])
}
