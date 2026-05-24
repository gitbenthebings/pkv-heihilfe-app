import { api } from './client'
import type { Person, CreatePerson, UpdatePerson, PersonSatzHistorie, CreatePersonSatzHistorie } from '../types'

export const getPersonen = () => api.get<Person[]>('/personen')
export const createPerson = (data: CreatePerson) => api.post<Person>('/personen', data)
export const updatePerson = (id: string, data: UpdatePerson) => api.patch<Person>(`/personen/${id}`, data)
export const deletePerson = (id: string) => api.delete(`/personen/${id}`)

export const getSatzHistorie = (person_id: string) =>
  api.get<PersonSatzHistorie[]>(`/personen/${person_id}/satz-historie`)

export const createSatzHistorie = (person_id: string, data: CreatePersonSatzHistorie) =>
  api.post<PersonSatzHistorie>(`/personen/${person_id}/satz-historie`, data)

export const deleteSatzHistorie = (person_id: string, id: string) =>
  api.delete(`/personen/${person_id}/satz-historie/${id}`)
