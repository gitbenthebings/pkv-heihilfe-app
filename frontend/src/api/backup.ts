function getToken(): string | null {
  return localStorage.getItem('pkv_token')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function downloadBackup(): Promise<void> {
  const res = await fetch('/api/backup/download', { headers: authHeaders() })
  if (res.status === 401) {
    localStorage.removeItem('pkv_token')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `pkv_backup_${today}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function restoreBackup(file: File): Promise<{ ok: boolean; message: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/backup/restore', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  if (res.status === 401) {
    localStorage.removeItem('pkv_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}
