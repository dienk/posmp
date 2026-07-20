import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Archive,
  Armchair,
  Banknote,
  Bell,
  Boxes,
  CalendarClock,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Clock,
  Contact,
  CreditCard,
  Database,
  FileText,
  Flag,
  FolderTree,
  Gift,
  History,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Monitor,
  Package,
  PackagePlus,
  Palette,
  Percent,
  Printer,
  Ruler,
  ScanBarcode,
  ScrollText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  SquareUser,
  Star,
  Store,
  Tags,
  Ticket,
  TicketCheck,
  Utensils,
  Wallet,
  Warehouse,
  ClipboardList,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { useSettings } from '../lib/SettingsContext'
import { isModuleEnabled } from '../lib/settings'
import { useConnection } from '../lib/useConnection'
import { useUI } from '../lib/UIContext'
import { effectivePerms } from '../features/access/accessRepository'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  moduleKey?: string
  perm?: string
}

interface NavChild {
  to: string
  label: string
  short: string
  icon: LucideIcon
  moduleKey?: string
  perm?: string
}

interface NavGroupDef {
  label: string
  icon: LucideIcon
  children: NavChild[]
  perm?: string
}

type NavEntry = { kind: 'link'; item: NavItem } | { kind: 'group'; group: NavGroupDef }

// Grup "Data Master" (Produk & Contact).
const DATA_MASTER_GROUP: NavGroupDef = {
  label: 'Data Master',
  icon: FolderTree,
  perm: 'datamaster',
  children: [
    { to: '/outlets', label: 'Outlet', short: 'Outlet', icon: Store },
    { to: '/cashiers', label: 'Kasir', short: 'Kasir', icon: UserCog },
    { to: '/warehouses', label: 'Gudang', short: 'Gudang', icon: Warehouse },
    { to: '/master-tables', label: 'Master Meja', short: 'Meja', icon: Armchair },
    { to: '/products', label: 'Produk', short: 'Produk', icon: Package },
    { to: '/categories', label: 'Kategori Produk', short: 'Kategori', icon: Tags },
    { to: '/units', label: 'Satuan', short: 'Satuan', icon: Ruler },
    { to: '/taxes', label: 'Pajak', short: 'Pajak', icon: Percent },
    { to: '/contacts', label: 'Contact', short: 'Contact', icon: Contact },
  ],
}

// Grup "Transaksi" (Riwayat, Draft, Pre-Order, Cicilan).
const TRANSAKSI_GROUP: NavGroupDef = {
  label: 'Transaksi',
  icon: Wallet,
  perm: 'transaksi',
  children: [
    { to: '/history', label: 'Riwayat', short: 'Riwayat', icon: History },
    { to: '/cash-balance', label: 'Saldo Kas', short: 'Kas', icon: Banknote },
    { to: '/drafts', label: 'Draft', short: 'Draft', icon: FileText },
    { to: '/preorder', label: 'Pre-Order', short: 'Pre-Order', icon: CalendarClock },
    { to: '/installments', label: 'Cicilan', short: 'Cicilan', icon: CreditCard },
    { to: '/kds', label: 'Dapur', short: 'Dapur', icon: ChefHat, moduleKey: 'module_kds', perm: 'kds' },
    { to: '/tables', label: 'Meja', short: 'Meja', icon: Utensils, moduleKey: 'module_table_layout', perm: 'tables' },
    { to: '/queue', label: 'Antrean', short: 'Antrean', icon: Bell, moduleKey: 'module_queue', perm: 'queue' },
  ],
}

// Grup "Stock" (stok masuk, opname, kartu stock).
const STOCK_GROUP: NavGroupDef = {
  label: 'Stock',
  icon: Boxes,
  perm: 'stockin',
  children: [
    { to: '/stock-opening', label: 'Saldo Awal', short: 'Saldo', icon: Flag },
    { to: '/stockin', label: 'Stok Masuk', short: 'Masuk', icon: PackagePlus },
    { to: '/stock-opname', label: 'Stock Opname', short: 'Opname', icon: ClipboardList },
    { to: '/stock-card', label: 'Kartu Stock', short: 'Kartu', icon: Archive },
  ],
}

