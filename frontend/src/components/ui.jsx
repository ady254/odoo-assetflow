import { motion } from 'framer-motion'
import { X, Inbox } from 'lucide-react'

export function Badge({ value }) {
  const cls = String(value || '').toLowerCase().replace(/\s+/g, '_')
  return <span className={`badge ${cls}`}>{String(value || '').replace(/_/g, ' ')}</span>
}

export function Modal({ title, children, onClose }) {
  return (
    <motion.div className="modal-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
        <div className="spread" style={{ marginBottom: 18 }}>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
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

export function Empty({ text = 'Nothing here yet', icon = true }) {
  return (
    <div className="empty">
      {icon && <Inbox size={40} strokeWidth={1.5} />}
      <span>{text}</span>
    </div>
  )
}

export function Spinner() {
  return <div className="center-screen"><div className="spinner" /></div>
}

// staggered list/grid container + item variants for framer-motion
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}
