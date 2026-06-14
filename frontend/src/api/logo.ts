function getToken(): string | null {
  return localStorage.getItem('pkv_token')
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res
}

export async function uploadLogo(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  await authFetch('/logo', { method: 'POST', body: formData })
}

export async function deleteLogo(): Promise<void> {
  await authFetch('/logo', { method: 'DELETE' })
}

export const LOGO_URL = '/api/logo'
