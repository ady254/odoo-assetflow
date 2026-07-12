import { useEffect, useState } from 'react'
import api, { errMsg } from '../api'
import { useAuth, canApprove } from '../auth'
import { Badge, Modal, Field, Empty } from '../components/ui'

export default function Allocations() {
  const { user } = useAuth()
  const [tab, setTab] = useState('active')
  const [rows, setRows] = useState([])
  const [transfers, setTransfers] = useState([])
  const [assets, setAssets] = useState([])
  const [employees, setEmployees] = useState([])
  const [showAlloc, setShowAlloc] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const [a, t] = await Promise.all([
      api.get('/allocations', { params: { active_only: tab !== 'all' } }),
      api.get('/allocations/transfers'),
    ])
    setRows(a.data); setTransfers(t.data)
  }
  useEffect(() => {
    api.get('/assets').then(r => setAssets(r.data))
    api.get('/org/employees').then(r => setEmployees(r.data))
  }, [])
  useEffect(() => { load() }, [tab])

  async function doReturn(assetId) {
    const notes = prompt('Condition check-in notes (optional):') ?? ''
    try { await api.post(`/allocations/${assetId}/return`, { condition_notes: notes }); load() }
    catch (e) { alert(errMsg(e)) }
  }
  async function approveTransfer(id) { await api.post(`/allocations/transfers/${id}/approve`); load() }
  async function rejectTransfer(id) { await api.post(`/allocations/transfers/${id}/reject`); load() }

  const empName = (id) => employees.find(e => e.id === id)?.name || '—'

  return (
    <div>
      {msg && <div className={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ margin: 0, border: 'none' }}>
          <div className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active Allocations</div>
          <div className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All (history)</div>
          <div className={`tab ${tab === 'transfers' ? 'active' : ''}`} onClick={() => setTab('transfers')}>Transfer Requests</div>
        </div>
        {canApprove(user) && tab !== 'transfers' &&
          <button className="btn" onClick={() => setShowAlloc(true)}>+ Allocate Asset</button>}
      </div>

      {tab !== 'transfers' && (
        <div className="card" style={{ padding: 0 }}>
          {rows.length === 0 ? <Empty text="No allocations" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Asset</th><th>Name</th><th>Employee</th><th>Allocated</th><th>Expected return</th><th>Status</th><th></th></tr></thead>
              <tbody>{rows.map(a => (
                <tr key={a.id}>
                  <td><b>{a.asset_tag}</b></td>
                  <td>{a.asset_name}</td>
                  <td>{a.employee_name || '—'}</td>
                  <td>{new Date(a.allocated_at).toLocaleDateString()}</td>
                  <td>{a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : '—'} {a.overdue && <span className="badge overdue">overdue</span>}</td>
                  <td><Badge value={a.status} /></td>
                  <td>{a.status === 'active' && <button className="btn ghost sm" onClick={() => doReturn(a.asset_id)}>Return</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="card" style={{ padding: 0 }}>
          {transfers.length === 0 ? <Empty text="No transfer requests" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Asset</th><th>Requested by</th><th>To employee</th><th>Status</th><th></th></tr></thead>
              <tbody>{transfers.map(t => (
                <tr key={t.id}>
                  <td><b>{t.asset_tag}</b> {t.asset_name}</td>
                  <td>{t.requested_by}</td>
                  <td>{empName(t.to_employee_id)}</td>
                  <td><Badge value={t.status} /></td>
                  <td>{t.status === 'requested' && canApprove(user) && (
                    <div className="row">
                      <button className="btn green sm" onClick={() => approveTransfer(t.id)}>Approve</button>
                      <button className="btn red sm" onClick={() => rejectTransfer(t.id)}>Reject</button>
                    </div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {showAlloc && (
        <AllocateModal assets={assets} employees={employees}
          onClose={() => setShowAlloc(false)}
          onDone={(m) => { setShowAlloc(false); setMsg(m); load(); setTimeout(() => setMsg(null), 4000) }} />
      )}
    </div>
  )
}

function AllocateModal({ assets, employees, onClose, onDone }) {
  const [assetId, setAssetId] = useState('')
  const [empId, setEmpId] = useState('')
  const [ret, setRet] = useState('')
  const [conflict, setConflict] = useState(null)
  const [err, setErr] = useState('')

  async function allocate(e) {
    e.preventDefault()
    setErr(''); setConflict(null)
    try {
      await api.post('/allocations', {
        asset_id: Number(assetId),
        employee_id: empId ? Number(empId) : null,
        expected_return_date: ret ? new Date(ret).toISOString() : null,
      })
      onDone({ ok: true, text: 'Asset allocated successfully.' })
    } catch (e) {
      const d = e?.response?.data?.detail
      if (e?.response?.status === 409 && typeof d === 'object') setConflict(d)
      else setErr(errMsg(e))
    }
  }

  async function requestTransfer() {
    try {
      await api.post('/allocations/transfer', {
        asset_id: Number(assetId),
        to_employee_id: empId ? Number(empId) : null,
      })
      onDone({ ok: true, text: 'Transfer request submitted for approval.' })
    } catch (e) { setErr(errMsg(e)) }
  }

  return (
    <Modal title="Allocate Asset" onClose={onClose}>
      {err && <div className="err">{err}</div>}
      {conflict && (
        <div className="err">
          <b>Conflict:</b> {conflict.message}. {conflict.hint}
          <div style={{ marginTop: 8 }}>
            <button className="btn blue sm" onClick={requestTransfer}>Raise Transfer Request instead</button>
          </div>
        </div>
      )}
      <form onSubmit={allocate}>
        <Field label="Asset">
          <select value={assetId} onChange={e => { setAssetId(e.target.value); setConflict(null) }} required>
            <option value="">Select asset…</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.status})</option>)}
          </select>
        </Field>
        <Field label="Allocate to employee">
          <select value={empId} onChange={e => setEmpId(e.target.value)} required>
            <option value="">Select employee…</option>
            {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>)}
          </select>
        </Field>
        <Field label="Expected return date (optional)">
          <input type="date" value={ret} onChange={e => setRet(e.target.value)} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn">Allocate</button>
        </div>
      </form>
    </Modal>
  )
}
