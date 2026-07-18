import { getDb, persist, query } from '../../db/database'

export interface OutletInfo {
  id: number
  name: string
  address: string | null
  phone: string | null
}

/** Upsert sekumpulan app_settings dalam satu transaksi SQL, lalu persist. */
export async function updateAppSettings(settings: Record<string, string>): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    for (const [key, value] of Object.entries(settings)) {
      db.run(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
        [key, value],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

export function getOutlet(id: number): OutletInfo | undefined {
  return query<OutletInfo>('SELECT id, name, address, phone FROM outlets WHERE id = ?', [id])[0]
}

/**
 * Simpan perubahan pengaturan aplikasi (app_settings, upsert) dan info outlet
 * dalam satu transaksi SQL, lalu persist sekali.
 */
export async function saveSettings(
  settings: Record<string, string>,
  outletId: number,
  outlet: { name: string; address: string; phone: string },
): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    for (const [key, value] of Object.entries(settings)) {
      db.run(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
        [key, value],
      )
    }
    db.run('UPDATE outlets SET name = ?, address = ?, phone = ? WHERE id = ?', [
      outlet.name.trim(),
      outlet.address.trim() || null,
      outlet.phone.trim() || null,
      outletId,
    ])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}
