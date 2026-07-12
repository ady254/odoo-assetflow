export function Badge({ value }) {
  const cls = String(value || '').toLowerCase().replace(/\s+/g, '_')
  return <span className={`badge ${cls}`}>{String(value || '').replace(/_/g, ' ')}</span>
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn secondary sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Empty({ text = 'Nothing here yet' }) {
  return <div className="empty">{text}</div>
}
