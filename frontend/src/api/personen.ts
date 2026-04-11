import { api } from './client'
import type { Person, CreatePerson, UpdatePerson } from '../types'

export const getPersonen = () => api.get<Person[]>('/personen')
export const createPerson = (data: CreatePerson) => api.post<Person>('/personen', data)
export const updatePerson = (id: string, data: UpdatePerson) => api.patch<Person>(`/personen/${id}`, data)
export const deletePerson = (id: string) => api.delete(`/personen/${id}`)
