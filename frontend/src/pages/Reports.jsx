import { useEffect, useState } from 'react'
import api from '../api'
import { Badge, Empty } from '../components/ui'

export default function Reports() {
  const [r, setR] = useState(null)
  useEffect(() => { api.get('/dashboard/reports').then(res => setR(res.data)) }, [])
  if (!r) return <div className="empty">Loading…</div>

  const maxHeat = Math.max(1, ...Object.values(r.booking_heatmap))
  const topAssets = r.utilization.slice(0, 8)

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Asset Utilization (most used)</div>
        {topAssets.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Asset</th><th>Times allocated</th><th>Status</th></tr></thead>
            <tbody>{topAssets.map(a => (
              <tr key={a.asset_tag}><td><b>{a.asset_tag}</b> {a.asset_name}</td>
                <td>{a.times_allocated}</td><td><Badge value={a.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Idle Assets (never allocated)</div>
        {r.idle_assets.length === 0 ? <Empty text="No idle assets" /> :
          r.idle_assets.map(a => <div key={a.asset_tag}>• <b>{a.asset_tag}</b> {a.asset_name}</div>)}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Maintenance Frequency by Category</div>
        {Object.keys(r.maintenance_by_category).length === 0 ? <Empty /> :
          Object.entries(r.maintenance_by_category).map(([k, v]) => (
            <div className="spread" key={k} style={{ padding: '4px 0' }}><span>{k}</span><b>{v}</b></div>
          ))}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Department Allocation Summary</div>
        {Object.keys(r.department_allocation).length === 0 ? <Empty /> :
          Object.entries(r.department_allocation).map(([k, v]) => (
            <div className="spread" key={k} style={{ padding: '4px 0' }}><span>{k}</span><b>{v} assets</b></div>
          ))}
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="section-title" style={{ marginTop: 0 }}>Resource Booking Heatmap (by hour)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
          {Object.entries(r.booking_heatmap).map(([h, v]) => (
            <div key={h} style={{ flex: 1, textAlign: 'center' }} title={`${h}:00 — ${v} bookings`}>
              <div className="heatbar" style={{ height: `${(v / maxHeat) * 100}%`, opacity: v ? 1 : 0.15 }} />
              <div className="muted" style={{ fontSize: 10 }}>{h}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
