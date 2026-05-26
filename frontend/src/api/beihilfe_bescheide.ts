import { api } from './client'
import type {
  BeihilfeBescheid, BescheidPosition,
  CreateBeihilfeBescheid, UpdateBeihilfeBescheid,
  CreateBescheidPosition, UpdateBescheidPosition,
} from '../types'

export const getBescheide = (antragId: string) =>
  api.get<BeihilfeBescheid[]>(`/beihilfe-antraege/${antragId}/bescheide`)

export const createBescheid = (antragId: string, data: CreateBeihilfeBescheid) =>
  api.post<BeihilfeBescheid>(`/beihilfe-antraege/${antragId}/bescheide`, data)

export const updateBescheid = (antragId: string, bescheidId: string, data: UpdateBeihilfeBescheid) =>
  api.patch<BeihilfeBescheid>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}`, data)

export const deleteBescheid = (antragId: string, bescheidId: string) =>
  api.delete<void>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}`)

export const getPositionen = (antragId: string, bescheidId: string) =>
  api.get<BescheidPosition[]>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}/positionen`)

export const createPosition = (antragId: string, bescheidId: string, data: CreateBescheidPosition) =>
  api.post<BescheidPosition>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}/positionen`, data)

export const updatePosition = (antragId: string, bescheidId: string, positionId: string, data: UpdateBescheidPosition) =>
  api.patch<BescheidPosition>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}/positionen/${positionId}`, data)

export const deletePosition = (antragId: string, bescheidId: string, positionId: string) =>
  api.delete<void>(`/beihilfe-antraege/${antragId}/bescheide/${bescheidId}/positionen/${positionId}`)
