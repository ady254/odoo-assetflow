import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth'
import { errMsg } from '../api'

export default function Login() {
  const { login, signup, user } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) { nav('/', { replace: true }) }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(name, email, password)
      nav('/', { replace: true })
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <div className="logo">AF</div>
          <h1>AssetFlow</h1>
        </div>
        <p className="auth-sub">Enterprise Asset &amp; Resource Management</p>

        {err && <div className="err"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {err}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label className="fld">
              <span>Full name</span>
              <div className="input-icon">
                <User size={16} />
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Doe" />
              </div>
            </label>
          )}
          <label className="fld">
            <span>Email</span>
            <div className="input-icon">
              <Mail size={16} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
          </label>
          <label className="fld">
            <span>Password</span>
            <div className="input-icon">
              <Lock size={16} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
          </label>
          <motion.button className="btn" style={{ width: '100%', marginTop: 6, justifyContent: 'center', padding: '11px' }}
            disabled={busy} whileTap={{ scale: 0.98 }}>
            {mode === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </motion.button>
        </form>

        {mode === 'signup' && (
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Sign-up creates a standard <b>Employee</b> account. Roles are assigned by an Admin.
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 18 }}>
          {mode === 'login' ? (
            <>New here? <a style={{ color: 'var(--purple)', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setMode('signup'); setErr('') }}>Create an account <ArrowRight size={13} style={{ verticalAlign: 'middle' }} /></a></>
          ) : (
            <>Have an account? <a style={{ color: 'var(--purple)', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setMode('login'); setErr('') }}>Log in</a></>
          )}
        </p>

        <div className="card" style={{ marginTop: 18, background: 'var(--purple-50)', fontSize: 12, border: 'none' }}>
          <b>Demo logins</b>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
            admin@assetflow.com / admin123<br />
            manager@assetflow.com / manager123<br />
            priya@assetflow.com / priya123
          </div>
        </div>
      </div>
    </div>
  )
}
