import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export default function Layout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-600 hover:text-white'
    }`

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-600 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-blue-800 dark:bg-blue-900 shadow">
        <div className="px-4 sm:px-6 lg:px-16">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Desktop-Links */}
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-base sm:text-lg mr-2 sm:mr-4 whitespace-nowrap">
                PKV-Abrechnung
              </span>
              <div className="hidden sm:flex items-center gap-1">
                <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
                <NavLink to="/rechnungen" className={linkClass}>Rechnungen</NavLink>
                <NavLink to="/antraege" className={linkClass}>Anträge</NavLink>
                <NavLink to="/stammdaten" className={linkClass}>Stammdaten</NavLink>
              </div>
            </div>

            {/* Rechte Seite */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                className="text-blue-100 hover:text-white text-sm px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                title={dark ? 'Hell-Modus' : 'Dunkel-Modus'}
              >
                {dark ? '☀' : '☾'}
              </button>
              <button
                onClick={handleLogout}
                className="hidden sm:block text-blue-100 hover:text-white text-sm px-2 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                Abmelden
              </button>
              {/* Hamburger */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="sm:hidden p-2 rounded text-blue-100 hover:bg-blue-700 transition-colors"
                aria-label="Menü"
              >
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-Menü */}
        {menuOpen && (
          <div className="sm:hidden border-t border-blue-700 px-4 py-2 space-y-1">
            <NavLink to="/dashboard" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
            <NavLink to="/rechnungen" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>Rechnungen</NavLink>
            <NavLink to="/antraege" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>Anträge</NavLink>
            <NavLink to="/stammdaten" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>Stammdaten</NavLink>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded text-sm font-medium text-blue-100 hover:bg-blue-700 transition-colors"
            >
              Abmelden
            </button>
          </div>
        )}
      </nav>
      <main className="px-4 sm:px-6 lg:px-16 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  )
}
