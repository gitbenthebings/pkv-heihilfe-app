import { api } from './client'
import type { Pkv, CreatePkv, UpdatePkv } from '../types'

export const getPkv = () => api.get<Pkv[]>('/pkv')
export const createPkv = (data: CreatePkv) => api.post<Pkv>('/pkv', data)
export const updatePkv = (id: string, data: UpdatePkv) => api.patch<Pkv>(`/pkv/${id}`, data)
export const deletePkv = (id: string) => api.delete(`/pkv/${id}`)

export const addPersonToPkv = (pkv_id: string, person_id: string) =>
  api.post<Pkv>(`/pkv/${pkv_id}/personen`, { person_id })

export const removePersonFromPkv = (pkv_id: string, person_id: string) =>
  api.delete<Pkv>(`/pkv/${pkv_id}/personen/${person_id}`)
