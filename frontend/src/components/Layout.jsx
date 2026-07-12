import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ArrowLeftRight, CalendarDays, Wrench,
  ClipboardCheck, BarChart3, Bell, Settings, LogOut, CalendarClock,
} from 'lucide-react'
import { useAuth, isAdmin } from '../auth'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/assets', label: 'Assets', Icon: Package },
  { to: '/allocations', label: 'Allocation & Transfer', Icon: ArrowLeftRight },
  { to: '/bookings', label: 'Resource Booking', Icon: CalendarDays },
  { to: '/maintenance', label: 'Maintenance', Icon: Wrench },
  { to: '/audits', label: 'Audits', Icon: ClipboardCheck },
  { to: '/reports', label: 'Reports', Icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/organization', label: 'Organization', Icon: Settings, adminOnly: true },
]

const TITLES = {
  '/': 'Dashboard', '/assets': 'Asset Registry', '/allocations': 'Allocation & Transfer',
  '/bookings': 'Resource Booking', '/maintenance': 'Maintenance', '/audits': 'Asset Audits',
  '/reports': 'Reports & Analytics', '/notifications': 'Activity & Notifications',
  '/organization': 'Organization Setup',
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const title = TITLES[loc.pathname] || 'AssetFlow'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">AF</div>
          <h1>AssetFlow</h1>
        </div>
        <nav className="nav">
          {NAV.filter(n => !n.adminOnly || isAdmin(user)).map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div className="nav-pill" layoutId="navpill"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                  <Icon size={18} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="meta">
              <div className="name">{user?.name}</div>
              <div className="role">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
          <button className="btn secondary sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={logout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h2>{title}</h2>
          <div className="date">
            <CalendarClock size={15} />
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </header>
        <main className="content">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
