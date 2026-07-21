import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { isLoggedIn } from '../../lib/session'

/** Guard rute: arahkan ke /login bila belum login (sesi per tab). */
export default function RequireLogin({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}
