import { api } from './client'

export interface SetupStatus {
  needs_setup: boolean
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return api.get<SetupStatus>('/setup/status')
}

export interface SetupPayload {
  mandant_name: string
  name: string
  email: string
  passwort: string
}

export interface SetupResponse {
  token: string
}

export async function doSetup(payload: SetupPayload): Promise<SetupResponse> {
  return api.post<SetupResponse>('/setup', payload)
}
