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

export interface Einstellungen {
  paperless_ngx_url?: string
  paperless_ngx_token?: string
  mandant_name?: string
  gdrive_service_account_configured?: boolean
  gdrive_folder_id?: string
  n8n_webhook_url?: string
}

export async function getEinstellungen(): Promise<Einstellungen> {
  const res = await authFetch('/einstellungen')
  return res.json()
}

export async function updateEinstellungen(data: {
  paperless_ngx_url?: string
  paperless_ngx_token?: string
  mandant_name?: string
  gdrive_service_account_json?: string
  gdrive_folder_id?: string
  n8n_webhook_url?: string
}): Promise<void> {
  await authFetch('/einstellungen', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function testPaperlessConnection(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  const res = await authFetch('/einstellungen/paperless-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, token }),
  })
  return res.json()
}

export async function testGdriveConnection(
  serviceAccountJson: string,
  folderId?: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await authFetch('/einstellungen/gdrive-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_account_json: serviceAccountJson, folder_id: folderId }),
  })
  return res.json()
}
