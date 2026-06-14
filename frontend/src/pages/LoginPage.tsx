import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getConfig } from '../api/config'
import { LOGO_URL } from '../api/logo'
import { getSetupStatus } from '../api/setup'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasLogo, setHasLogo] = useState(false)

  useEffect(() => {
    getConfig().then(c => setHasLogo(!!c.has_logo))
    getSetupStatus().then(s => {
      if (s.needs_setup) navigate('/setup', { replace: true })
    }).catch(() => {})
  }, [navigate])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('E-Mail oder Passwort falsch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        width: '100%',
        maxWidth: 360,
        padding: '36px 32px',
      }}>
        {/* Logo oder App-Name */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {hasLogo ? (
            <img
              src={LOGO_URL}
              alt="Logo"
              style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
            />
          ) : (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'var(--primary-dim)',
                border: '1px solid rgba(127,127,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="26" height="26" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="1" width="5" height="6" rx="1.2" fill="var(--primary)" opacity="0.9"/>
                  <rect x="8" y="1" width="4" height="3.5" rx="1" fill="var(--primary)" opacity="0.55"/>
                  <rect x="1" y="9" width="11" height="3" rx="1" fill="var(--primary)" opacity="0.7"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                PKV-Abrechnung
              </h1>
            </>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-subtle)', margin: '0 0 20px', textAlign: 'center' }}>
          Bitte anmelden
        </p>

        {error && (
          <div style={{
            background: 'var(--rose-dim, #fee2e2)',
            border: '1px solid var(--rose)',
            borderRadius: 6,
            padding: '8px 12px',
            color: 'var(--rose)',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
              E-Mail
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid var(--border)', borderRadius: 7,
                padding: '8px 12px', fontSize: 14,
                background: 'var(--surface-alt)', color: 'var(--text)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
              Passwort
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid var(--border)', borderRadius: 7,
                padding: '8px 12px', fontSize: 14,
                background: 'var(--surface-alt)', color: 'var(--text)',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '9px',
              background: 'var(--primary)', color: '#fff',
              border: 'none', borderRadius: 7,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
