import { api } from './client'
import type { Correspondent, CreateCorrespondent, UpdateCorrespondent } from '../types'

export const getCorrespondents = () => api.get<Correspondent[]>('/correspondents')
export const createCorrespondent = (data: CreateCorrespondent) => api.post<Correspondent>('/correspondents', data)
export const updateCorrespondent = (id: string, data: UpdateCorrespondent) => api.patch<Correspondent>(`/correspondents/${id}`, data)
export const deleteCorrespondent = (id: string) => api.delete(`/correspondents/${id}`)
