import { api } from './client'

export async function login(email: string, password: string): Promise<string> {
  const res = await api.post<{ token: string }>('/auth/login', { email, password })
  return res.token
}
