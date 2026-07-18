import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { initDatabase } from './db/database'
import { SettingsProvider } from './lib/SettingsContext'
import AppShell from './components/AppShell'
import PosPage from './features/pos/PosPage'
import TablesPage from './features/tables/TablesPage'
import QueuePage from './features/queue/QueuePage'
import QueueMonitor from './features/queue/QueueMonitor'
import KdsPage from './features/kds/KdsPage'
import VoucherPage from './features/vouchers/VoucherPage'
import MarketplacePage from './features/marketplace/MarketplacePage'
import SelfOrderPage from './features/selforder/SelfOrderPage'
import MembersPage from './features/members/MembersPage'
import ReportsPage from './features/reports/ReportsPage'
import StockInPage from './features/stockin/StockInPage'
import HistoryPage from './features/history/HistoryPage'
import PreorderPage from './features/preorder/PreorderPage'
import InstallmentsPage from './features/installments/InstallmentsPage'

// Hash router agar tetap berfungsi saat dibuka sebagai file/native wrapper (Tauri/Capacitor).
const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <PosPage /> },
      { path: 'tables', element: <TablesPage /> },
      { path: 'queue', element: <QueuePage /> },
      { path: 'kds', element: <KdsPage /> },
      { path: 'vouchers', element: <VoucherPage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'stockin', element: <StockInPage /> },
      { path: 'preorder', element: <PreorderPage /> },
      { path: 'installments', element: <InstallmentsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'reports', element: <ReportsPage /> },
    ],
  },
  // Tampilan tanpa shell/navigasi (layar publik & pelanggan).
  { path: '/monitor', element: <QueueMonitor /> },
  { path: '/order/:tableNumber', element: <SelfOrderPage /> },
])

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<BootState>({ phase: 'loading' })

  useEffect(() => {
    let mounted = true
    initDatabase()
      .then(() => mounted && setState({ phase: 'ready' }))
      .catch((err: unknown) => {
        if (!mounted) return
        setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      mounted = false
    }
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="text-sm">Menyiapkan database lokal…</p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-status-occupied">Gagal memuat database</p>
        <p className="max-w-md text-sm text-ink-soft">{state.message}</p>
      </div>
    )
  }

  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  )
}
