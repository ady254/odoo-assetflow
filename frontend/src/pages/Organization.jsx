import { useEffect, useState } from 'react'
import api, { errMsg } from '../api'
import { Badge, Modal, Field, Empty } from '../components/ui'

const ROLES = ['employee', 'department_head', 'asset_manager', 'admin']

export default function Organization() {
  const [tab, setTab] = useState('departments')
  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'departments' ? 'active' : ''}`} onClick={() => setTab('departments')}>Departments</div>
        <div className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Asset Categories</div>
        <div className={`tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Employee Directory</div>
      </div>
      {tab === 'departments' && <Departments />}
      {tab === 'categories' && <Categories />}
      {tab === 'employees' && <Employees />}
    </div>
  )
}

function Departments() {
  const [rows, setRows] = useState([])
  const [emps, setEmps] = useState([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', head_id: '', parent_id: '', status: 'active' })
  const [err, setErr] = useState('')

  async function load() {
    const [d, e] = await Promise.all([api.get('/org/departments'), api.get('/org/employees')])
    setRows(d.data); setEmps(e.data)
  }
  useEffect(() => { load() }, [])

  async function save(ev) {
    ev.preventDefault(); setErr('')
    try {
      await api.post('/org/departments', {
        name: form.name,
        head_id: form.head_id ? Number(form.head_id) : null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        status: form.status,
      })
      setShow(false); setForm({ name: '', head_id: '', parent_id: '', status: 'active' }); load()
    } catch (e) { setErr(errMsg(e)) }
  }
  const empName = (id) => emps.find(e => e.id === id)?.name || '—'

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <b>Departments</b><button className="btn" onClick={() => setShow(true)}>+ Add Department</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Head</th><th>Parent</th><th>Status</th></tr></thead>
            <tbody>{rows.map(d => (
              <tr key={d.id}><td><b>{d.name}</b></td><td>{empName(d.head_id)}</td>
                <td>{d.parent_id ? rows.find(x => x.id === d.parent_id)?.name : '—'}</td>
                <td><Badge value={d.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {show && (
        <Modal title="Add Department" onClose={() => setShow(false)}>
          {err && <div className="err">{err}</div>}
          <form onSubmit={save}>
            <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Department Head">
              <select value={form.head_id} onChange={e => setForm({ ...form, head_id: e.target.value })}>
                <option value="">None</option>
                {emps.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Parent Department (hierarchy)">
              <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}>
                <option value="">None</option>
                {rows.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Categories() {
  const [rows, setRows] = useState([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', extra_fields: '' })
  const [err, setErr] = useState('')

  async function load() { const { data } = await api.get('/org/categories'); setRows(data) }
  useEffect(() => { load() }, [])

  async function save(ev) {
    ev.preventDefault(); setErr('')
    try {
      await api.post('/org/categories', { name: form.name, extra_fields: form.extra_fields || null })
      setShow(false); setForm({ name: '', extra_fields: '' }); load()
    } catch (e) { setErr(errMsg(e)) }
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <b>Asset Categories</b><button className="btn" onClick={() => setShow(true)}>+ Add Category</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Category-specific fields</th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id}><td><b>{c.name}</b></td><td>{c.extra_fields || '—'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {show && (
        <Modal title="Add Category" onClose={() => setShow(false)}>
          {err && <div className="err">{err}</div>}
          <form onSubmit={save}>
            <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Electronics" /></Field>
            <Field label="Optional custom field (e.g. warranty_period)"><input value={form.extra_fields} onChange={e => setForm({ ...form, extra_fields: e.target.value })} /></Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Employees() {
  const [rows, setRows] = useState([])
  const [depts, setDepts] = useState([])

  async function load() {
    const [e, d] = await Promise.all([api.get('/org/employees'), api.get('/org/departments')])
    setRows(e.data); setDepts(d.data)
  }
  useEffect(() => { load() }, [])

  async function promote(id, role) {
    try { await api.post(`/org/employees/${id}/promote`, { role }); load() }
    catch (e) { alert(errMsg(e)) }
  }
  const deptName = (id) => depts.find(d => d.id === id)?.name || '—'

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>This is the only place roles are assigned. Promote an employee to Department Head or Asset Manager.</p>
      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Assign role</th></tr></thead>
            <tbody>{rows.map(u => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td>{u.email}</td>
                <td>{deptName(u.department_id)}</td>
                <td><Badge value={u.role} /></td>
                <td><Badge value={u.status} /></td>
                <td>
                  <select value={u.role} onChange={e => promote(u.id, e.target.value)} style={{ width: 160 }}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
