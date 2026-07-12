import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({ baseURL: API_URL })

// attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('af_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// bounce to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('af_token')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// pull a readable message out of a FastAPI error response
export function errMsg(err) {
  const d = err?.response?.data?.detail
  if (!d) return err?.message || 'Something went wrong'
  if (typeof d === 'string') return d
  if (typeof d === 'object') return d.message || JSON.stringify(d)
  return String(d)
}

export default api
