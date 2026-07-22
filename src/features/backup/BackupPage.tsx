import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { useSettings } from '../../lib/SettingsContext'
import { updateAppSettings } from '../settings/settingsRepository'
import {
  backupConfigToSettings,
  createBackup,
  deleteBackup,
  getBackupBytes,
  getBackupConfig,
  lastBackupAt,
  listBackups,
  pruneBackups,
  restoreBackup,
  type BackupMeta,
} from './backupRepository'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const INTERVAL_OPTIONS = [
  { h: 6, label: 'Tiap 6 jam' },
  { h: 12, label: 'Tiap 12 jam' },
  { h: 24, label: 'Harian (24 jam)' },
  { h: 72, label: 'Tiap 3 hari' },
  { h: 168, label: 'Mingguan' },
]

export default function BackupPage() {
  const { settings, reloadSettings } = useSettings()
  const cfg = useMemo(() => getBackupConfig(settings), [settings])

  const [enabled, setEnabled] = useState(cfg.enabled)
  const [intervalHours, setIntervalHours] = useState(cfg.intervalHours)
  const [keep, setKeep] = useState(cfg.keep)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setEnabled(cfg.enabled)
    setIntervalHours(cfg.intervalHours)
    setKeep(cfg.keep)
  }, [cfg])

  const refresh = () => setBackups(listBackups())
  useEffect(refresh, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  const saveConfig = async () => {
    try {
      await updateAppSettings(
        backupConfigToSettings({ enabled, intervalHours, keep: Math.max(1, keep) }),
      )
      reloadSettings()
      showToast('Pengaturan cadangan otomatis disimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan')
    }
  }

  const handleBackupNow = async () => {
    setBusy(true)
    try {
      await createBackup(false)
      await pruneBackups(Math.max(1, keep))
      refresh()
      showToast('Cadangan dibuat.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat cadangan')
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async (b: BackupMeta) => {
    try {
      const bytes = await getBackupBytes(b.id)
      if (!bytes) {
        showToast('Berkas cadangan tidak ditemukan.')
        return
      }
      const copy = new Uint8Array(bytes.length)
      copy.set(bytes)
      const blob = new Blob([copy], { type: 'application/x-sqlite3' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `posmp-backup-${b.at.slice(0, 10).replace(/-/g, '')}-${b.id}.sqlite`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Cadangan diunduh.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengunduh cadangan')
    }
  }

  const handleRestore = async (b: BackupMeta) => {
    if (
      !window.confirm(
        `Pulihkan database dari cadangan ${formatDateTime(b.at)}? Seluruh data saat ini akan DIGANTI oleh isi cadangan.`,
      )
    )
      return
    setBusy(true)
    try {
      await restoreBackup(b.id)
      showToast('Database dipulihkan. Memuat ulang…')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      setBusy(false)
      showToast(err instanceof Error ? err.message : 'Gagal memulihkan cadangan')
    }
  }

  const handleDelete = async (b: BackupMeta) => {
    if (!window.confirm(`Hapus cadangan ${formatDateTime(b.at)}?`)) return
    setBusy(true)
    try {
      await deleteBackup(b.id)
      refresh()
      showToast('Cadangan dihapus.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus cadangan')
    } finally {
      setBusy(false)
    }
  }

  const last = lastBackupAt()
  const nextDue =
    enabled && last
      ? new Date(new Date(last).getTime() + intervalHours * 3600_000).toISOString()
      : null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Cadangan Otomatis</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Pengaturan penjadwalan */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Jadwal Cadangan Otomatis
          </h2>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-status-occupied"
            />
            <span className="text-sm text-ink">
              Aktifkan cadangan otomatis (snapshot database tersimpan di perangkat)
            </span>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Interval</span>
              <select
                className="field-select"
                value={intervalHours}
                disabled={!enabled}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.h} value={o.h}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Simpan maksimal (cadangan otomatis)</span>
              <input
                type="number"
                min={1}
                max={50}
                className="field-input"
                value={keep}
                disabled={!enabled}
                onChange={(e) => setKeep(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={saveConfig}>Simpan Pengaturan</Button>
            <Button variant="ghost" onClick={handleBackupNow} disabled={busy}>
              💾 Cadangkan Sekarang
            </Button>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-background px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                Cadangan Terakhir
              </p>
              <p className="mt-0.5 font-semibold text-ink">
                {last ? formatDateTime(last) : 'Belum ada'}
              </p>
            </div>
            <div className="rounded-xl bg-background px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                Jadwal Berikutnya
              </p>
              <p className="mt-0.5 font-semibold text-ink">
                {nextDue ? formatDateTime(nextDue) : enabled ? 'Saat aplikasi dibuka' : '— (nonaktif)'}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            Penjadwal berjalan saat aplikasi terbuka: setiap membuka aplikasi (dan berkala tiap
            beberapa menit), bila sudah melewati interval, cadangan baru dibuat otomatis. Cadangan
            otomatis terlama dipangkas sesuai batas di atas. Cadangan manual tidak ikut dipangkas.
          </p>
        </section>

        {/* Daftar cadangan */}
        <section className="overflow-hidden rounded-card bg-panel shadow-card">
          <h2 className="border-b border-line/5 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Riwayat Cadangan · {backups.length}
          </h2>
          {backups.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">
              Belum ada cadangan. Aktifkan jadwal atau tekan “Cadangkan Sekarang”.
            </p>
          ) : (
            <ul className="divide-y divide-line/5">
              {backups.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      {formatDateTime(b.at)}
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                          (b.auto
                            ? 'bg-brand-soft text-ink'
                            : 'bg-status-empty/15 text-status-empty')
                        }
                      >
                        {b.auto ? 'Otomatis' : 'Manual'}
                      </span>
                    </p>
                    <p className="text-xs text-ink-soft">{formatBytes(b.size)}</p>
                  </div>
                  <Button variant="quiet" size="sm" onClick={() => handleDownload(b)}>
                    ⬇️ Unduh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(b)}
                    disabled={busy}
                  >
                    ♻️ Pulihkan
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(b)}
                    disabled={busy}
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 snackbar">{toast}</div>
      )}
    </div>
  )
}
