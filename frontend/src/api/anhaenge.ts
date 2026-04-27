import type { Anhang } from '../types'

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

export async function getAnhaenge(rechnungId: string): Promise<Anhang[]> {
  const res = await authFetch(`/rechnungen/${rechnungId}/anhaenge`)
  return res.json()
}

export async function uploadAnhang(rechnungId: string, file: File): Promise<Anhang> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  // Content-Type NICHT setzen – Browser setzt multipart/form-data mit Boundary automatisch
  const res = await authFetch(`/rechnungen/${rechnungId}/anhaenge`, {
    method: 'POST',
    body: formData,
  })
  return res.json()
}

export async function deleteAnhang(rechnungId: string, anhangId: string): Promise<void> {
  await authFetch(`/rechnungen/${rechnungId}/anhaenge/${anhangId}`, {
    method: 'DELETE',
  })
}

/**
 * Lädt die PDF-Datei als Blob herunter (mit Auth-Header) und
 * gibt eine temporäre Blob-URL zurück, die der Aufrufer revoken muss.
 */
export async function fetchAnhangBlob(rechnungId: string, anhangId: string): Promise<string> {
  const res = await authFetch(`/rechnungen/${rechnungId}/anhaenge/${anhangId}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/** Lädt die PDF-Datei als File-Objekt herunter (für Web Share API). */
export async function fetchAnhangFile(rechnungId: string, anhangId: string, dateiname: string): Promise<File> {
  const res = await authFetch(`/rechnungen/${rechnungId}/anhaenge/${anhangId}`)
  const blob = await res.blob()
  return new File([blob], dateiname, { type: 'application/pdf' })
}
