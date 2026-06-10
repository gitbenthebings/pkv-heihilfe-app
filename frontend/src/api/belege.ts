import type { Beleg, BelegTyp, UpdateBeleg } from '../types'

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

export interface BelegeFilter {
  q?: string
  typ?: BelegTyp
  datum_von?: string
  datum_bis?: string
}

export async function getBelege(filter: BelegeFilter = {}): Promise<Beleg[]> {
  const params = new URLSearchParams()
  if (filter.q) params.set('q', filter.q)
  if (filter.typ) params.set('typ', filter.typ)
  if (filter.datum_von) params.set('datum_von', filter.datum_von)
  if (filter.datum_bis) params.set('datum_bis', filter.datum_bis)
  const qs = params.toString()
  const res = await authFetch(`/belege${qs ? `?${qs}` : ''}`)
  return res.json()
}

export interface BelegMeta {
  bezeichnung?: string
  datum?: string
  eingangsdatum?: string
  typ?: BelegTyp
  aktenzeichen?: string
  betrag?: number   // Euro
  aussteller?: string
  notiz?: string
}

export async function uploadBeleg(file: File, thumbnail?: Blob, meta: BelegMeta = {}): Promise<Beleg> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  if (thumbnail) formData.append('thumbnail', thumbnail, 'thumb.jpg')
  if (meta.bezeichnung) formData.append('bezeichnung', meta.bezeichnung)
  if (meta.datum) formData.append('datum', meta.datum)
  if (meta.eingangsdatum) formData.append('eingangsdatum', meta.eingangsdatum)
  if (meta.typ) formData.append('typ', meta.typ)
  if (meta.aktenzeichen) formData.append('aktenzeichen', meta.aktenzeichen)
  if (meta.betrag != null) formData.append('betrag', String(meta.betrag))
  if (meta.aussteller) formData.append('aussteller', meta.aussteller)
  if (meta.notiz) formData.append('notiz', meta.notiz)

  const res = await authFetch('/belege', { method: 'POST', body: formData })
  return res.json()
}

export async function getBeleg(id: string): Promise<Beleg> {
  const res = await authFetch(`/belege/${id}`)
  return res.json()
}

export async function updateBeleg(id: string, data: UpdateBeleg): Promise<Beleg> {
  const res = await authFetch(`/belege/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteBeleg(id: string): Promise<void> {
  await authFetch(`/belege/${id}`, { method: 'DELETE' })
}

export function getBelegDateiUrl(id: string): string {
  return `${BASE}/belege/${id}/datei`
}

export function getBelegThumbnailUrl(id: string): string {
  return `${BASE}/belege/${id}/thumbnail`
}

// ── Rechnung-Referenzen ───────────────────────────────────────────────────────

export async function getBelegeForRechnung(rechnungId: string): Promise<Beleg[]> {
  const res = await authFetch(`/rechnungen/${rechnungId}/belege`)
  return res.json()
}

export async function addBelegToRechnung(rechnungId: string, belegId: string): Promise<void> {
  await authFetch(`/rechnungen/${rechnungId}/belege`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beleg_id: belegId }),
  })
}

export async function removeBelegFromRechnung(rechnungId: string, belegId: string): Promise<void> {
  await authFetch(`/rechnungen/${rechnungId}/belege/${belegId}`, { method: 'DELETE' })
}

// ── Antrag-Referenzen ─────────────────────────────────────────────────────────

export async function getBelegeForAntrag(antragId: string): Promise<Beleg[]> {
  const res = await authFetch(`/beihilfe-antraege/${antragId}/belege`)
  return res.json()
}

export async function addBelegToAntrag(antragId: string, belegId: string): Promise<void> {
  await authFetch(`/beihilfe-antraege/${antragId}/belege`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beleg_id: belegId }),
  })
}

export async function removeBelegFromAntrag(antragId: string, belegId: string): Promise<void> {
  await authFetch(`/beihilfe-antraege/${antragId}/belege/${belegId}`, { method: 'DELETE' })
}

// ── Blob-Hilfsfunktionen ──────────────────────────────────────────────────────

export async function fetchBelegThumbnailBlob(id: string): Promise<string> {
  const token = getToken()
  const res = await fetch(`${BASE}/belege/${id}/thumbnail`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchBelegBlob(id: string): Promise<string> {
  const token = getToken()
  const res = await fetch(`${BASE}/belege/${id}/datei`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchBelegFile(id: string, dateiname: string): Promise<File> {
  const token = getToken()
  const res = await fetch(`${BASE}/belege/${id}/datei`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  return new File([blob], dateiname, { type: 'application/pdf' })
}
