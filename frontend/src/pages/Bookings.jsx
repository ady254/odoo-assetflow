import { useEffect, useState } from 'react'
import { CalendarPlus, XCircle } from 'lucide-react'
import api, { errMsg } from '../api'
import { Badge, Modal, Field, Empty } from '../components/ui'

export default function Bookings() {
  const [resources, setResources] = useState([])
  const [selected, setSelected] = useState('')
  const [bookings, setBookings] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState(null)

  async function loadResources() {
    const { data } = await api.get('/bookings/resources')
    setResources(data)
    if (data.length && !selected) setSelected(String(data[0].id))
  }
  async function loadBookings() {
    if (!selected) return
    const { data } = await api.get(`/bookings/resource/${selected}`)
    setBookings(data)
  }
  useEffect(() => { loadResources() }, [])
  useEffect(() => { loadBookings() }, [selected])

  async function cancel(id) {
    await api.post(`/bookings/${id}/cancel`); loadBookings()
  }

  const resource = resources.find(r => String(r.id) === String(selected))

  return (
    <div>
      {msg && <div className={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="muted">Resource:</span>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ width: 260 }}>
            {resources.map(r => <option key={r.id} value={r.id}>{r.asset_tag} — {r.name}</option>)}
          </select>
        </div>
        <button className="btn" disabled={!selected} onClick={() => setShowForm(true)}><CalendarPlus size={16} /> New Booking</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {!resource ? <Empty text="No bookable resources yet. Mark an asset as shared/bookable." /> :
          bookings.length === 0 ? <Empty text={`No bookings for ${resource.name}`} /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Booked by</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
            <tbody>{bookings.map(b => (
              <tr key={b.id}>
                <td>{b.booked_by}</td>
                <td>{new Date(b.start_time).toLocaleString()}</td>
                <td>{new Date(b.end_time).toLocaleString()}</td>
                <td><Badge value={b.status} /></td>
                <td>{b.status !== 'cancelled' && b.status !== 'completed' &&
                  <button className="btn ghost sm" onClick={() => cancel(b.id)}><XCircle size={14} /> Cancel</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {showForm && (
        <BookingModal resource={resource}
          onClose={() => setShowForm(false)}
          onDone={(m) => { setShowForm(false); setMsg(m); loadBookings(); setTimeout(() => setMsg(null), 4000) }} />
      )}
    </div>
  )
}

function BookingModal({ resource, onClose, onDone }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    try {
      await api.post('/bookings', {
        asset_id: resource.id,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
      })
      onDone({ ok: true, text: 'Booking confirmed.' })
    } catch (e) {
      const d = e?.response?.data?.detail
      if (e?.response?.status === 409 && typeof d === 'object')
        setErr(`${d.message} (${new Date(d.conflict_start).toLocaleString()} – ${new Date(d.conflict_end).toLocaleTimeString()})`)
      else setErr(errMsg(e))
    }
  }

  return (
    <Modal title={`Book ${resource.name}`} onClose={onClose}>
      {err && <div className="err">{err}</div>}
      <form onSubmit={save}>
        <Field label="Start"><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></Field>
        <Field label="End"><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required /></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn">Book</button>
        </div>
      </form>
    </Modal>
  )
}