// Grup "Loyalitas Pelanggan" (Member & Voucher). Tanpa perm grup —
// tiap anak di-gate sendiri (grup tersembunyi bila tak ada anak yang tampil).
const LOYALTY_GROUP: NavGroupDef = {
  label: 'Loyalitas Pelanggan',
  icon: Gift,
  children: [
    { to: '/members', label: 'Member', short: 'Member', icon: Star, perm: 'members' },
    { to: '/vouchers', label: 'Voucher', short: 'Voucher', icon: Ticket, perm: 'vouchers' },
  ],
}

// Grup "Kiosk" (layar mandiri pelanggan: informasi, pesan-bayar, antrean).
const KIOSK_GROUP: NavGroupDef = {
  label: 'Kiosk',
  icon: Monitor,
  children: [
    { to: '/kiosk-info', label: 'Kiosk Informasi', short: 'Info', icon: Megaphone },
    { to: '/kiosk-order', label: 'Kiosk Pemesanan & Pembayaran', short: 'Pesan', icon: ShoppingCart },
    { to: '/kiosk-queue', label: 'Kiosk Antrian / Check-in', short: 'Antre', icon: TicketCheck },
  ],
}

// Grup "Setelan" (selalu tampil agar pengaturan tidak terkunci).
const SETTINGS_GROUP: NavGroupDef = {
  label: 'Setelan',
  icon: Settings,
  children: [
    { to: '/settings', label: 'Pengaturan', short: 'Setelan', icon: SlidersHorizontal },
    { to: '/schedule', label: 'Jadwal Operasi', short: 'Jadwal', icon: Clock },
    { to: '/personas', label: 'Persona', short: 'Persona', icon: SquareUser },
    { to: '/roles', label: 'Peran & Hak Akses', short: 'Akses', icon: KeyRound },
    { to: '/theme', label: 'Tema', short: 'Tema', icon: Palette },
    { to: '/receipt-design', label: 'Desain Struk', short: 'Struk', icon: Printer },
    { to: '/card-design', label: 'Desain Kartu', short: 'Kartu', icon: IdCard },
    { to: '/database', label: 'Koneksi Database', short: 'Database', icon: Database },
  ],
}

const SIDEBAR: NavEntry[] = [
  { kind: 'link', item: { to: '/', label: 'Kasir', icon: ScanBarcode, perm: 'kasir' } },
  { kind: 'group', group: DATA_MASTER_GROUP },
  { kind: 'group', group: TRANSAKSI_GROUP },
  { kind: 'group', group: LOYALTY_GROUP },
  { kind: 'group', group: STOCK_GROUP },
  { kind: 'link', item: { to: '/marketplace', label: 'Channel', icon: ShoppingBag, moduleKey: 'module_marketplace', perm: 'marketplace' } },
  { kind: 'link', item: { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'reports' } },
  { kind: 'link', item: { to: '/reports', label: 'Laporan', icon: ScrollText, perm: 'reports' } },
  { kind: 'group', group: KIOSK_GROUP },
  { kind: 'group', group: SETTINGS_GROUP },
]

