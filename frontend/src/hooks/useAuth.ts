import { useState } from 'react'
import { login as apiLogin } from '../api/auth'

const TOKEN_KEY = 'pkv_token'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  )

  const login = async (email: string, password: string) => {
    const t = await apiLogin(email, password)
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return { token, isAuthenticated: !!token, login, logout }
}
