import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { initDatabase } from './db/database'
import { SettingsProvider, useSettings } from './lib/SettingsContext'
import { UIProvider } from './lib/UIContext'
import { applyTheme, parseCustomVars } from './lib/themes'
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
import ThemePage from './features/theme/ThemePage'
import ProductsPage from './features/products/ProductsPage'
import CategoriesPage from './features/products/CategoriesPage'
import ContactsPage from './features/contacts/ContactsPage'
import OutletsPage from './features/outlets/OutletsPage'
import CashiersPage from './features/cashiers/CashiersPage'
import MasterTablesPage from './features/tables/MasterTablesPage'
import WarehousesPage from './features/warehouses/WarehousesPage'
import UnitsPage from './features/units/UnitsPage'
import TaxesPage from './features/taxes/TaxesPage'
import CardDesignPage from './features/membercard/CardDesignPage'

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
      { path: 'stock-opname', element: <StockOpnamePage /> },
      { path: 'stock-card', element: <StockCardPage /> },
      { path: 'stock-opening', element: <StockOpeningPage /> },
      { path: 'preorder', element: <PreorderPage /> },
      { path: 'installments', element: <InstallmentsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'drafts', element: <DraftsPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'reports', element: <LaporanPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'outlets', element: <OutletsPage /> },
      { path: 'cashiers', element: <CashiersPage /> },
      { path: 'master-tables', element: <MasterTablesPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'taxes', element: <TaxesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'personas', element: <PersonaPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'theme', element: <ThemePage /> },
      { path: 'receipt-design', element: <ReceiptDesignPage /> },
      { path: 'card-design', element: <CardDesignPage /> },
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
