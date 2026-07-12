import { NavLink, useLocation } from 'react-router-dom'
import { useAuth, isAdmin } from '../auth'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/assets', label: 'Assets', icon: '📦' },
  { to: '/allocations', label: 'Allocation & Transfer', icon: '🔁' },
  { to: '/bookings', label: 'Resource Booking', icon: '📅' },
  { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  { to: '/audits', label: 'Audits', icon: '✔' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/organization', label: 'Organization', icon: '⚙', adminOnly: true },
]

const TITLES = {
  '/': 'Dashboard', '/assets': 'Asset Registry', '/allocations': 'Allocation & Transfer',
  '/bookings': 'Resource Booking', '/maintenance': 'Maintenance', '/audits': 'Asset Audits',
  '/reports': 'Reports & Analytics', '/notifications': 'Activity & Notifications',
  '/organization': 'Organization Setup',
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
        <nav>
          {NAV.filter(n => !n.adminOnly || isAdmin(user)).map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="name">{user?.name}</div>
          <div className="role">{user?.role?.replace('_', ' ')}</div>
          <button className="btn secondary sm" style={{ marginTop: 10, width: '100%' }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h2>{title}</h2>
          <div className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
