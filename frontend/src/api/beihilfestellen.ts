import { api } from './client'
import type { Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle } from '../types'

export const getBeihilfestellen = () => api.get<Beihilfestelle[]>('/beihilfestellen')
export const createBeihilfestelle = (data: CreateBeihilfestelle) => api.post<Beihilfestelle>('/beihilfestellen', data)
export const updateBeihilfestelle = (id: string, data: UpdateBeihilfestelle) => api.patch<Beihilfestelle>(`/beihilfestellen/${id}`, data)
export const deleteBeihilfestelle = (id: string) => api.delete(`/beihilfestellen/${id}`)
export const addPersonToBeihilfestelle = (id: string, person_id: string) =>
  api.post<Beihilfestelle>(`/beihilfestellen/${id}/personen`, { person_id })
export const removePersonFromBeihilfestelle = (id: string, person_id: string) =>
  api.delete<Beihilfestelle>(`/beihilfestellen/${id}/personen/${person_id}`)
