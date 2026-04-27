const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('pkv_token')
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('pkv_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res
}

export type ExportProvider = 'local' | 'google_drive'

export interface ExportResult {
  provider: string
  exported_files: number
  skipped_invoices: number
  directory: string | null
  folder_url: string | null
}

export async function exportRechnungen(
  rechnungIds: string[],
  provider: ExportProvider = 'local',
): Promise<ExportResult> {
  const res = await authFetch('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rechnung_ids: rechnungIds, provider }),
  })
  return res.json()
}
