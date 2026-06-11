import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { JahrProvider } from './context/JahrContext'
import { ToastProvider } from './context/ToastContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RechnungenPage from './pages/RechnungenPage'
import StammdatenPage from './pages/StammdatenPage'
import BeihilfeAntraegePage from './pages/BeihilfeAntraegePage'
import AktivitaetsLogPage from './pages/AktivitaetsLogPage'
import AuswertungPage from './pages/AuswertungPage'
import BelegePage from './pages/BelegePage'
import UeberPage from './pages/UeberPage'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
            <Route path="belege" element={<BelegePage />} />
            <Route path="stammdaten" element={<StammdatenPage />} />
            <Route path="ueber" element={<UeberPage />} />
          </Route>
        </Routes>
      </JahrProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
