import { api } from './client'
import type { BeihilfeAntrag, CreateBeihilfeAntrag, UpdateBeihilfeAntrag, AntragStatus, AntragRechnung } from '../types'

export const getAntraege = () => api.get<BeihilfeAntrag[]>('/antraege')
export const getAntrag = (id: string) => api.get<BeihilfeAntrag>(`/antraege/${id}`)
export const createAntrag = (data: CreateBeihilfeAntrag) => api.post<BeihilfeAntrag>('/antraege', data)
export const updateAntrag = (id: string, data: UpdateBeihilfeAntrag) => api.patch<BeihilfeAntrag>(`/antraege/${id}`, data)
export const deleteAntrag = (id: string) => api.delete(`/antraege/${id}`)

export const setAntragStatus = (id: string, data: { status: AntragStatus; versendet_am?: string }) =>
  api.patch<BeihilfeAntrag>(`/antraege/${id}/status`, data)

export const getAntragRechnungen = (antrag_id: string) =>
  api.get<AntragRechnung[]>(`/antraege/${antrag_id}/rechnungen`)

export const addRechnung = (antrag_id: string, rechnung_id: string) =>
  api.post(`/antraege/${antrag_id}/rechnungen`, { rechnung_id })

export const removeRechnung = (antrag_id: string, rechnung_id: string) =>
  api.delete(`/antraege/${antrag_id}/rechnungen/${rechnung_id}`)
