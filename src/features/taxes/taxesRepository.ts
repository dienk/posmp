import { getDb, persist, query } from '../../db/database'

export interface Tax {
  id: number
  name: string
  rate: number
  description: string | null
  is_default: number
  is_active: number
}

export interface TaxInput {
  name: string
  rate: number
  description: string | null
  is_default: number
  is_active: number
}

export function listTaxes(): Tax[] {
  return query<Tax>(
    'SELECT id, name, rate, description, is_default, is_active FROM taxes ORDER BY is_default DESC, name',
  )
}

/** Pajak default yang aktif (dipakai kasir), atau null. */
export function defaultTax(): Tax | null {
  return (
    query<Tax>(
      `SELECT id, name, rate, description, is_default, is_active
       FROM taxes WHERE is_default = 1 AND is_active = 1 LIMIT 1`,
    )[0] ?? null
  )
}

/**
 * Selaraskan tarif pajak default aktif ke app_settings.tax_rate agar dipakai
 * oleh kasir & struk. Tidak menyentuh tax_enabled (dikelola di Setelan).
 * Panggil setelah setiap perubahan master pajak. Satu transaksi.
 */
function syncDefaultTaxToSettings(db: ReturnType<typeof getDb>): void {
  const def = query<{ rate: number }>(
    `SELECT rate FROM taxes WHERE is_default = 1 AND is_active = 1 LIMIT 1`,
  )[0]
  const rate = def ? Math.max(0, def.rate) / 100 : 0
  db.run(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('tax_rate', ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    [String(rate)],
  )
}

/** Jadikan satu pajak sebagai default tunggal (mengosongkan default lain). */
function setSingleDefault(db: ReturnType<typeof getDb>, id: number): void {
  db.run('UPDATE taxes SET is_default = 0')
  db.run('UPDATE taxes SET is_default = 1 WHERE id = ?', [id])
}

export async function createTax(input: TaxInput): Promise<number> {
  const db = getDb()
  db.run('BEGIN')
  let id = 0
  try {
    db.run(
      'INSERT INTO taxes (name, rate, description, is_default, is_active) VALUES (?, ?, ?, 0, ?)',
      [input.name.trim(), Math.max(0, input.rate), input.description?.trim() || null, input.is_active],
    )
    id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    if (input.is_default) setSingleDefault(db, id)
    syncDefaultTaxToSettings(db)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  return id
}

export async function updateTax(id: number, input: TaxInput): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('UPDATE taxes SET name = ?, rate = ?, description = ?, is_active = ? WHERE id = ?', [
      input.name.trim(),
      Math.max(0, input.rate),
      input.description?.trim() || null,
      input.is_active,
      id,
    ])
    if (input.is_default) setSingleDefault(db, id)
    else db.run('UPDATE taxes SET is_default = 0 WHERE id = ?', [id])
    syncDefaultTaxToSettings(db)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

export async function deleteTax(id: number): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('DELETE FROM taxes WHERE id = ?', [id])
    syncDefaultTaxToSettings(db)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}
