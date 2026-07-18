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
