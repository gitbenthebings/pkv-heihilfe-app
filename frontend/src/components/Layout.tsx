import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useJahr } from '../context/JahrContext'
import GlobalSearch from './GlobalSearch'
import { getConfig } from '../api/config'
import { LOGO_URL } from '../api/logo'

const NAV_ITEMS = [
  { to: '/dashboard',          label: 'Dashboard' },
  { to: '/rechnungen',         label: 'Rechnungen' },
  { to: '/beihilfe-antraege',  label: 'Anträge' },
  { to: '/auswertung',         label: 'Auswertung' },
  { to: '/aktivitaetslog',     label: 'Protokoll' },
  { to: '/belege',             label: 'Belege' },
  { to: '/stammdaten',         label: 'Stammdaten' },
  { to: '/ueber',              label: 'Über' },
]

export default function Layout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const fullBleed = pathname === '/belege'
  const { dark, toggle } = useTheme()
  const { jahr, setJahr, jahreOptionen } = useJahr()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hasLogo, setHasLogo] = useState(false)

  useEffect(() => {
    getConfig().then(c => setHasLogo(!!c.has_logo))
  }, [])

  // Ctrl+K / Cmd+K öffnet Suche
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Navigation ── */}
      <nav style={{
        background: 'var(--nav)',
        borderBottom: '1px solid var(--nav-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 46 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
            {hasLogo ? (
              <img
                src={LOGO_URL}
                alt="Logo"
                style={{ height: 28, maxWidth: 120, objectFit: 'contain' }}
              />
            ) : (
              <>
                <div style={{
                  width: 24, height: 24, borderRadius: 7,
                  background: 'var(--primary-dim)',
                  border: '1px solid rgba(127,127,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="1" y="1" width="5" height="6" rx="1.2" fill="var(--primary)" opacity="0.9"/>
                    <rect x="8" y="1" width="4" height="3.5" rx="1" fill="var(--primary)" opacity="0.55"/>
                    <rect x="1" y="9" width="11" height="3" rx="1" fill="var(--primary)" opacity="0.7"/>
                  </svg>
                </div>
                <span style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}>PKV-Abrechnung</span>
              </>
            )}
          </div>

          {/* Desktop nav links */}
          <div className="hidden sm:flex" style={{ alignItems: 'center', flex: 1, gap: 0 }}>
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: '0 14px',
                  height: 46,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>

          <div style={{ flex: 1 }} className="sm:hidden" />

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

            {/* Such-Button */}
            <button
              onClick={() => setSearchOpen(true)}
              title="Suchen (Strg+K)"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 5,
                color: 'rgba(255,255,255,0.55)',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2}/>
                <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35"/>
              </svg>
              <span className="hidden sm:inline" style={{ opacity: 0.7 }}>⌘K</span>
            </button>

            {/* Jahres-Selector */}
            <select
              value={jahr}
              onChange={e => setJahr(Number(e.target.value))}
              title="Jahresfilter"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 5,
                color: 'rgba(255,255,255,0.8)',
                fontSize: 12,
                padding: '3px 6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {jahreOptionen.map(j => (
                <option key={j} value={j} style={{ background: 'var(--nav)', color: '#fff' }}>{j}</option>
              ))}
            </select>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={dark ? 'Hell-Modus' : 'Dunkel-Modus'}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 5,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 12,
                padding: '3px 8px',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
            >
              {dark ? '☀' : '☾'}
            </button>

            {/* Logout (desktop) */}
            <button
              onClick={handleLogout}
              className="hidden sm:block"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 5,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 12,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              Abmelden
            </button>

            {/* Hamburger (mobile) */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden"
              aria-label="Menü"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {menuOpen ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden" style={{ borderTop: '1px solid var(--nav-border)', padding: '8px 16px 12px' }}>
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 2,
                })}
              >
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Abmelden
            </button>
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <main
        className={fullBleed ? '' : 'px-4 sm:px-6 lg:px-8 py-4 sm:py-6'}
        style={fullBleed ? { height: 'calc(100vh - 46px)', overflow: 'hidden' } : undefined}
      >
        <Outlet />
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
