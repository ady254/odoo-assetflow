import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { Empty } from '../components/ui'

const CARDS = [
  { key: 'assets_available', label: 'Assets Available', cls: 'green' },
  { key: 'assets_allocated', label: 'Assets Allocated', cls: '' },
  { key: 'maintenance_today', label: 'Maintenance Today', cls: '' },
  { key: 'active_bookings', label: 'Active Bookings', cls: '' },
  { key: 'pending_transfers', label: 'Pending Transfers', cls: '' },
  { key: 'upcoming_returns', label: 'Upcoming Returns', cls: '' },
]

export default function Dashboard() {
  const nav = useNavigate()
  const [kpis, setKpis] = useState(null)
  const [overdue, setOverdue] = useState([])

  async function load() {
    const [k, o] = await Promise.all([
      api.get('/dashboard/kpis'),
      api.get('/dashboard/overdue'),
    ])
    setKpis(k.data); setOverdue(o.data)
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="quick-actions" style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => nav('/assets')}>+ Register Asset</button>
        <button className="btn secondary" onClick={() => nav('/bookings')}>📅 Book Resource</button>
        <button className="btn secondary" onClick={() => nav('/maintenance')}>🔧 Raise Maintenance</button>
      </div>

      <div className="grid kpi-grid">
        {CARDS.map(c => (
          <div className="kpi" key={c.key}>
            <div className="label">{c.label}</div>
            <div className={`value ${c.cls}`}>{kpis ? kpis[c.key] : '—'}</div>
          </div>
        ))}
        <div className="kpi warn">
          <div className="label">Overdue Returns</div>
          <div className="value red">{kpis ? kpis.overdue_returns : '—'}</div>
        </div>
      </div>

      <div className="section-title">Overdue Returns</div>
      <div className="card" style={{ padding: 0 }}>
        {overdue.length === 0 ? <Empty text="No overdue returns 🎉" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Asset</th><th>Name</th><th>Held by</th><th>Expected return</th><th>Days overdue</th></tr>
              </thead>
              <tbody>
                {overdue.map(o => (
                  <tr key={o.allocation_id}>
                    <td><b>{o.asset_tag}</b></td>
                    <td>{o.asset_name}</td>
                    <td>{o.employee_name || '—'}</td>
                    <td>{new Date(o.expected_return_date).toLocaleDateString()}</td>
                    <td><span className="badge overdue">{o.days_overdue}d</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
