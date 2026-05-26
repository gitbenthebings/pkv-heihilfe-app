import { api } from './client'
import type { Person, CreatePerson, UpdatePerson, PersonSatzHistorie, CreatePersonSatzHistorie } from '../types'

export const getPersonen = () => api.get<Person[]>('/personen')
export const createPerson = (data: CreatePerson) => api.post<Person>('/personen', data)
export const updatePerson = (id: string, data: UpdatePerson) => api.patch<Person>(`/personen/${id}`, data)
export const deletePerson = (id: string) => api.delete(`/personen/${id}`)

export const getSatzHistorie = (personId: string) => api.get<PersonSatzHistorie[]>(`/personen/${personId}/satz-historie`)
export const createSatzHistorie = (personId: string, data: CreatePersonSatzHistorie) => api.post<PersonSatzHistorie>(`/personen/${personId}/satz-historie`, data)
export const deleteSatzHistorie = (personId: string, id: string) => api.delete(`/personen/${personId}/satz-historie/${id}`)
