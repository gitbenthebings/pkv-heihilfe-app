import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { JahrProvider } from './context/JahrContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RechnungenPage from './pages/RechnungenPage'
import StammdatenPage from './pages/StammdatenPage'
import BeihilfeAntraegePage from './pages/BeihilfeAntraegePage'
import AktivitaetsLogPage from './pages/AktivitaetsLogPage'
import AuswertungPage from './pages/AuswertungPage'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <JahrProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="rechnungen" element={<RechnungenPage />} />
            <Route path="beihilfe-antraege" element={<BeihilfeAntraegePage />} />
            <Route path="beihilfe-antraege/:id" element={<BeihilfeAntraegePage />} />
            <Route path="auswertung" element={<AuswertungPage />} />
            <Route path="aktivitaetslog" element={<AktivitaetsLogPage />} />
            <Route path="stammdaten" element={<StammdatenPage />} />
          </Route>
        </Routes>
      </JahrProvider>
    </BrowserRouter>
  )
}
