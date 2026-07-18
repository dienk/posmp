/**
 * Sync Queue offline-first (Milestone 4).
 *
 * Menampung operasi yang butuh internet (mis. push stok ke marketplace) ke dalam
 * outbox lokal. Saat jaringan terputus, operasi mengendap di antrean; saat online
 * kembali, antrean otomatis diproses (flush). Ini menjamin toleransi offline: kasir,
 * KDS, dan transaksi tetap jalan, hanya sinkronisasi eksternal yang ditunda.
 *
 * Penyimpanan: localStorage (sinkron, cukup untuk metadata operasi).
 */

const STORAGE_KEY = 'posmp_sync_queue'

export interface SyncOp {
  id: string
  type: 'STOCK_SYNC'
  channelId: number
  description: string
  createdAt: number
  attempts: number
}

type Listener = () => void
const listeners = new Set<Listener>()

function read(): SyncOp[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function write(ops: SyncOp[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
  listeners.forEach((fn) => fn())
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getPending(): SyncOp[] {
  return read()
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `op_${Date.now().toString(36)}_${idCounter}`
}

/** Masukkan operasi ke antrean, lalu coba proses bila online. */
export function enqueue(op: Omit<SyncOp, 'id' | 'createdAt' | 'attempts'>): void {
  const ops = read()
  ops.push({ ...op, id: nextId(), createdAt: Date.now(), attempts: 0 })
  write(ops)
  if (isOnline()) void flush()
}

let flushing = false

/**
 * Proses seluruh antrean bila online.
 *
 * CATATAN: pengiriman nyata ke API Shopee/Tokopedia/TikTok memerlukan kredensial
 * & adapter tiap platform. Di sini panggilan disimulasikan (delay singkat) agar
 * mekanisme antrean, retry, dan flush dapat diverifikasi tanpa layanan eksternal.
 */
export async function flush(): Promise<void> {
  if (flushing || !isOnline()) return
  flushing = true
  try {
    let ops = read()
    while (ops.length > 0 && isOnline()) {
      const op = ops[0]
      try {
        await simulateSend(op)
        ops = read().filter((o) => o.id !== op.id) // hapus yang sukses
        write(ops)
      } catch {
        // Tandai percobaan dan hentikan putaran; akan dicoba lagi nanti.
        ops[0] = { ...op, attempts: op.attempts + 1 }
        write(ops)
        break
      }
    }
  } finally {
    flushing = false
  }
}

function simulateSend(_op: SyncOp): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300))
}

// Auto-flush saat koneksi kembali online.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    listeners.forEach((fn) => fn())
    void flush()
  })
  window.addEventListener('offline', () => listeners.forEach((fn) => fn()))
}
