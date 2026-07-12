import { useEffect, useState } from 'react'
import { Plus, Search, Check, History } from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth, isManager } from '../auth'
import { Badge, Modal, Field, Empty } from '../components/ui'

const STATUSES = ['available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed']

export default function Assets() {
  const { user } = useAuth()
  const [assets, setAssets] = useState([])
  const [cats, setCats] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [history, setHistory] = useState(null)

  async function load() {
    const params = {}
    if (q) params.q = q
    if (status) params.status = status
    if (category) params.category_id = category
    const { data } = await api.get('/assets', { params })
    setAssets(data)
  }
  useEffect(() => { api.get('/org/categories').then(r => setCats(r.data)) }, [])
  useEffect(() => { load() }, [q, status, category])

  const catName = (id) => cats.find(c => c.id === id)?.name || '—'

  async function openHistory(id) {
    const { data } = await api.get(`/assets/${id}/history`)
    setHistory(data)
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="input-icon" style={{ width: 240 }}>
            <Search size={16} />
            <input placeholder="Search tag / name / serial…" value={q}
              onChange={e => setQ(e.target.value)} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 170 }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 150 }}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {isManager(user) && <button className="btn" onClick={() => setShowForm(true)}><Plus size={16} /> Register Asset</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {assets.length === 0 ? <Empty text="No assets found" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Condition</th><th>Location</th><th>Bookable</th><th></th></tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td><b>{a.asset_tag}</b></td>
                    <td>{a.name}</td>
                    <td>{catName(a.category_id)}</td>
                    <td><Badge value={a.status} /></td>
                    <td>{a.condition}</td>
                    <td>{a.location || '—'}</td>
                    <td>{a.is_shared_bookable ? <Check size={16} color="var(--green)" /> : <span className="muted">—</span>}</td>
                    <td><button className="btn ghost sm" onClick={() => openHistory(a.id)}><History size={14} /> History</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <RegisterModal cats={cats} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
      {history && <HistoryModal data={history} onClose={() => setHistory(null)} />}
    </div>
  )
}

function RegisterModal({ cats, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', category_id: cats[0]?.id || '', serial_number: '', location: '', condition: 'good', acquisition_cost: '', is_shared_bookable: false })
  const [err, setErr] = useState('')
  const set = (k, v) => setF({ ...f, [k]: v })

  async function save(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.post('/assets', {
        name: f.name,
        category_id: Number(f.category_id),
        serial_number: f.serial_number || null,
        location: f.location || null,
        condition: f.condition,
        acquisition_cost: f.acquisition_cost ? Number(f.acquisition_cost) : null,
        is_shared_bookable: f.is_shared_bookable,
      })
      onSaved()
    } catch (e) { setErr(errMsg(e)) }
  }

  return (
    <Modal title="Register Asset" onClose={onClose}>
      {err && <div className="err">{err}</div>}
      <form onSubmit={save}>
        <Field label="Name"><input value={f.name} onChange={e => set('name', e.target.value)} required /></Field>
        <div className="form-grid">
          <Field label="Category">
            <select value={f.category_id} onChange={e => set('category_id', e.target.value)} required>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Serial number"><input value={f.serial_number} onChange={e => set('serial_number', e.target.value)} /></Field>
          <Field label="Condition">
            <select value={f.condition} onChange={e => set('condition', e.target.value)}>
              <option>excellent</option><option>good</option><option>fair</option><option>poor</option>
            </select>
          </Field>
          <Field label="Location"><input value={f.location} onChange={e => set('location', e.target.value)} /></Field>
          <Field label="Acquisition cost"><input type="number" value={f.acquisition_cost} onChange={e => set('acquisition_cost', e.target.value)} /></Field>
        </div>
        <label className="row" style={{ margin: '4px 0 16px' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={f.is_shared_bookable} onChange={e => set('is_shared_bookable', e.target.checked)} />
          <span>Shared / bookable resource</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn">Register</button>
        </div>
      </form>
    </Modal>
  )
}

function HistoryModal({ data, onClose }) {
  return (
    <Modal title={`${data.asset.asset_tag} — ${data.asset.name}`} onClose={onClose}>
      <div className="section-title" style={{ marginTop: 0 }}>Allocation history</div>
      {data.allocation_history.length === 0 ? <p className="muted">No allocations yet.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Employee</th><th>From</th><th>Returned</th><th>Status</th></tr></thead>
          <tbody>{data.allocation_history.map(a => (
            <tr key={a.id}><td>{a.employee || '—'}</td>
              <td>{new Date(a.allocated_at).toLocaleDateString()}</td>
              <td>{a.returned_at ? new Date(a.returned_at).toLocaleDateString() : '—'}</td>
              <td><Badge value={a.status} /></td></tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="section-title">Maintenance history</div>
      {data.maintenance_history.length === 0 ? <p className="muted">No maintenance yet.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Issue</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>{data.maintenance_history.map(m => (
            <tr key={m.id}><td>{m.issue}</td><td><Badge value={m.priority} /></td><td><Badge value={m.status} /></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Modal>
  )
}
