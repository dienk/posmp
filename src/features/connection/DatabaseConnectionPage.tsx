import { useEffect, useMemo, useRef, useState } from 'react'
import {
  databaseStats,
  DB_STORAGE,
  exportDatabase,
  importDatabase,
  resetDatabase,
  vacuumDatabase,
  type DbStats,
} from '../../db/database'
import {
  getRelayConfig,
  setRelayConfig,
  subscribeRelayStatus,
  type RelayConfig,
  type RelayStatus,
} from '../../lib/realtime'
import { useSettings } from '../../lib/SettingsContext'
import { updateAppSettings } from '../settings/settingsRepository'

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

const STATUS_META: Record<RelayStatus, { label: string; cls: string }> = {
  connected: { label: 'Terhubung', cls: 'bg-status-empty/15 text-status-empty' },
  connecting: { label: 'Menyambungkan…', cls: 'bg-status-waiting/20 text-status-waiting' },
  disconnected: { label: 'Terputus', cls: 'bg-status-occupied/15 text-status-occupied' },
}

interface StorageInfo {
  persisted: boolean
  usage: number
  quota: number
}

export default function DatabaseConnectionPage() {
  const { settings, reloadSettings } = useSettings()
  const [stats, setStats] = useState<DbStats | null>(null)
  const [relay, setRelay] = useState<RelayConfig>(() => getRelayConfig())
  const [status, setStatus] = useState<RelayStatus>('disconnected')
  const [dbLabel, setDbLabel] = useState(settings.db_label ?? '')
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshStats = () => {
    try {
      setStats(databaseStats())
    } catch {
      /* DB belum siap */
    }
  }

  const loadStorage = async () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return
    try {
      const est = await navigator.storage.estimate()
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false
      setStorage({ persisted, usage: est.usage ?? 0, quota: est.quota ?? 0 })
    } catch {
      /* abaikan */
    }
  }

  useEffect(() => {
    refreshStats()
    loadStorage()
    return subscribeRelayStatus(setStatus)
  }, [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3000)
  }

  // Pratinjau URL relay dari isi form (mencerminkan yang akan disimpan).
  const effectiveUrl = useMemo(() => {
    if (!relay.enabled) return '— (relay nonaktif)'
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const host = relay.host.trim() || location.hostname || 'localhost'
    return `${proto}://${host}:${relay.port}`
  }, [relay])

  const saveRelay = () => {
    setRelayConfig(relay)
    showToast('Pengaturan koneksi relay disimpan.')
  }

  const saveLabel = async () => {
    try {
      await updateAppSettings({ db_label: dbLabel.trim() })
      reloadSettings()
      showToast('Label database disimpan.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan label')
    }
  }

  const requestPersist = async () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      showToast('Peramban tidak mendukung penyimpanan persisten.')
      return
    }
    try {
      const ok = await navigator.storage.persist()
      await loadStorage()
      showToast(
        ok
          ? 'Penyimpanan persisten aktif — data aman dari pembersihan otomatis.'
          : 'Permintaan ditolak peramban. Coba tambahkan situs ini sebagai favorit/PWA.',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal meminta penyimpanan persisten')
    }
  }

  const handleVacuum = async () => {
    setBusy(true)
    try {
      const { before, after } = await vacuumDatabase()
      refreshStats()
      loadStorage()
      const saved = before - after
      showToast(
        saved > 0
          ? `Database dikompakkan · hemat ${formatBytes(saved)} (${formatBytes(before)} → ${formatBytes(after)}).`
          : 'Database sudah rapi — tidak ada ruang untuk dikompakkan.',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengompakkan database')
    } finally {
      setBusy(false)
    }
  }

  const handleBackup = () => {
    try {
      const bytes = exportDatabase()
      // Salin ke ArrayBuffer standar agar tipe cocok dengan BlobPart (hindari SharedArrayBuffer).
      const copy = new Uint8Array(bytes.length)
      copy.set(bytes)
      const blob = new Blob([copy], { type: 'application/x-sqlite3' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const slug =
        (dbLabel.trim() || 'posmp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        'posmp'
      a.href = url
      a.download = `${slug}-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.sqlite`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Cadangan diunduh.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat cadangan')
    }
  }

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (
      !window.confirm(
        `Pulihkan database dari "${file.name}"? Seluruh data saat ini akan DIGANTI oleh isi file cadangan.`,
      )
    )
      return
    setBusy(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      await importDatabase(buf)
      showToast('Database dipulihkan. Memuat ulang…')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      setBusy(false)
      showToast(err instanceof Error ? err.message : 'Gagal memulihkan database')
    }
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        'Reset database ke DATA AWAL? Seluruh transaksi, produk & pengaturan yang tersimpan akan dihapus. Tindakan ini tidak bisa dibatalkan.',
      )
    )
      return
    setBusy(true)
    try {
      await resetDatabase()
      showToast('Database direset. Memuat ulang…')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      setBusy(false)
      showToast(err instanceof Error ? err.message : 'Gagal mereset database')
    }
  }

  const sm = STATUS_META[status]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Koneksi Database</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Status database lokal */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Status Database Lokal
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Mesin" value={DB_STORAGE.engine} />
            <Info label="Penyimpanan" value={`IndexedDB · ${DB_STORAGE.idbName}`} />
            <Info label="Ukuran Data" value={stats ? formatBytes(stats.sizeBytes) : '—'} />
            <Info label="Jumlah Tabel" value={stats ? String(stats.tableCount) : '—'} />
            <Info label="Versi SQLite" value={stats?.sqliteVersion ?? '—'} />
            <Info label="Ukuran Halaman" value={stats ? `${stats.pageSize} B` : '—'} />
            <div className="sm:col-span-2 lg:col-span-2">
              <Info
                label="Mode"
                value="Local-first — data tersimpan di perangkat ini, berfungsi penuh tanpa internet."
              />
            </div>
          </div>
        </section>

        {/* Pengaturan database lokal */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Pengaturan Database Lokal
          </h2>

          {/* Label / identitas database */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Label Database (identitas perangkat; dipakai pada nama file cadangan)
              </span>
              <input
                className={inputCls}
                value={dbLabel}
                onChange={(e) => setDbLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
                placeholder="mis. Kasir Depan / Cabang Bekasi"
              />
            </label>
            <button
              onClick={saveLabel}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-strong"
            >
              Simpan Label
            </button>
          </div>

          {/* Persistensi penyimpanan */}
          <div className="mt-4 rounded-xl bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">Persistensi Penyimpanan</span>
              {storage && (
                <span
                  className={
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                    (storage.persisted
                      ? 'bg-status-empty/15 text-status-empty'
                      : 'bg-status-waiting/20 text-status-waiting')
                  }
                >
                  {storage.persisted ? '● Persisten' : '● Belum persisten'}
                </span>
              )}
              {!storage?.persisted && (
                <button
                  onClick={requestPersist}
                  className="ml-auto rounded-lg bg-status-occupied px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
                >
                  Minta Penyimpanan Persisten
                </button>
              )}
            </div>
            {storage && storage.quota > 0 && (
              <>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-brand-strong"
                    style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  Terpakai {formatBytes(storage.usage)} dari {formatBytes(storage.quota)} (
                  {((storage.usage / storage.quota) * 100).toFixed(1)}%) kuota peramban untuk situs
                  ini.
                </p>
              </>
            )}
            <p className="mt-2 text-xs text-ink-soft">
              Saat persisten, peramban tidak akan menghapus database lokal secara otomatis meski
              penyimpanan menipis. Disarankan untuk perangkat kasir utama.
            </p>
          </div>

          {/* Kompak / VACUUM */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleVacuum}
              disabled={busy}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-ink hover:bg-background disabled:opacity-40"
            >
              🧹 Kompakkan Database (VACUUM)
            </button>
            <p className="text-xs text-ink-soft">
              Merapikan ruang kosong setelah banyak penghapusan agar file lebih kecil.
            </p>
          </div>
        </section>

        {/* Relay LAN — sinkronisasi antar perangkat */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Sinkronisasi Antar-Perangkat (Relay LAN)
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sm.cls}`}>
              ● {sm.label}
            </span>
          </div>

          <label className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={relay.enabled}
              onChange={(e) => setRelay((p) => ({ ...p, enabled: e.target.checked }))}
              className="h-4 w-4 accent-status-occupied"
            />
            <span className="text-sm text-ink">
              Aktifkan relay (sinkron real-time beberapa perangkat dalam satu jaringan)
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Host Relay (kosong = perangkat ini)
              </span>
              <input
                className={inputCls}
                value={relay.host}
                disabled={!relay.enabled}
                onChange={(e) => setRelay((p) => ({ ...p, host: e.target.value }))}
                placeholder={`otomatis (${location.hostname || 'localhost'})`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Port</span>
              <input
                type="number"
                className={inputCls}
                value={relay.port}
                disabled={!relay.enabled}
                onChange={(e) => setRelay((p) => ({ ...p, port: Number(e.target.value) }))}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-background px-3 py-2 text-xs text-ink">{effectiveUrl}</code>
            <button
              onClick={saveRelay}
              className="ml-auto rounded-lg bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              Simpan & Sambungkan Ulang
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Relay berjalan di salah satu perangkat LAN via{' '}
            <code className="rounded bg-background px-1">npm run relay</code> (default port 7071).
            Perangkat lain mengarahkan host ke IP perangkat tersebut. Tanpa relay, aplikasi tetap
            berjalan penuh (data lokal + sinkron antar-tab pada perangkat yang sama).
          </p>
        </section>

        {/* Cadangan & pemulihan */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Cadangan & Pemulihan
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBackup}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
            >
              ⬇️ Unduh Cadangan (.sqlite)
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-ink hover:bg-background disabled:opacity-40"
            >
              ⬆️ Pulihkan dari File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".sqlite,.db,.sqlite3,application/x-sqlite3,application/octet-stream"
              className="hidden"
              onChange={handleRestoreFile}
            />
            <button
              onClick={handleReset}
              disabled={busy}
              className="ml-auto rounded-lg border border-status-occupied/40 px-4 py-2 text-sm font-semibold text-status-occupied hover:bg-status-occupied/10 disabled:opacity-40"
            >
              ♻️ Reset ke Data Awal
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Cadangan berisi seluruh data (produk, transaksi, pengaturan) sebagai satu file SQLite.
            Memulihkan atau mereset akan mengganti data saat ini lalu memuat ulang aplikasi.
          </p>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
