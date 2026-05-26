import { api } from './client'
import type {
  BeihilfeAntrag, AntragRechnung,
  CreateBeihilfeAntrag, UpdateBeihilfeAntrag, SetAntragStatus,
} from '../types'

export const getAntraege = (status?: string, rechnung_id?: string) => {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (rechnung_id) params.set('rechnung_id', rechnung_id)
  const qs = params.toString() ? `?${params}` : ''
  return api.get<BeihilfeAntrag[]>(`/beihilfe-antraege${qs}`)
}

export const getAntrag = (id: string) =>
  api.get<BeihilfeAntrag>(`/beihilfe-antraege/${id}`)

export const createAntrag = (data: CreateBeihilfeAntrag) =>
  api.post<BeihilfeAntrag>('/beihilfe-antraege', data)

export const updateAntrag = (id: string, data: UpdateBeihilfeAntrag) =>
  api.patch<BeihilfeAntrag>(`/beihilfe-antraege/${id}`, data)

export const deleteAntrag = (id: string) =>
  api.delete<void>(`/beihilfe-antraege/${id}`)

export const setAntragStatus = (id: string, data: SetAntragStatus) =>
  api.patch<BeihilfeAntrag>(`/beihilfe-antraege/${id}/status`, data)

export const getAntragRechnungen = (antragId: string) =>
  api.get<AntragRechnung[]>(`/beihilfe-antraege/${antragId}/rechnungen`)

export const addRechnung = (antragId: string, rechnungId: string, widerspruch = false) =>
  api.post<AntragRechnung>(`/beihilfe-antraege/${antragId}/rechnungen`, { rechnung_id: rechnungId, widerspruch })

export const removeRechnung = (antragId: string, rechnungId: string) =>
  api.delete<void>(`/beihilfe-antraege/${antragId}/rechnungen/${rechnungId}`)
