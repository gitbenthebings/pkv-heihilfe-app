import { api } from './client'
import type { DashboardData } from '../types'

export const getDashboard = () => api.get<DashboardData>('/dashboard')
