import type { BescheidAnhang, BescheidVorschlag } from '../types'

const BASE_API = '/api'

function getToken(): string | null {
  return localStorage.getItem('pkv_token')
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_API}${path}`, { ...options, headers })

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

const path = (antragId: string, bescheidId: string) =>
  `/beihilfe-antraege/${antragId}/bescheide/${bescheidId}/anhaenge`

export async function getBescheidAnhaenge(antragId: string, bescheidId: string): Promise<BescheidAnhang[]> {
  const res = await authFetch(path(antragId, bescheidId))
  return res.json()
}

export async function uploadBescheidAnhang(antragId: string, bescheidId: string, file: File): Promise<BescheidAnhang> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const res = await authFetch(path(antragId, bescheidId), { method: 'POST', body: formData })
  return res.json()
}

export async function deleteBescheidAnhang(antragId: string, bescheidId: string, anhangId: string): Promise<void> {
  await authFetch(`${path(antragId, bescheidId)}/${anhangId}`, { method: 'DELETE' })
}

export async function fetchBescheidAnhangBlob(antragId: string, bescheidId: string, anhangId: string): Promise<string> {
  const res = await authFetch(`${path(antragId, bescheidId)}/${anhangId}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchBescheidAnhangFile(antragId: string, bescheidId: string, anhangId: string, dateiname: string): Promise<File> {
  const res = await authFetch(`${path(antragId, bescheidId)}/${anhangId}`)
  const blob = await res.blob()
  return new File([blob], dateiname, { type: 'application/pdf' })
}

export async function triggerBescheidOcr(antragId: string, bescheidId: string, anhangId: string): Promise<void> {
  await authFetch(`${path(antragId, bescheidId)}/${anhangId}/ocr`, { method: 'POST' })
}

export async function getBescheidVorschlag(antragId: string, bescheidId: string, anhangId: string): Promise<BescheidVorschlag> {
  const res = await authFetch(`${path(antragId, bescheidId)}/${anhangId}/vorschlag`)
  return res.json()
}
