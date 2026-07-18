import { useEffect, useState } from 'react'
import { getRelayStatus, subscribeRelayStatus, type RelayStatus } from './realtime'
import { getPending, isOnline, subscribeQueue } from './syncQueue'

export interface ConnectionState {
  online: boolean
  relay: RelayStatus
  pending: number
}

/** Pantau status jaringan internet, relay LAN, dan jumlah antrean sinkronisasi. */
export function useConnection(): ConnectionState {
  const [online, setOnline] = useState(isOnline)
  const [relay, setRelay] = useState<RelayStatus>(getRelayStatus)
  const [pending, setPending] = useState(() => getPending().length)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const unsubRelay = subscribeRelayStatus(setRelay)
    const unsubQueue = subscribeQueue(() => setPending(getPending().length))
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsubRelay()
      unsubQueue()
    }
  }, [])

  return { online, relay, pending }
}
