import { execute, getDb, persist, query } from '../../db/database'

export interface Unit {
  id: number
  name: string
  description: string | null
  is_active: number
}

export interface UnitWithUsage extends Unit {
  product_count: number
}

export interface UnitInput {
  name: string
  description: string | null
  is_active: number
}

/** Semua satuan + jumlah produk yang memakainya (cocok berdasarkan nama). */
export function listUnits(): UnitWithUsage[] {
  return query<UnitWithUsage>(
    `SELECT u.id, u.name, u.description, u.is_active,
            (SELECT COUNT(*) FROM products p WHERE p.unit = u.name) AS product_count
     FROM units u
     ORDER BY u.name`,
  )
}

/** Satuan aktif saja (untuk pilihan di form produk). */
export function listActiveUnitNames(): string[] {
  return query<{ name: string }>('SELECT name FROM units WHERE is_active = 1 ORDER BY name').map(
    (r) => r.name,
  )
}

export async function createUnit(input: UnitInput): Promise<number> {
  return execute('INSERT INTO units (name, description, is_active) VALUES (?, ?, ?)', [
    input.name.trim(),
    input.description?.trim() || null,
    input.is_active,
  ])
}

export async function updateUnit(id: number, input: UnitInput): Promise<void> {
  await execute('UPDATE units SET name = ?, description = ?, is_active = ? WHERE id = ?', [
    input.name.trim(),
    input.description?.trim() || null,
    input.is_active,
    id,
  ])
}

export async function deleteUnit(id: number): Promise<void> {
  const db = getDb()
  db.run('DELETE FROM units WHERE id = ?', [id])
  await persist()
}
