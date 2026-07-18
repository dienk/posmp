import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../lib/SettingsContext'
import { isModuleEnabled } from '../lib/settings'

interface NavItem {
  to: string
  label: string
  icon: string
  moduleKey?: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Kasir', icon: '🧾' },
  { to: '/tables', label: 'Meja', icon: '🍽️', moduleKey: 'module_table_layout' },
  { to: '/queue', label: 'Antrean', icon: '🔔', moduleKey: 'module_queue' },
]

export default function AppShell() {
  const { settings } = useSettings()
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
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
