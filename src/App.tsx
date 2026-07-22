import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { initDatabase } from './db/database'
import { SettingsProvider, useSettings } from './lib/SettingsContext'
import { UIProvider } from './lib/UIContext'
import { applyTheme, parseCustomVars } from './lib/themes'
import AppShell from './components/AppShell'
import LoginPage from './features/auth/LoginPage'
import RequireLogin from './features/auth/RequireLogin'
import PosPage from './features/pos/PosPage'
import KasirPinGate from './features/access/KasirPinGate'
import TablesPage from './features/tables/TablesPage'
import QueuePage from './features/queue/QueuePage'
import QueueMonitor from './features/queue/QueueMonitor'
import KdsPage from './features/kds/KdsPage'
import VoucherPage from './features/vouchers/VoucherPage'
import MarketplacePage from './features/marketplace/MarketplacePage'
import SelfOrderPage from './features/selforder/SelfOrderPage'
import MembersPage from './features/members/MembersPage'
import DashboardPage from './features/reports/DashboardPage'
import LaporanPage from './features/reports/LaporanPage'
import StockInPage from './features/stockin/StockInPage'
import StockOpnamePage from './features/stockopname/StockOpnamePage'
import StockCardPage from './features/stockcard/StockCardPage'
import StockOpeningPage from './features/stockopening/StockOpeningPage'
import HistoryPage from './features/history/HistoryPage'
import DraftsPage from './features/drafts/DraftsPage'
import PreorderPage from './features/preorder/PreorderPage'
import InstallmentsPage from './features/installments/InstallmentsPage'
import SettingsPage from './features/settings/SettingsPage'
import ReceiptDesignPage from './features/receipt/ReceiptDesignPage'
import PersonaPage from './features/access/PersonaPage'
import RolesPage from './features/access/RolesPage'
import RequirePerm from './features/access/RequirePerm'
import ThemePage from './features/theme/ThemePage'
import BackupPage from './features/backup/BackupPage'
import { runScheduledBackup } from './features/backup/backupRepository'
import ProductsPage from './features/products/ProductsPage'
import BundlesPage from './features/bundles/BundlesPage'
import CategoriesPage from './features/products/CategoriesPage'
import ContactsPage from './features/contacts/ContactsPage'
import OutletsPage from './features/outlets/OutletsPage'
import CashiersPage from './features/cashiers/CashiersPage'
import MasterTablesPage from './features/tables/MasterTablesPage'
import WarehousesPage from './features/warehouses/WarehousesPage'
import UnitsPage from './features/units/UnitsPage'
import TaxesPage from './features/taxes/TaxesPage'
import CardDesignPage from './features/membercard/CardDesignPage'
import DatabaseConnectionPage from './features/connection/DatabaseConnectionPage'
import OperatingSchedulePage from './features/schedule/OperatingSchedulePage'
import CashBalancePage from './features/cash/CashBalancePage'
import KioskInfoPage from './features/kiosk/KioskInfoPage'
import KioskOrderPage from './features/kiosk/KioskOrderPage'
import KioskQueuePage from './features/kiosk/KioskQueuePage'
import SharedReceiptPage from './features/share/SharedReceiptPage'
import SharedMemberPage from './features/share/SharedMemberPage'

// Hash router agar tetap berfungsi saat dibuka sebagai file/native wrapper (Tauri/Capacitor).
const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireLogin>
        <AppShell />
      </RequireLogin>
    ),
    children: [
      {
        index: true,
        element: (
          <KasirPinGate>
            <PosPage />
          </KasirPinGate>
        ),
      },
      { path: 'tables', element: <TablesPage /> },
      { path: 'queue', element: <QueuePage /> },
      { path: 'kds', element: <KdsPage /> },
      { path: 'vouchers', element: <VoucherPage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'stockin', element: <StockInPage /> },
      { path: 'stock-opname', element: <StockOpnamePage /> },
      { path: 'stock-card', element: <StockCardPage /> },
      { path: 'stock-opening', element: <StockOpeningPage /> },
      { path: 'preorder', element: <PreorderPage /> },
      { path: 'installments', element: <InstallmentsPage /> },
      { path: 'cash-balance', element: <CashBalancePage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'drafts', element: <DraftsPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'reports', element: <LaporanPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'bundles', element: <BundlesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'outlets', element: <OutletsPage /> },
      { path: 'cashiers', element: <CashiersPage /> },
      { path: 'master-tables', element: <MasterTablesPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'taxes', element: <TaxesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'personas',
        element: (
          <RequirePerm perm="settings">
            <PersonaPage />
          </RequirePerm>
        ),
      },
      {
        path: 'roles',
        element: (
          <RequirePerm perm="settings">
            <RolesPage />
          </RequirePerm>
        ),
      },
      { path: 'theme', element: <ThemePage /> },
      { path: 'receipt-design', element: <ReceiptDesignPage /> },
      { path: 'card-design', element: <CardDesignPage /> },
      {
        path: 'database',
        element: (
          <RequirePerm perm="settings">
            <DatabaseConnectionPage />
          </RequirePerm>
        ),
      },
      {
        path: 'backup',
        element: (
          <RequirePerm perm="settings">
            <BackupPage />
          </RequirePerm>
        ),
      },
      { path: 'schedule', element: <OperatingSchedulePage /> },
      { path: 'kiosk-info', element: <KioskInfoPage /> },
      { path: 'kiosk-order', element: <KioskOrderPage /> },
      { path: 'kiosk-queue', element: <KioskQueuePage /> },
    ],
  },
  // Tampilan tanpa shell/navigasi (layar publik & pelanggan).
  { path: '/monitor', element: <QueueMonitor /> },
  { path: '/order/:tableNumber', element: <SelfOrderPage /> },
  { path: '/share/receipt/:payload', element: <SharedReceiptPage /> },
  { path: '/share/member/:payload', element: <SharedMemberPage /> },
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
      <div className="flex h-full flex-col items-center justify-center gap-4 text-ink">
        <img src="/logo-mark.png" alt="POS Merah Putih" className="h-24 w-24 rounded-2xl" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
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
      <ThemeApplier />
      <BackupScheduler />
      <UIProvider>
        <RouterProvider router={router} />
      </UIProvider>
    </SettingsProvider>
  )
}

/** Terapkan tema tersimpan saat muat & setiap kali pilihan tema berubah. */
function ThemeApplier() {
  const { settings } = useSettings()
  useEffect(() => {
    applyTheme(settings.theme, parseCustomVars(settings.theme_custom))
  }, [settings.theme, settings.theme_custom])
  return null
}

/**
 * Penjadwal cadangan otomatis: cek saat muat lalu berkala (tiap 5 menit) apakah
 * sudah melewati interval; bila ya, buat snapshot & pangkas retensi. Ringan —
 * hanya membaca timestamp localStorage kecuali benar-benar jatuh tempo.
 */
function BackupScheduler() {
  const { settings } = useSettings()
  useEffect(() => {
    let alive = true
    const tick = () => {
      if (!alive) return
      runScheduledBackup(settings).catch(() => {
        /* abaikan kegagalan cadangan agar tak mengganggu aplikasi */
      })
    }
    tick()
    const timer = window.setInterval(tick, 5 * 60_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [settings])
  return null
}
