import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSettings } from '../lib/SettingsContext'
import { isModuleEnabled } from '../lib/settings'
import { useConnection } from '../lib/useConnection'
import { useUI } from '../lib/UIContext'
import { effectivePerms } from '../features/access/accessRepository'

interface NavItem {
  to: string
  label: string
  icon: string
  moduleKey?: string
  perm?: string
}

interface NavChild {
  to: string
  label: string
  short: string
  icon: string
  moduleKey?: string
  perm?: string
}

interface NavGroupDef {
  label: string
  icon: string
  children: NavChild[]
  perm?: string
}

type NavEntry = { kind: 'link'; item: NavItem } | { kind: 'group'; group: NavGroupDef }

// Grup "Data Master" (Produk & Contact).
const DATA_MASTER_GROUP: NavGroupDef = {
  label: 'Data Master',
  icon: '🗂️',
  perm: 'datamaster',
  children: [
    { to: '/outlets', label: 'Outlet', short: 'Outlet', icon: '🏬' },
    { to: '/cashiers', label: 'Kasir', short: 'Kasir', icon: '🧑‍💻' },
    { to: '/warehouses', label: 'Gudang', short: 'Gudang', icon: '🏭' },
    { to: '/master-tables', label: 'Master Meja', short: 'Meja', icon: '🍽️' },
    { to: '/products', label: 'Produk', short: 'Produk', icon: '📦' },
    { to: '/categories', label: 'Kategori Produk', short: 'Kategori', icon: '🏷️' },
    { to: '/units', label: 'Satuan', short: 'Satuan', icon: '📏' },
    { to: '/taxes', label: 'Pajak', short: 'Pajak', icon: '🧮' },
    { to: '/contacts', label: 'Contact', short: 'Contact', icon: '📇' },
  ],
}

// Grup "Transaksi" (Riwayat, Draft, Pre-Order, Cicilan).
const TRANSAKSI_GROUP: NavGroupDef = {
  label: 'Transaksi',
  icon: '💰',
  perm: 'transaksi',
  children: [
    { to: '/history', label: 'Riwayat', short: 'Riwayat', icon: '🧾' },
    { to: '/drafts', label: 'Draft', short: 'Draft', icon: '📝' },
    { to: '/preorder', label: 'Pre-Order', short: 'Pre-Order', icon: '📅' },
    { to: '/installments', label: 'Cicilan', short: 'Cicilan', icon: '💳' },
    { to: '/tables', label: 'Meja', short: 'Meja', icon: '🍽️', moduleKey: 'module_table_layout', perm: 'tables' },
    { to: '/queue', label: 'Antrean', short: 'Antrean', icon: '🔔', moduleKey: 'module_queue', perm: 'queue' },
  ],
}

// Grup "Stock" (stok masuk, opname, kartu stock).
const STOCK_GROUP: NavGroupDef = {
  label: 'Stock',
  icon: '📦',
  perm: 'stockin',
  children: [
    { to: '/stock-opening', label: 'Saldo Awal', short: 'Saldo', icon: '🏁' },
    { to: '/stockin', label: 'Stok Masuk', short: 'Masuk', icon: '📥' },
    { to: '/stock-opname', label: 'Stock Opname', short: 'Opname', icon: '📋' },
    { to: '/stock-card', label: 'Kartu Stock', short: 'Kartu', icon: '🗃️' },
  ],
}

// Grup "Setelan" (selalu tampil agar pengaturan tidak terkunci).
const SETTINGS_GROUP: NavGroupDef = {
  label: 'Setelan',
  icon: '⚙️',
  children: [
    { to: '/settings', label: 'Pengaturan', short: 'Setelan', icon: '🛠️' },
    { to: '/personas', label: 'Persona', short: 'Persona', icon: '🧑‍💼' },
    { to: '/roles', label: 'Peran & Hak Akses', short: 'Akses', icon: '🔑' },
    { to: '/theme', label: 'Tema', short: 'Tema', icon: '🎨' },
    { to: '/receipt-design', label: 'Desain Struk', short: 'Struk', icon: '🖨️' },
    { to: '/card-design', label: 'Desain Kartu', short: 'Kartu', icon: '🪪' },
    { to: '/database', label: 'Koneksi Database', short: 'Database', icon: '🗄️' },
  ],
}

const SIDEBAR: NavEntry[] = [
  { kind: 'link', item: { to: '/', label: 'Kasir', icon: '🧾', perm: 'kasir' } },
  { kind: 'group', group: DATA_MASTER_GROUP },
  { kind: 'group', group: TRANSAKSI_GROUP },
  { kind: 'link', item: { to: '/kds', label: 'Dapur', icon: '👨‍🍳', moduleKey: 'module_kds', perm: 'kds' } },
  { kind: 'link', item: { to: '/members', label: 'Member', icon: '⭐', perm: 'members' } },
  { kind: 'group', group: STOCK_GROUP },
  { kind: 'link', item: { to: '/vouchers', label: 'Voucher', icon: '🎟️', perm: 'vouchers' } },
  { kind: 'link', item: { to: '/marketplace', label: 'Channel', icon: '🛍️', moduleKey: 'module_marketplace', perm: 'marketplace' } },
  { kind: 'link', item: { to: '/dashboard', label: 'Dashboard', icon: '📊', perm: 'reports' } },
  { kind: 'link', item: { to: '/reports', label: 'Laporan', icon: '📋', perm: 'reports' } },
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
                <span className="text-xl leading-none">{n.icon}</span>
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
            <span className="text-xl leading-none">{c.icon}</span>
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
        <span className="text-xl leading-none">{group.icon}</span>
        <span className="flex-1 text-left">{group.label}</span>
        <span className="text-xs">{expanded ? '▾' : '▸'}</span>
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
              <span className="text-base leading-none">{c.icon}</span>
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
