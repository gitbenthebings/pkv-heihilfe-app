import { api } from './client'
import type { Rechnung, CreateRechnung, UpdateRechnung, BulkAction } from '../types'

export const getRechnungen = (personId?: string, archiviert = false, jahr?: number) => {
  const params = new URLSearchParams()
  if (personId) params.set('person_id', personId)
  if (archiviert) params.set('archiviert', 'true')
  if (jahr != null) params.set('jahr', String(jahr))
  const qs = params.toString() ? `?${params}` : ''
  return api.get<Rechnung[]>(`/rechnungen${qs}`)
}

export const createRechnung = (data: CreateRechnung) =>
  api.post<Rechnung>('/rechnungen', data)

export const updateRechnung = (id: string, data: UpdateRechnung) =>
  api.patch<Rechnung>(`/rechnungen/${id}`, data)

export const deleteRechnung = (id: string) =>
  api.delete<void>(`/rechnungen/${id}`)

export const bulkAction = (ids: string[], action: BulkAction) =>
  api.post<{ updated: number }>('/rechnungen/bulk', { ids, action })
