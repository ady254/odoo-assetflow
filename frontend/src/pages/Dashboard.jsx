import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  PackageCheck, UserCheck, Wrench, CalendarDays, ArrowLeftRight,
  CalendarClock, AlertTriangle, Plus, CalendarPlus, Clock,
} from 'lucide-react'
import api from '../api'
import { Empty, stagger, fadeUp } from '../components/ui'

const CARDS = [
  { key: 'assets_available', label: 'Assets Available', Icon: PackageCheck, ib: 'ib-green' },
  { key: 'assets_allocated', label: 'Assets Allocated', Icon: UserCheck, ib: 'ib-blue' },
  { key: 'maintenance_today', label: 'Maintenance Today', Icon: Wrench, ib: 'ib-amber' },
  { key: 'active_bookings', label: 'Active Bookings', Icon: CalendarDays, ib: 'ib-purple' },
  { key: 'pending_transfers', label: 'Pending Transfers', Icon: ArrowLeftRight, ib: 'ib-blue' },
  { key: 'upcoming_returns', label: 'Upcoming Returns', Icon: CalendarClock, ib: 'ib-purple' },
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
      <div className="quick-actions" style={{ marginBottom: 22 }}>
        <button className="btn" onClick={() => nav('/assets')}><Plus size={16} /> Register Asset</button>
        <button className="btn secondary" onClick={() => nav('/bookings')}><CalendarPlus size={16} /> Book Resource</button>
        <button className="btn secondary" onClick={() => nav('/maintenance')}><Wrench size={16} /> Raise Maintenance</button>
      </div>

      <motion.div className="grid kpi-grid" variants={stagger} initial="hidden" animate="show">
        {CARDS.map(c => (
          <motion.div className="kpi" key={c.key} variants={fadeUp}>
            <div className="kpi-top">
              <div className={`icon-badge ${c.ib}`}><c.Icon size={20} /></div>
            </div>
            <div className="label">{c.label}</div>
            <div className="value">{kpis ? kpis[c.key] : '—'}</div>
          </motion.div>
        ))}
        <motion.div className="kpi warn" variants={fadeUp}>
          <div className="kpi-top">
            <div className="icon-badge ib-red"><AlertTriangle size={20} /></div>
          </div>
          <div className="label">Overdue Returns</div>
          <div className="value red">{kpis ? kpis.overdue_returns : '—'}</div>
        </motion.div>
      </motion.div>

      <div className="section-title"><Clock size={17} /> Overdue Returns</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {overdue.length === 0 ? <Empty text="No overdue returns — everything is on track" /> : (
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
                    <td><span className="badge overdue">{o.days_overdue}d overdue</span></td>
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
