import { api } from './client'
import type { BeihilfeBescheid, BeihilfePosition } from '../types'

export const getBescheide = (antrag_id: string) =>
  api.get<BeihilfeBescheid[]>(`/antraege/${antrag_id}/bescheide`)

export const getBescheid = (antrag_id: string, id: string) =>
  api.get<BeihilfeBescheid>(`/antraege/${antrag_id}/bescheide/${id}`)

export const getPositionen = (antrag_id: string, bescheid_id: string) =>
  api.get<BeihilfePosition[]>(`/antraege/${antrag_id}/bescheide/${bescheid_id}/positionen`)

export const updatePosition = (antrag_id: string, bescheid_id: string, id: string, rechnung_id: string | null) =>
  api.patch<BeihilfePosition>(`/antraege/${antrag_id}/bescheide/${bescheid_id}/positionen/${id}`, { rechnung_id })

export const deleteBescheid = (antrag_id: string, id: string) =>
  api.delete(`/antraege/${antrag_id}/bescheide/${id}`)

export function uploadBescheid(antrag_id: string, file: File, typ: string): Promise<BeihilfeBescheid> {
  const token = localStorage.getItem('pkv_token')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('typ', typ)

  return fetch(`/api/antraege/${antrag_id}/bescheide`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async res => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<BeihilfeBescheid>
  })
}
