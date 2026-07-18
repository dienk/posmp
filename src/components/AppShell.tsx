import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../lib/SettingsContext'
import { isModuleEnabled } from '../lib/settings'
import { useConnection } from '../lib/useConnection'

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
  { to: '/history', label: 'Riwayat', icon: '🧾' },
  { to: '/vouchers', label: 'Voucher', icon: '🎟️' },
  { to: '/marketplace', label: 'Channel', icon: '🛍️', moduleKey: 'module_marketplace' },
  { to: '/reports', label: 'Laporan', icon: '📊' },
]

export default function AppShell() {
  const { settings } = useSettings()
  const conn = useConnection()
  const items = NAV.filter((n) => !n.moduleKey || isModuleEnabled(settings, n.moduleKey))

  return (
    <div className="flex h-full">
      <nav className="flex w-20 flex-col items-center gap-1 bg-white/80 py-4 backdrop-blur">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-status-occupied text-xs font-bold text-white">
          PMP
        </div>
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              'flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ' +
              (isActive ? 'bg-brand text-ink shadow' : 'text-ink-soft hover:bg-brand-soft')
            }
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <ConnectionBadge online={conn.online} relay={conn.relay} pending={conn.pending} />
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function ConnectionBadge({
  online,
  relay,
  pending,
}: {
  online: boolean
  relay: string
  pending: number
}) {
  const relayOn = relay === 'connected'
  return (
    <div className="mt-auto flex flex-col items-center gap-1.5 pt-3 text-[10px] text-ink-soft">
      <span className="flex items-center gap-1" title={online ? 'Online' : 'Offline'}>
        <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-empty' : 'bg-status-occupied'}`} />
        {online ? 'Online' : 'Offline'}
      </span>
      <span className="flex items-center gap-1" title={`Relay LAN: ${relay}`}>
        <span
          className={`h-2 w-2 rounded-full ${relayOn ? 'bg-status-empty' : 'bg-ink-soft/50'}`}
        />
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
