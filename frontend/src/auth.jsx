import { createContext, useContext, useEffect, useState } from 'react'
import api from './api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const token = localStorage.getItem('af_token')
    if (!token) { setUser(null); setLoading(false); return }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('af_token', data.access_token)
    await refresh()
  }

  async function signup(name, email, password) {
    const { data } = await api.post('/auth/signup', { name, email, password })
    localStorage.setItem('af_token', data.access_token)
    await refresh()
  }

  function logout() {
    localStorage.removeItem('af_token')
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

// role helpers
export const isAdmin = (u) => u?.role === 'admin'
export const isManager = (u) => u?.role === 'admin' || u?.role === 'asset_manager'
export const canApprove = (u) =>
  ['admin', 'asset_manager', 'department_head'].includes(u?.role)
