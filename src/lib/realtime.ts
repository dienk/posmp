/**
 * Bus real-time local-first berlapis (Milestone 4).
 *
 * Transport (dari cakupan sempit ke luas):
 *  1. Local listeners  — pelanggan pada tab yang sama (self-delivery).
 *  2. BroadcastChannel — antar-tab pada origin/perangkat yang sama.
 *  3. WebSocket relay  — LINTAS-PERANGKAT dalam satu LAN (server/relay.mjs).
 *
 * Ketiganya idempoten (handler hanya me-reload data), jadi pesan yang tiba dari
 * lebih dari satu jalur aman. Bila relay tidak aktif, aplikasi tetap berjalan
 * penuh dengan dua transport pertama — tanpa internet sama sekali.
 */

export type RealtimeEvent =
  | 'kds:update'
  | 'queue:update'
  | 'tables:update'
  | 'order:update'

export type RelayStatus = 'connecting' | 'connected' | 'disconnected'

const CHANNEL_NAME = 'posmerahputih'
const DEFAULT_RELAY_PORT = 7071
const RELAY_CONFIG_KEY = 'posmp_relay_config'

let channel: BroadcastChannel | null = null
const localListeners = new Map<RealtimeEvent, Set<() => void>>()

// --- Konfigurasi relay LAN (disimpan di localStorage, sinkron saat boot) -----
export interface RelayConfig {
  enabled: boolean
  /** Host relay; kosong = pakai hostname halaman saat ini (auto). */
  host: string
  port: number
}

const DEFAULT_RELAY_CONFIG: RelayConfig = { enabled: true, host: '', port: DEFAULT_RELAY_PORT }

/** Baca konfigurasi relay dari localStorage (fallback ke default). */
export function getRelayConfig(): RelayConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_RELAY_CONFIG }
  try {
    const raw = localStorage.getItem(RELAY_CONFIG_KEY)
    if (!raw) return { ...DEFAULT_RELAY_CONFIG }
    const c = JSON.parse(raw)
    return {
      enabled: c.enabled !== false,
      host: typeof c.host === 'string' ? c.host.trim() : '',
      port: Number.isFinite(c.port) && c.port > 0 ? Math.floor(c.port) : DEFAULT_RELAY_PORT,
    }
  } catch {
    return { ...DEFAULT_RELAY_CONFIG }
  }
}

/** Simpan konfigurasi relay lalu sambungkan ulang dengan pengaturan baru. */
export function setRelayConfig(cfg: RelayConfig): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(
      RELAY_CONFIG_KEY,
      JSON.stringify({ enabled: cfg.enabled, host: cfg.host.trim(), port: cfg.port }),
    )
  }
  reconnectRelay()
}

// --- WebSocket relay LAN -----------------------------------------------------
let ws: WebSocket | null = null
let relayStatus: RelayStatus = 'disconnected'
let reconnectTimer: number | null = null
const statusListeners = new Set<(s: RelayStatus) => void>()

/** URL relay efektif berdasarkan konfigurasi; null bila relay dinonaktifkan. */
export function relayUrl(): string | null {
  if (typeof window === 'undefined') return null
  const cfg = getRelayConfig()
  if (!cfg.enabled) return null
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const host = cfg.host || location.hostname || 'localhost'
  return `${proto}://${host}:${cfg.port}`
}

function setRelayStatus(s: RelayStatus): void {
  if (relayStatus === s) return
  relayStatus = s
  statusListeners.forEach((fn) => fn(s))
}

function connectRelay(): void {
  const url = relayUrl()
  if (!url || typeof WebSocket === 'undefined') {
    setRelayStatus('disconnected')
    return
  }
  try {
    setRelayStatus('connecting')
    ws = new WebSocket(url)
  } catch {
    scheduleReconnect()
    return
  }
  ws.onopen = () => setRelayStatus('connected')
  ws.onmessage = (e) => {
    try {
      const { event } = JSON.parse(e.data)
      if (event) localListeners.get(event as RealtimeEvent)?.forEach((fn) => fn())
    } catch {
      /* abaikan frame tak dikenal */
    }
  }
  ws.onclose = () => {
    ws = null
    setRelayStatus('disconnected')
    scheduleReconnect()
  }
  ws.onerror = () => ws?.close()
}

function scheduleReconnect(): void {
  if (reconnectTimer != null || typeof window === 'undefined') return
  // Jangan jadwalkan bila relay dinonaktifkan lewat konfigurasi.
  if (!getRelayConfig().enabled) return
  // Coba sambung ulang berkala; relay bisa dinyalakan kapan saja.
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectRelay()
  }, 4000)
}

/** Putuskan koneksi relay saat ini lalu sambungkan ulang dengan konfigurasi terbaru. */
export function reconnectRelay(): void {
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    // Cegah onclose menjadwalkan reconnect ganda; tutup manual lalu sambung ulang.
    ws.onclose = null
    ws.onerror = null
    try {
      ws.close()
    } catch {
      /* abaikan */
    }
    ws = null
  }
  setRelayStatus('disconnected')
  connectRelay()
}

export function getRelayStatus(): RelayStatus {
  return relayStatus
}

export function subscribeRelayStatus(handler: (s: RelayStatus) => void): () => void {
  statusListeners.add(handler)
  handler(relayStatus)
  return () => statusListeners.delete(handler)
}

// Sambungkan sekali saat modul dimuat di browser.
if (typeof window !== 'undefined') connectRelay()

// --- BroadcastChannel --------------------------------------------------------
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

// --- API publik --------------------------------------------------------------

/** Siarkan event ke semua transport: tab ini, antar-tab, dan lintas-perangkat LAN. */
export function publish(event: RealtimeEvent): void {
  const msg = { event, at: Date.now() }
  getChannel()?.postMessage(msg)
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  localListeners.get(event)?.forEach((fn) => fn())
}

/** Berlangganan satu jenis event dari semua transport. Mengembalikan unsubscribe. */
export function subscribe(event: RealtimeEvent, handler: () => void): () => void {
  let set = localListeners.get(event)
  if (!set) {
    set = new Set()
    localListeners.set(event, set)
  }
  set.add(handler)

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
