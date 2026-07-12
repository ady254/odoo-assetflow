import { useEffect, useState } from 'react'
import { Plus, Check, FolderOpen } from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth, isAdmin } from '../auth'
import { Badge, Modal, Field, Empty } from '../components/ui'

export default function Audits() {
  const { user } = useAuth()
  const [cycles, setCycles] = useState([])
  const [open, setOpen] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function load() { const { data } = await api.get('/audits'); setCycles(data) }
  useEffect(() => { load() }, [])

  async function openCycle(id) { const { data } = await api.get(`/audits/${id}`); setOpen(data) }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>Structured verification cycles with auto-generated discrepancy reports.</p>
        {isAdmin(user) && <button className="btn" onClick={() => setShowForm(true)}><Plus size={16} /> New Audit Cycle</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {cycles.length === 0 ? <Empty text="No audit cycles yet" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Scope</th><th>Progress</th><th>Status</th><th></th></tr></thead>
            <tbody>{cycles.map(c => (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td>{c.scope_location || (c.scope_department_id ? `Dept #${c.scope_department_id}` : 'All assets')}</td>
                <td>{c.checked_items}/{c.total_items} checked</td>
                <td><Badge value={c.status} /></td>
                <td><button className="btn ghost sm" onClick={() => openCycle(c.id)}><FolderOpen size={14} /> Open</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {showForm && <CreateModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
      {open && <CycleModal cycle={open} isAdmin={isAdmin(user)} onClose={() => setOpen(null)}
        onChange={() => openCycle(open.id)} onClosed={() => { setOpen(null); load() }} />}
    </div>
  )
}

function CreateModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [employees, setEmployees] = useState([])
  const [auditorIds, setAuditorIds] = useState([])
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/org/employees').then(r => setEmployees(r.data)) }, [])

  async function save(e) {
    e.preventDefault(); setErr('')
    try {
      await api.post('/audits', {
        name, scope_location: location || null, auditor_ids: auditorIds.map(Number),
      })
      onSaved()
    } catch (e) { setErr(errMsg(e)) }
  }

  return (
    <Modal title="Create Audit Cycle" onClose={onClose}>
      {err && <div className="err">{err}</div>}
      <form onSubmit={save}>
        <Field label="Cycle name"><input value={name} onChange={e => setName(e.target.value)} required placeholder="Q3 HQ Floor 2 Audit" /></Field>
        <Field label="Scope: location (blank = all assets)"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="HQ Floor 2" /></Field>
        <Field label="Assign auditors (ctrl/cmd-click for multiple)">
          <select multiple value={auditorIds} style={{ height: 120 }}
            onChange={e => setAuditorIds(Array.from(e.target.selectedOptions, o => o.value))}>
            {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>)}
          </select>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn">Create</button>
        </div>
      </form>
    </Modal>
  )
}

function CycleModal({ cycle, isAdmin, onClose, onChange, onClosed }) {
  async function mark(assetId, result) {
    await api.post(`/audits/${cycle.id}/mark`, { asset_id: assetId, result })
    onChange()
  }
  async function close() {
    if (!confirm('Close this cycle? Missing assets will be marked Lost.')) return
    const { data } = await api.post(`/audits/${cycle.id}/close`)
    alert(`Cycle closed. ${data.assets_marked_lost} asset(s) marked Lost.`)
    onClosed()
  }
  const discrepancies = cycle.items.filter(i => i.result === 'missing' || i.result === 'damaged')

  return (
    <Modal title={`${cycle.name}`} onClose={onClose}>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div><Badge value={cycle.status} /> · Auditors: {cycle.auditors.map(a => a.name).join(', ') || 'none'}</div>
        {isAdmin && cycle.status === 'open' && <button className="btn red sm" onClick={close}>Close Cycle</button>}
      </div>

      <div className="table-wrap"><table>
        <thead><tr><th>Asset</th><th>Result</th>{cycle.status === 'open' && <th>Mark</th>}</tr></thead>
        <tbody>{cycle.items.map(it => (
          <tr key={it.id}>
            <td><b>{it.asset_tag}</b> {it.asset_name}</td>
            <td>{it.result ? <Badge value={it.result} /> : <span className="muted">unchecked</span>}</td>
            {cycle.status === 'open' && (
              <td><div className="row">
                <button className="btn green sm" onClick={() => mark(it.asset_id, 'verified')}><Check size={14} /> Verify</button>
                <button className="btn sm" style={{ background: '#d97706' }} onClick={() => mark(it.asset_id, 'damaged')}>Damaged</button>
                <button className="btn red sm" onClick={() => mark(it.asset_id, 'missing')}>Missing</button>
              </div></td>
            )}
          </tr>
        ))}</tbody>
      </table></div>

      {discrepancies.length > 0 && (
        <>
          <div className="section-title">Discrepancy Report ({discrepancies.length})</div>
          <div className="card" style={{ background: '#fff7ed' }}>
            {discrepancies.map(d => (
              <div key={d.id}>• <b>{d.asset_tag}</b> {d.asset_name} — <Badge value={d.result} /></div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
