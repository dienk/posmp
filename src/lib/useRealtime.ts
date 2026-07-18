import { useEffect } from 'react'
import { subscribe, type RealtimeEvent } from './realtime'

/** Jalankan `handler` setiap event realtime diterima (mis. untuk reload data). */
export function useRealtime(event: RealtimeEvent, handler: () => void): void {
  useEffect(() => subscribe(event, handler), [event, handler])
}
