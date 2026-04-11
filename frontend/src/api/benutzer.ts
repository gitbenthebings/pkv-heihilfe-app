import { api } from './client'
import type { Benutzer, CreateBenutzer, UpdateBenutzer } from '../types'

export async function getBenutzer(): Promise<Benutzer[]> {
  return api.get<Benutzer[]>('/benutzer')
}

export async function createBenutzer(data: CreateBenutzer): Promise<Benutzer> {
  return api.post<Benutzer>('/benutzer', data)
}

export async function updateBenutzer(id: string, data: UpdateBenutzer): Promise<Benutzer> {
  return api.patch<Benutzer>(`/benutzer/${id}`, data)
}

export async function changePasswort(id: string, altes_passwort: string, neues_passwort: string): Promise<void> {
  return api.post(`/benutzer/${id}/passwort`, { altes_passwort, neues_passwort })
}

export async function deleteBenutzer(id: string): Promise<void> {
  return api.delete(`/benutzer/${id}`)
}
