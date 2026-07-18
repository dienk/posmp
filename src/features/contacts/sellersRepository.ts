import { updateAppSettings } from '../settings/settingsRepository'
import { genId } from '../access/accessRepository'

// "Penjual" (mis. agen/sales/mitra jual) — tipe kontak yang belum punya tabel,
// disimpan sebagai JSON di app_settings agar tetap local-first.
export interface Seller {
  id: string
  name: string
  phone?: string
  note?: string
}

export function loadSellers(settings: Record<string, string>): Seller[] {
  try {
    return JSON.parse(settings.master_sellers ?? '[]') as Seller[]
  } catch {
    return []
  }
}

export async function saveSellers(sellers: Seller[]): Promise<void> {
  await updateAppSettings({ master_sellers: JSON.stringify(sellers) })
}

export function newSeller(name: string, phone: string, note: string): Seller {
  return {
    id: genId('slr'),
    name: name.trim(),
    phone: phone.trim() || undefined,
    note: note.trim() || undefined,
  }
}
