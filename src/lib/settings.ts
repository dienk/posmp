import { query } from '../db/database'

/** Baca seluruh app_settings sebagai map key -> value. */
export function loadSettings(): Record<string, string> {
  const rows = query<{ setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM app_settings',
  )
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))
}

export function getNumberSetting(
  settings: Record<string, string>,
  key: string,
  fallback = 0,
): number {
  const v = Number(settings[key])
  return Number.isFinite(v) ? v : fallback
}

export function isModuleEnabled(settings: Record<string, string>, key: string): boolean {
  return settings[key] === '1'
}

/**
 * Apakah proses opname wajib melewati persetujuan (approval)? Default AKTIF
 * (dinonaktifkan hanya bila setelan bernilai eksplisit '0').
 */
export function isOpnameApprovalRequired(settings: Record<string, string>): boolean {
  return settings.require_opname_approval !== '0'
}

/** Apakah transfer stok wajib melewati persetujuan? Default nonaktif. */
export function isTransferApprovalRequired(settings: Record<string, string>): boolean {
  return settings.require_transfer_approval === '1'
}
