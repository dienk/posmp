import { execute, query } from '../../db/database'
import type { Cashier } from '../../types'

export interface CashierInput {
  outlet_id: number
  name: string
  code: string | null
  location: string | null
  is_active: number
}

/** Semua kasir + nama outlet-nya. Bisa difilter per outlet. */
export function listCashiers(outletId?: number): Cashier[] {
  const where = outletId ? 'WHERE c.outlet_id = ?' : ''
  const params = outletId ? [outletId] : []
  return query<Cashier>(
    `SELECT c.id, c.outlet_id, c.name, c.code, c.location, c.is_active,
            o.name AS outlet_name
     FROM cashiers c
     LEFT JOIN outlets o ON o.id = c.outlet_id
     ${where}
     ORDER BY o.name, c.name`,
    params,
  )
}

export async function createCashier(input: CashierInput): Promise<number> {
  return execute(
    'INSERT INTO cashiers (outlet_id, name, code, location, is_active) VALUES (?, ?, ?, ?, ?)',
    [input.outlet_id, input.name.trim(), input.code?.trim() || null, input.location?.trim() || null, input.is_active],
  )
}

export async function updateCashier(id: number, input: CashierInput): Promise<void> {
  await execute(
    'UPDATE cashiers SET outlet_id = ?, name = ?, code = ?, location = ?, is_active = ? WHERE id = ?',
    [input.outlet_id, input.name.trim(), input.code?.trim() || null, input.location?.trim() || null, input.is_active, id],
  )
}

export async function deleteCashier(id: number): Promise<void> {
  await execute('DELETE FROM cashiers WHERE id = ?', [id])
}
