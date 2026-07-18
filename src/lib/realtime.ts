/**
 * Bus real-time local-first berbasis BroadcastChannel.
 *
 * Menyiarkan event perubahan antar-layar (Kasir, KDS, Self-Order, Monitor) yang
 * berjalan pada origin/perangkat yang sama — latensi < 1ms, tanpa internet.
 * Pada Milestone 4 lapisan transport ini dipetakan ke WebSocket relay LAN agar
 * sinkron lintas perangkat dalam satu jaringan lokal.
 */

export type RealtimeEvent =
  | 'kds:update' // tiket dapur berubah (order baru / status masak)
  | 'queue:update' // antrean berubah
  | 'tables:update' // status meja berubah
  | 'order:update' // transaksi dibuat/diubah

const CHANNEL_NAME = 'posmerahputih'

let channel: BroadcastChannel | null = null
// Pelanggan pada konteks yang sama. BroadcastChannel TIDAK mengirim pesan kembali
// ke pengirimnya sendiri, jadi kita simpan registry lokal agar layar yang memicu
// perubahan juga ikut menyegarkan tampilannya.
const localListeners = new Map<RealtimeEvent, Set<() => void>>()

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/** Siarkan sebuah event ke semua layar (lintas-tab) dan pelanggan lokal (tab ini). */
export function publish(event: RealtimeEvent): void {
  getChannel()?.postMessage({ event, at: Date.now() })
  localListeners.get(event)?.forEach((fn) => fn())
}

/** Berlangganan satu jenis event. Mengembalikan fungsi unsubscribe. */
export function subscribe(event: RealtimeEvent, handler: () => void): () => void {
  // Registry lokal (self-delivery)
  let set = localListeners.get(event)
  if (!set) {
    set = new Set()
    localListeners.set(event, set)
  }
  set.add(handler)

  // Lintas-tab via BroadcastChannel
  const ch = getChannel()
  const listener = ch
    ? (e: MessageEvent) => {
        if (e.data?.event === event) handler()
      }
    : null
  if (ch && listener) ch.addEventListener('message', listener)

  return () => {
    set?.delete(handler)
    if (ch && listener) ch.removeEventListener('message', listener)
  }
}