export default function AppShell() {
  const { settings } = useSettings()
  const conn = useConnection()
  const { sidebarOpen, toggleSidebar } = useUI()
  // Izin efektif persona aktif; null = tanpa pembatasan.
  const perms = effectivePerms(settings)

  return (
    <div className="flex h-full">
      <nav
        className={
          'flex flex-col bg-panel/80 py-3 backdrop-blur transition-all duration-200 ' +
          (sidebarOpen ? 'w-52 px-3' : 'w-20 items-center px-2')
        }
      >
        {/* Header: logo + tombol toggle */}
        <div className={'mb-3 flex items-center ' + (sidebarOpen ? 'justify-between' : 'flex-col gap-2')}>
          <div className="flex items-center gap-2">
            <img
              src="/logo-mark.png"
              alt="POS Merah Putih"
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
            {sidebarOpen && <span className="text-sm font-bold text-ink">POSMerahPutih</span>}
          </div>
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}
            className="rounded-lg p-2 text-lg text-ink-soft hover:bg-background hover:text-ink"
          >
            ☰
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {SIDEBAR.map((entry, i) => {
            if (entry.kind === 'group') {
              // Setelan (tanpa perm) selalu tampil; grup lain ikut hak akses.
              if (entry.group.perm && perms && !perms.has(entry.group.perm)) return null
              return <NavGroup key={`g-${i}`} group={entry.group} open={sidebarOpen} />
            }
            const n = entry.item
            if (n.moduleKey && !isModuleEnabled(settings, n.moduleKey)) return null
            if (n.perm && perms && !perms.has(n.perm)) return null
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                title={n.label}
                className={({ isActive }) =>
                  'flex items-center rounded-xl font-medium transition ' +
                  (sidebarOpen
                    ? 'gap-3 px-3 py-2.5 text-sm '
                    : 'flex-col gap-1 py-2 text-[11px] w-16 ') +
                  (isActive ? 'bg-brand text-ink shadow' : 'text-ink-soft hover:bg-brand-soft')
                }
              >
                <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {n.label}
              </NavLink>
            )
          })}
        </div>

        <ConnectionBadge
          open={sidebarOpen}
          online={conn.online}
          relay={conn.relay}
          pending={conn.pending}
        />
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function NavGroup({ group, open }: { group: NavGroupDef; open: boolean }) {
  const location = useLocation()
  const { settings } = useSettings()
  const perms = effectivePerms(settings)
  // Sub-menu ikut gate modul (toggle Pengaturan) & hak akses persona.
  const children = group.children.filter(
    (c) =>
      (!c.moduleKey || isModuleEnabled(settings, c.moduleKey)) &&
      (!c.perm || !perms || perms.has(c.perm)),
  )
  const childActive = children.some((c) => location.pathname === c.to)
  const [expanded, setExpanded] = useState(childActive)
  useEffect(() => {
    if (childActive) setExpanded(true)
  }, [childActive])

  if (children.length === 0) return null

  // Sidebar ringkas: tampilkan sub-menu sebagai ikon datar agar tetap terjangkau.
  if (!open) {
    return (
      <>
        {children.map((c) => (
          <NavLink
            key={c.to}
            to={c.to}
            title={c.label}
            className={({ isActive }) =>
              'flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ' +
              (isActive ? 'bg-brand text-ink shadow' : 'text-ink-soft hover:bg-brand-soft')
            }
          >
            <c.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            {c.short}
          </NavLink>
        ))}
      </>
    )
  }

  // Sidebar terbuka: accordion grup dengan sub-menu ter-indentasi.
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' +
          (childActive ? 'text-ink' : 'text-ink-soft hover:bg-brand-soft')
        }
      >
        <group.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 text-left">{group.label}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-black/10 pl-3">
          {children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              className={({ isActive }) =>
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ' +
                (isActive ? 'bg-brand text-ink shadow' : 'text-ink-soft hover:bg-brand-soft')
              }
            >
              <c.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function ConnectionBadge({
  open,
  online,
  relay,
  pending,
}: {
  open: boolean
  online: boolean
  relay: string
  pending: number
}) {
  const relayOn = relay === 'connected'
  return (
    <div
      className={
        'mt-2 border-t border-black/5 pt-2 text-[10px] text-ink-soft ' +
        (open ? 'flex items-center gap-3 px-1' : 'flex flex-col items-center gap-1.5')
      }
    >
      <span className="flex items-center gap-1" title={online ? 'Online' : 'Offline'}>
        <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-empty' : 'bg-status-occupied'}`} />
        {online ? 'Online' : 'Offline'}
      </span>
      <span className="flex items-center gap-1" title={`Relay LAN: ${relay}`}>
        <span className={`h-2 w-2 rounded-full ${relayOn ? 'bg-status-empty' : 'bg-ink-soft/50'}`} />
        Relay
      </span>
      {pending > 0 && (
        <span
          className="rounded-full bg-status-waiting px-1.5 py-0.5 font-bold text-white"
          title="Operasi menunggu sinkronisasi"
        >
          {pending} antre
        </span>
      )}
    </div>
  )
}
