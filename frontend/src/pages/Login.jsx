import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
        <p className="auth-sub">Enterprise Asset & Resource Management</p>

        {err && <div className="err">{err}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label className="fld">
              <span>Full name</span>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Doe" />
            </label>
          )}
          <label className="fld">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
          </label>
          <label className="fld">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </label>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Sign-up creates a standard <b>Employee</b> account. Roles are assigned by an Admin.
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 18 }}>
          {mode === 'login' ? (
            <>New here? <a style={{ color: 'var(--purple)', fontWeight: 600 }} onClick={() => { setMode('signup'); setErr('') }}>Create an account</a></>
          ) : (
            <>Have an account? <a style={{ color: 'var(--purple)', fontWeight: 600 }} onClick={() => { setMode('login'); setErr('') }}>Log in</a></>
          )}
        </p>

        <div className="card" style={{ marginTop: 18, background: '#faf9fb', fontSize: 12 }}>
          <b>Demo logins</b>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            admin@assetflow.com / admin123<br />
            manager@assetflow.com / manager123<br />
            priya@assetflow.com / priya123
          </div>
        </div>
      </div>
    </div>
  )
}
