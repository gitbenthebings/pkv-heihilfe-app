import { api } from './client'
import type { Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle } from '../types'

export const getBeihilfestellen = () => api.get<Beihilfestelle[]>('/beihilfestellen')
export const createBeihilfestelle = (data: CreateBeihilfestelle) => api.post<Beihilfestelle>('/beihilfestellen', data)
export const updateBeihilfestelle = (id: string, data: UpdateBeihilfestelle) => api.patch<Beihilfestelle>(`/beihilfestellen/${id}`, data)
export const deleteBeihilfestelle = (id: string) => api.delete(`/beihilfestellen/${id}`)
