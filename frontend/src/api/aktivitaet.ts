import { api } from './client'
import type { RechnungAktivitaet } from '../types'

export const getAktivitaet = (rechnungId: string) =>
  api.get<RechnungAktivitaet[]>(`/rechnungen/${rechnungId}/aktivitaet`)

export const getAllAktivitaet = () =>
  api.get<RechnungAktivitaet[]>('/aktivitaet')
