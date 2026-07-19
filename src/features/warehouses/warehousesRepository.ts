import { getDb, persist, query } from '../../db/database'

export interface Warehouse {
  id: number
  outlet_id: number
  name: string
  code: string | null
  location: string | null
  is_default: number
  is_active: number
}

export interface WarehouseWithUsage extends Warehouse {
  product_count: number
}

export interface WarehouseInput {
  outletId: number
  name: string
  code: string | null
  location: string | null
  isDefault: number
  isActive: number
}

/** Gudang aktif pada outlet (untuk pemilihan di form stok). */
export function listWarehouses(outletId: number): Warehouse[] {
  return query<Warehouse>(
    `SELECT * FROM warehouses WHERE outlet_id = ? AND is_active = 1 ORDER BY is_default DESC, name`,
    [outletId],
  )
}

/** Semua gudang (opsional per outlet) + jumlah produk yang punya stok di dalamnya. */
export function listWarehousesWithUsage(outletId?: number): WarehouseWithUsage[] {
  const where = outletId ? 'WHERE w.outlet_id = ?' : ''
  const params = outletId ? [outletId] : []
  return query<WarehouseWithUsage>(
    `SELECT w.*,
            (SELECT COUNT(*) FROM outlet_stocks os
             WHERE os.warehouse_id = w.id AND os.stock <> 0) AS product_count
     FROM warehouses w
     ${where}
     ORDER BY w.outlet_id, w.is_default DESC, w.name`,
    params,
  )
}

/** ID gudang default (aktif) pada outlet; fallback ke gudang mana pun, lalu 1. */
export function defaultWarehouseId(outletId: number): number {
  const def = query<{ id: number }>(
    `SELECT id FROM warehouses WHERE outlet_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1`,
    [outletId],
  )[0]
  if (def) return def.id
  const any = query<{ id: number }>(
    `SELECT id FROM warehouses WHERE outlet_id = ? ORDER BY id LIMIT 1`,
    [outletId],
  )[0]
  return any?.id ?? 1
}

function setSingleDefault(db: ReturnType<typeof getDb>, outletId: number, id: number): void {
  db.run('UPDATE warehouses SET is_default = 0 WHERE outlet_id = ?', [outletId])
  db.run('UPDATE warehouses SET is_default = 1 WHERE id = ?', [id])
}

export async function createWarehouse(input: WarehouseInput): Promise<number> {
  const db = getDb()
  db.run('BEGIN')
  let id = 0
  try {
    db.run(
      'INSERT INTO warehouses (outlet_id, name, code, location, is_default, is_active) VALUES (?, ?, ?, ?, 0, ?)',
      [input.outletId, input.name.trim(), input.code?.trim() || null, input.location?.trim() || null, input.isActive],
    )
    id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    if (input.isDefault) setSingleDefault(db, input.outletId, id)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  return id
}

export async function updateWarehouse(id: number, input: WarehouseInput): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run(
      'UPDATE warehouses SET name = ?, code = ?, location = ?, is_active = ? WHERE id = ?',
      [input.name.trim(), input.code?.trim() || null, input.location?.trim() || null, input.isActive, id],
    )
    if (input.isDefault) setSingleDefault(db, input.outletId, id)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

/** Hapus gudang; ditolak bila masih punya stok atau merupakan gudang default. */
export async function deleteWarehouse(id: number): Promise<void> {
  const wh = query<{ is_default: number }>('SELECT is_default FROM warehouses WHERE id = ?', [id])[0]
  if (wh?.is_default === 1) throw new Error('Gudang default tidak bisa dihapus.')
  const used = query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM outlet_stocks WHERE warehouse_id = ? AND stock <> 0',
    [id],
  )[0].n
  if (used > 0) throw new Error('Gudang masih memiliki stok — nonaktifkan saja.')
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('DELETE FROM outlet_stocks WHERE warehouse_id = ?', [id])
    db.run('DELETE FROM warehouses WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}
