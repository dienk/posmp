import { useEffect, useState } from 'react'
import { useConnection } from '../../lib/useConnection'
import { flush, getPending, subscribeQueue, type SyncOp } from '../../lib/syncQueue'
import {
  addChannel,
  listChannels,
  markSynced,
  removeChannel,
  toggleChannel,
  type MarketplaceChannel,
  type Platform,
} from './marketplaceRepository'

const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: 'SHOPEE', label: 'Shopee', color: 'bg-[#EE4D2D]' },
  { value: 'TOKOPEDIA', label: 'Tokopedia', color: 'bg-[#42B549]' },
  { value: 'TIKTOK', label: 'TikTok Shop', color: 'bg-ink' },
]

export default function MarketplacePage() {
  const [channels, setChannels] = useState<MarketplaceChannel[]>([])
  const [platform, setPlatform] = useState<Platform>('SHOPEE')
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [queue, setQueue] = useState<SyncOp[]>(() => getPending())
  const conn = useConnection()

  const reload = () => setChannels(listChannels())
  useEffect(reload, [])
  useEffect(() => subscribeQueue(() => setQueue(getPending())), [])

  const showToast = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 2500)
  }

  const handleAdd = async () => {
    if (!shopId.trim()) return
    await addChannel(platform, shopId.trim(), shopName.trim() || platform)
    setShopId('')
    setShopName('')
    reload()
  }

  const handleSync = async (c: MarketplaceChannel) => {
    await markSynced(c.id)
    reload()
    showToast(
      conn.online
        ? `Stok ${c.shop_name} dikirim ke antrean sinkronisasi.`
        : `Offline — sinkron ${c.shop_name} ditunda di antrean.`,
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-panel/70 px-5 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-ink">Integrasi Marketplace</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-status-waiting/50 bg-status-waiting/10 px-4 py-3 text-xs text-ink">
          ⚠️ Sinkronisasi nyata memerlukan kredensial API resmi tiap platform. Panel ini
          mengelola konfigurasi channel & pemetaan SKU; pengiriman ke API dijadwalkan pada
          Milestone 4 (dengan Sync Queue offline-first).
        </div>

        {/* Tambah channel */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Hubungkan Toko
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Platform</span>
              <select
                className={inputCls}
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Shop ID</span>
              <input className={inputCls} value={shopId} onChange={(e) => setShopId(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Nama Toko</span>
              <input
                className={inputCls}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </label>
            <button
              onClick={handleAdd}
              className="rounded-xl bg-status-occupied px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              + Hubungkan
            </button>
          </div>
        </section>

        {/* Daftar channel */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Channel Terhubung ({channels.length})
          </h2>
          {channels.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Belum ada channel terhubung.</p>
          ) : (
            <ul className="space-y-2">
              {channels.map((c) => {
                const meta = PLATFORMS.find((p) => p.value === c.platform_name)
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-background px-4 py-3"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white ${meta?.color}`}
                    >
                      {c.platform_name.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {c.shop_name}{' '}
                        <span className="text-xs font-normal text-ink-soft">#{c.shop_id}</span>
                      </p>
                      <p className="text-xs text-ink-soft">
                        {c.mapping_count} SKU dipetakan ·{' '}
                        {c.last_synced_at ? `Sinkron: ${c.last_synced_at}` : 'Belum pernah sinkron'}
                      </p>
                    </div>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                        (c.is_active ? 'bg-status-empty/15 text-status-empty' : 'bg-ink/10 text-ink-soft')
                      }
                    >
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button
                      onClick={() => handleSync(c)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-strong"
                    >
                      Sinkron Stok
                    </button>
                    <button
                      onClick={() => toggleChannel(c.id, !c.is_active).then(reload)}
                      className="rounded-lg border border-line/10 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-panel"
                    >
                      {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => removeChannel(c.id).then(reload)}
                      className="rounded-lg px-2 py-1.5 text-xs font-semibold text-status-occupied hover:bg-status-occupied/10"
                    >
                      Hapus
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Sync Queue (offline-first) */}
        <section className="rounded-card bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Antrean Sinkronisasi
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={
                  'flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ' +
                  (conn.online
                    ? 'bg-status-empty/15 text-status-empty'
                    : 'bg-status-occupied/15 text-status-occupied')
                }
              >
                <span
                  className={`h-2 w-2 rounded-full ${conn.online ? 'bg-status-empty' : 'bg-status-occupied'}`}
                />
                {conn.online ? 'Online' : 'Offline'}
              </span>
              <button
                onClick={() => flush()}
                disabled={!conn.online || queue.length === 0}
                className="rounded-lg bg-brand px-3 py-1 font-semibold text-ink hover:bg-brand-strong disabled:opacity-40"
              >
                Flush Sekarang
              </button>
            </div>
          </div>
          {queue.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">
              Antrean kosong — semua perubahan tersinkron.
            </p>
          ) : (
            <ul className="space-y-2">
              {queue.map((op) => (
                <li
                  key={op.id}
                  className="flex items-center justify-between rounded-xl bg-background px-4 py-2.5 text-sm"
                >
                  <span className="text-ink">{op.description}</span>
                  <span className="text-xs text-ink-soft">
                    {conn.online ? 'mengirim…' : 'menunggu koneksi'}
                    {op.attempts > 0 && ` · ${op.attempts}×`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            Saat offline, operasi menunggu di sini dan otomatis terkirim ketika koneksi pulih.
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

const inputCls =
  'rounded-lg border border-line/10 px-3 py-2 text-sm outline-none focus:border-brand-strong'
