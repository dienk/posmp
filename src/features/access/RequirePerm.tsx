import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSettings } from '../../lib/SettingsContext'
import { effectivePerms } from './accessRepository'

/**
 * Guard rute berbasis hak akses persona aktif. Bila persona tak punya `perm`,
 * arahkan ke Kasir (agar item Setelan sensitif tak bisa dibuka lewat URL, bukan
 * hanya disembunyikan dari sidebar). `effectivePerms` null = tanpa pembatasan.
 */
export default function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { settings } = useSettings()
  const perms = effectivePerms(settings)
  if (perms && !perms.has(perm)) return <Navigate to="/" replace />
  return <>{children}</>
}
