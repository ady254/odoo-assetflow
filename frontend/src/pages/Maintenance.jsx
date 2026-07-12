import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth, isManager } from '../auth'
import { Badge, Modal, Field, Empty } from '../components/ui'

export default function Maintenance() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [assets, setAssets] = useState([])
  const [showForm, setShowForm] = useState(false)

  async function load() { const { data } = await api.get('/maintenance'); setRows(data) }
  useEffect(() => { api.get('/assets').then(r => setAssets(r.data)); load() }, [])

  async function act(id, action, body) {
    try { await api.post(`/maintenance/${id}/${action}`, body || {}); load() }
    catch (e) { alert(errMsg(e)) }
  }
  async function assign(id) {
    const tech = prompt('Technician name:')
    if (tech) act(id, 'assign', { technician_name: tech })
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>Pending → Approved → Technician Assigned → In Progress → Resolved</p>
        <button className="btn" onClick={() => setShowForm(true)}><Plus size={16} /> Raise Request</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <Empty text="No maintenance requests" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Asset</th><th>Issue</th><th>Priority</th><th>Raised by</th><th>Technician</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{rows.map(m => (
              <tr key={m.id}>
                <td><b>{m.asset_tag}</b></td>
                <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>{m.issue_description}</td>
                <td><Badge value={m.priority} /></td>
                <td>{m.raised_by}</td>
                <td>{m.technician_name || '—'}</td>
                <td><Badge value={m.status} /></td>
                <td>{isManager(user) && <Actions m={m} act={act} assign={assign} />}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {showForm && <RaiseModal assets={assets} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function Actions({ m, act, assign }) {
  if (m.status === 'pending') return (
    <div className="row">
      <button className="btn green sm" onClick={() => act(m.id, 'approve')}>Approve</button>
      <button className="btn red sm" onClick={() => act(m.id, 'reject')}>Reject</button>
    </div>
  )
  if (m.status === 'approved') return <button className="btn blue sm" onClick={() => assign(m.id)}>Assign Tech</button>
  if (m.status === 'technician_assigned') return <button className="btn blue sm" onClick={() => act(m.id, 'progress')}>Start Work</button>
  if (m.status === 'in_progress') return <button className="btn green sm" onClick={() => act(m.id, 'resolve')}>Resolve</button>
  return <span className="muted">—</span>
}

function RaiseModal({ assets, onClose, onSaved }) {
  const [f, setF] = useState({ asset_id: '', issue_description: '', priority: 'medium' })
  const [err, setErr] = useState('')
  const set = (k, v) => setF({ ...f, [k]: v })

  async function save(e) {
    e.preventDefault(); setErr('')
    try {
      await api.post('/maintenance', {
        asset_id: Number(f.asset_id),
        issue_description: f.issue_description,
        priority: f.priority,
      })
      onSaved()
    } catch (e) { setErr(errMsg(e)) }
  }

  return (
    <Modal title="Raise Maintenance Request" onClose={onClose}>
      {err && <div className="err">{err}</div>}
      <form onSubmit={save}>
        <Field label="Asset">
          <select value={f.asset_id} onChange={e => set('asset_id', e.target.value)} required>
            <option value="">Select asset…</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
          </select>
        </Field>
        <Field label="Describe the issue">
          <textarea rows={3} value={f.issue_description} onChange={e => set('issue_description', e.target.value)} required />
        </Field>
        <Field label="Priority">
          <select value={f.priority} onChange={e => set('priority', e.target.value)}>
            <option>low</option><option>medium</option><option>high</option>
          </select>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn">Submit</button>
        </div>
      </form>
    </Modal>
  )
}
