// Cadangan otomatis terjadwal (local-first). Snapshot .sqlite disimpan di
// IndexedDB (store yang sama, kunci `backup:<dbId>:<id>`); metadata + jadwal di
// localStorage agar ringan & tak memicu tulis DB berantai. Konfigurasi
// (aktif/interval/retensi) di app_settings agar bisa diatur lewat SettingsContext.

import {
  exportDatabase,
  getCurrentDbId,
  idbDeleteBlob,
  idbLoadBlob,
  idbSaveBlob,
  importDatabase,
} from '../../db/database'

export interface BackupMeta {
  id: string
  at: string // ISO timestamp
  size: number // byte
  label: string
  auto: boolean // dibuat oleh penjadwal (bukan manual)
}

export interface BackupConfig {
  enabled: boolean
  intervalHours: number
  keep: number // jumlah cadangan otomatis yang dipertahankan
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = { enabled: false, intervalHours: 24, keep: 5 }

function regKey(): string {
  return `posmp_backups:${getCurrentDbId()}`
}
function lastKey(): string {
  return `posmp_backup_last:${getCurrentDbId()}`
}
function blobKey(id: string): string {
  return `backup:${getCurrentDbId()}:${id}`
}

/** Baca konfigurasi backup dari app_settings (dengan fallback default). */
export function getBackupConfig(settings: Record<string, string>): BackupConfig {
  const interval = Number(settings.backup_interval_hours)
  const keep = Number(settings.backup_keep)
  return {
    enabled: settings.backup_auto_enabled === '1',
    intervalHours: Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_BACKUP_CONFIG.intervalHours,
    keep: Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : DEFAULT_BACKUP_CONFIG.keep,
  }
}

/** Ubah konfigurasi backup → map app_settings untuk updateAppSettings. */
export function backupConfigToSettings(c: BackupConfig): Record<string, string> {
  return {
    backup_auto_enabled: c.enabled ? '1' : '0',
    backup_interval_hours: String(c.intervalHours),
    backup_keep: String(c.keep),
  }
}

/** Daftar cadangan (metadata) untuk database aktif, terbaru dulu. */
export function listBackups(): BackupMeta[] {
  try {
    const arr = JSON.parse(localStorage.getItem(regKey()) ?? '[]')
    if (Array.isArray(arr)) return (arr as BackupMeta[]).sort((a, b) => b.at.localeCompare(a.at))
  } catch {
    /* rusak → kosong */
  }
  return []
}

function writeRegistry(list: BackupMeta[]): void {
  localStorage.setItem(regKey(), JSON.stringify(list))
}

/** Waktu cadangan terakhir (ISO) atau null. */
export function lastBackupAt(): string | null {
  return localStorage.getItem(lastKey())
}

/**
 * Buat cadangan sekarang: snapshot DB → IndexedDB, catat metadata, tandai waktu.
 * `auto` menandai cadangan hasil penjadwal.
 */
export async function createBackup(auto: boolean, label?: string): Promise<BackupMeta> {
  const bytes = exportDatabase()
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
  const meta: BackupMeta = {
    id,
    at: new Date().toISOString(),
    size: bytes.length,
    label: label?.trim() || (auto ? 'Otomatis' : 'Manual'),
    auto,
  }
  await idbSaveBlob(blobKey(id), bytes)
  writeRegistry([meta, ...listBackups()])
  localStorage.setItem(lastKey(), meta.at)
  return meta
}

/** Ambil byte sebuah cadangan (untuk unduh). Null bila hilang. */
export async function getBackupBytes(id: string): Promise<Uint8Array | null> {
  return idbLoadBlob(blobKey(id))
}

/** Hapus satu cadangan (blob + metadata). */
export async function deleteBackup(id: string): Promise<void> {
  await idbDeleteBlob(blobKey(id))
  writeRegistry(listBackups().filter((b) => b.id !== id))
}

/**
 * Pulihkan DB dari sebuah cadangan tersimpan. Mengganti data saat ini; pemanggil
 * bertanggung jawab memuat ulang halaman agar cache in-memory ikut segar.
 */
export async function restoreBackup(id: string): Promise<void> {
  const bytes = await getBackupBytes(id)
  if (!bytes) throw new Error('Berkas cadangan tidak ditemukan.')
  await importDatabase(bytes)
}

/** Buang cadangan OTOMATIS terlama hingga tersisa `keep` (cadangan manual tak disentuh). */
export async function pruneBackups(keep: number): Promise<void> {
  const autos = listBackups().filter((b) => b.auto)
  const excess = autos.slice(keep) // listBackups terbaru dulu → sisa = paling lama
  for (const b of excess) await deleteBackup(b.id)
}

/** Apakah cadangan otomatis sudah jatuh tempo terhadap interval (jam)? */
export function backupDue(intervalHours: number): boolean {
  const last = lastBackupAt()
  if (!last) return true
  const elapsed = Date.now() - new Date(last).getTime()
  return elapsed >= intervalHours * 3600_000
}

/**
 * Jalankan penjadwal: bila aktif & jatuh tempo, buat cadangan otomatis lalu
 * pangkas sesuai retensi. Kembalikan metadata bila membuat cadangan, else null.
 */
export async function runScheduledBackup(settings: Record<string, string>): Promise<BackupMeta | null> {
  const cfg = getBackupConfig(settings)
  if (!cfg.enabled || !backupDue(cfg.intervalHours)) return null
  const meta = await createBackup(true)
  await pruneBackups(cfg.keep)
  return meta
}
