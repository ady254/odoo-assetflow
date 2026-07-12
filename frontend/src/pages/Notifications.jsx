import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth, canApprove } from '../auth'
import { Empty } from '../components/ui'

export default function Notifications() {
  const { user } = useAuth()
  const [tab, setTab] = useState('notifs')
  const [notifs, setNotifs] = useState([])
  const [logs, setLogs] = useState([])

  async function load() {
    const { data } = await api.get('/notifications')
    setNotifs(data)
    if (canApprove(user)) {
      try { const l = await api.get('/notifications/activity'); setLogs(l.data) } catch {}
    }
  }
  useEffect(() => { load() }, [])

  async function markAll() { await api.post('/notifications/read-all'); load() }
  async function markRead(id) { await api.post(`/notifications/${id}/read`); load() }

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'notifs' ? 'active' : ''}`} onClick={() => setTab('notifs')}>
          Notifications {notifs.filter(n => !n.is_read).length > 0 && `(${notifs.filter(n => !n.is_read).length})`}
        </div>
        {canApprove(user) && <div className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>Activity Log</div>}
      </div>

      {tab === 'notifs' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="spread" style={{ padding: 12 }}>
            <b>Your notifications</b>
            <button className="btn secondary sm" onClick={markAll}>Mark all read</button>
          </div>
          {notifs.length === 0 ? <Empty text="No notifications" /> : notifs.map(n => (
            <div key={n.id} className={'notif-item' + (n.is_read ? '' : ' unread')} onClick={() => !n.is_read && markRead(n.id)}>
              {!n.is_read && <div className="dot" />}
              <div style={{ flex: 1 }}>
                <div>{n.message}</div>
                <div className="muted" style={{ fontSize: 12 }}>{n.type} · {new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div className="card" style={{ padding: 0 }}>
          {logs.length === 0 ? <Empty text="No activity yet" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Who</th><th>Action</th><th>Entity</th><th>Details</th><th>When</th></tr></thead>
              <tbody>{logs.map(l => (
                <tr key={l.id}>
                  <td>{l.user}</td>
                  <td>{l.action}</td>
                  <td>{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                  <td>{l.details || '—'}</td>
                  <td className="muted">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
    </div>
  )
}
