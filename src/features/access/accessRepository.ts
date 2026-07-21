import { updateAppSettings } from '../settings/settingsRepository'

export interface Role {
  id: string
  name: string
  perms: string[] // daftar key izin (lihat PERMISSIONS)
}

export interface Persona {
  id: string
  name: string
  roleId: string
  phone?: string
  pin?: string // PIN angka (4–6 digit) opsional untuk keamanan Kasir
  pinKasir?: boolean // true = wajib input PIN saat buka/tutup menu Kasir
}

/** Daftar izin akses (dipetakan ke bagian menu sidebar). */
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'kasir', label: 'Kasir (POS)' },
  { key: 'datamaster', label: 'Data Master (Produk, Contact)' },
  { key: 'transaksi', label: 'Transaksi (Riwayat, Pre-Order)' },
  { key: 'cash_history', label: 'Buka Riwayat Kas (Saldo Kas)' },
  { key: 'tables', label: 'Meja' },
  { key: 'kds', label: 'Dapur (KDS)' },
  { key: 'queue', label: 'Antrean' },
  { key: 'members', label: 'Member' },
  { key: 'stockin', label: 'Stok Masuk' },
  { key: 'stockopname', label: 'Stock Opname' },
  { key: 'installments', label: 'Cicilan' },
  { key: 'vouchers', label: 'Voucher' },
  { key: 'marketplace', label: 'Marketplace / Channel' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'reports', label: 'Laporan' },
  { key: 'kiosk', label: 'Kiosk (layar mandiri)' },
]

const ALL_KEYS = PERMISSIONS.map((p) => p.key)

// ── Migrasi izin ────────────────────────────────────────────────────────────
// Kunci izin yang sudah ada SEBELUM penambahan 'dashboard' & 'kiosk'. Dipakai
// untuk mengenali peran yang dulunya full-access agar tetap dapat izin baru
// (mencegah menu Dashboard/Kiosk hilang untuk peran Pemilik/Manajer tersimpan).
const LEGACY_FULL_KEYS = [
  'kasir',
  'datamaster',
  'transaksi',
  'cash_history',
  'tables',
  'kds',
  'queue',
  'members',
  'stockin',
  'stockopname',
  'installments',
  'vouchers',
  'marketplace',
  'reports',
]
const ADDED_KEYS = ['dashboard', 'kiosk']

/** Peran yang punya SEMUA kunci lama dianggap full-access → diberi kunci baru. */
function migratePerms(perms: string[]): string[] {
  if (!LEGACY_FULL_KEYS.every((k) => perms.includes(k))) return perms
  const set = new Set(perms)
  for (const k of ADDED_KEYS) set.add(k)
  return Array.from(set)
}

// Peran default mengikuti persona pada PRD.
export const DEFAULT_ROLES: Role[] = [
  { id: 'manajer', name: 'Pemilik / Manajer', perms: [...ALL_KEYS] },
  {
    id: 'kasir',
    name: 'Kasir & Staf Pelayanan',
    perms: ['kasir', 'transaksi', 'tables', 'queue', 'members', 'vouchers'],
  },
  { id: 'dapur', name: 'Staf Dapur', perms: ['kds'] },
]

export const DEFAULT_PERSONAS: Persona[] = [
  { id: 'admin', name: 'Administrator', roleId: 'manajer' },
]

function parse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadRoles(settings: Record<string, string>): Role[] {
  const roles = parse<Role[]>(settings.access_roles, DEFAULT_ROLES)
  const list = roles.length ? roles : DEFAULT_ROLES
  // Migrasi: peran full-access lama otomatis dapat izin baru (dashboard/kiosk).
  return list.map((r) => ({ ...r, perms: migratePerms(r.perms) }))
}

export function loadPersonas(settings: Record<string, string>): Persona[] {
  const p = parse<Persona[]>(settings.access_personas, DEFAULT_PERSONAS)
  return p.length ? p : DEFAULT_PERSONAS
}

export function getActivePersonaId(settings: Record<string, string>): string {
  return settings.active_persona_id ?? DEFAULT_PERSONAS[0].id
}

export function getActivePersona(settings: Record<string, string>): Persona | undefined {
  const personas = loadPersonas(settings)
  const id = getActivePersonaId(settings)
  return personas.find((p) => p.id === id) ?? personas[0]
}

/**
 * Set izin efektif untuk persona aktif. Mengembalikan Set berisi key izin,
 * atau null bila tidak ada persona/peran (artinya tanpa pembatasan).
 */
export function effectivePerms(settings: Record<string, string>): Set<string> | null {
  const persona = getActivePersona(settings)
  if (!persona) return null
  const role = loadRoles(settings).find((r) => r.id === persona.roleId)
  if (!role) return null
  return new Set(role.perms)
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

export async function saveRoles(roles: Role[]): Promise<void> {
  await updateAppSettings({ access_roles: JSON.stringify(roles) })
}

export async function savePersonas(personas: Persona[]): Promise<void> {
  await updateAppSettings({ access_personas: JSON.stringify(personas) })
}

export async function setActivePersona(id: string): Promise<void> {
  await updateAppSettings({ active_persona_id: id })
}
