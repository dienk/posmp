import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../lib/SettingsContext'
import { isModuleEnabled } from '../lib/settings'
import { useConnection } from '../lib/useConnection'
import { useUI } from '../lib/UIContext'

interface NavItem {
  to: string
  label: string
  icon: string
  moduleKey?: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Kasir', icon: '🧾' },
  { to: '/tables', label: 'Meja', icon: '🍽️', moduleKey: 'module_table_layout' },
  { to: '/kds', label: 'Dapur', icon: '👨‍🍳', moduleKey: 'module_kds' },
  { to: '/queue', label: 'Antrean', icon: '🔔', moduleKey: 'module_queue' },
  { to: '/members', label: 'Member', icon: '⭐' },
  { to: '/stockin', label: 'Stok', icon: '📥' },
  { to: '/preorder', label: 'Pre-Order', icon: '📅' },
  { to: '/installments', label: 'Cicilan', icon: '💳' },
  { to: '/history', label: 'Riwayat', icon: '🧾' },
  { to: '/vouchers', label: 'Voucher', icon: '🎟️' },
  { to: '/marketplace', label: 'Channel', icon: '🛍️', moduleKey: 'module_marketplace' },
  { to: '/reports', label: 'Laporan', icon: '📊' },
  { to: '/receipt-design', label: 'Struk', icon: '🖨️' },
  { to: '/settings', label: 'Setelan', icon: '⚙️' },
]

export default function AppShell() {
  const { settings } = useSettings()
  const conn = useConnection()
  const { sidebarOpen, toggleSidebar } = useUI()
  const items = NAV.filter((n) => !n.moduleKey || isModuleEnabled(settings, n.moduleKey))

  return (
    <div className="flex h-full">
      <nav
        className={
          'flex flex-col bg-white/80 py-3 backdrop-blur transition-all duration-200 ' +
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
          {items.map((n) => (
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
              <span className="text-xl leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
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
