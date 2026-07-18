import { execute, getDb, persist, query } from '../../db/database'
import type { Outlet } from '../../types'

export interface OutletWithStats extends Outlet {
  cashier_count: number
}

export interface OutletInput {
  name: string
  address: string | null
  phone: string | null
  is_active: number
}

/** Semua outlet + jumlah titik kasir aktif. */
export function listOutlets(): OutletWithStats[] {
  return query<OutletWithStats>(
    `SELECT o.id, o.name, o.address, o.phone, o.is_active,
            (SELECT COUNT(*) FROM cashiers c WHERE c.outlet_id = o.id) AS cashier_count
     FROM outlets o
     ORDER BY o.id`,
  )
}

export async function createOutlet(input: OutletInput): Promise<number> {
  return execute(
    'INSERT INTO outlets (name, address, phone, is_active) VALUES (?, ?, ?, ?)',
    [input.name.trim(), input.address?.trim() || null, input.phone?.trim() || null, input.is_active],
  )
}

export async function updateOutlet(id: number, input: OutletInput): Promise<void> {
  await execute('UPDATE outlets SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?', [
    input.name.trim(),
    input.address?.trim() || null,
    input.phone?.trim() || null,
    input.is_active,
    id,
  ])
}

/**
 * Hapus outlet. Ditolak bila masih ada data terkait (kasir, transaksi, stok,
 * meja) agar tidak memutus referensi. Kembalikan pesan alasan bila gagal.
 */
export async function deleteOutlet(id: number): Promise<string | null> {
  const refs = query<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM cashiers WHERE outlet_id = ?) +
       (SELECT COUNT(*) FROM transactions WHERE outlet_id = ?) +
       (SELECT COUNT(*) FROM outlet_stocks WHERE outlet_id = ?) +
       (SELECT COUNT(*) FROM dining_tables WHERE outlet_id = ?) AS n`,
    [id, id, id, id],
  )[0]?.n ?? 0
  if (refs > 0) {
    return 'Outlet tidak bisa dihapus karena masih memiliki kasir/transaksi/stok/meja. Nonaktifkan saja.'
  }
  const total = query<{ n: number }>('SELECT COUNT(*) AS n FROM outlets')[0]?.n ?? 0
  if (total <= 1) return 'Minimal satu outlet harus tersisa.'
  const db = getDb()
  db.run('DELETE FROM outlets WHERE id = ?', [id])
  await persist()
  return null
}
