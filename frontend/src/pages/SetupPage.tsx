import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doSetup } from '../api/setup'

export default function SetupPage() {
  const navigate = useNavigate()
  const [mandantName, setMandantName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [passwort2, setPasswort2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (passwort !== passwort2) {
      setError('Passwörter stimmen nicht überein.')
      return
    }
    if (passwort.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    setLoading(true)
    try {
      const res = await doSetup({ mandant_name: mandantName, name, email, passwort })
      localStorage.setItem('pkv_token', res.token)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einrichten.')
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
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        padding: '36px 32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 12,
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 22,
          }}>🏥</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Willkommen
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Richte deine PKV &amp; Beihilfe App ein.<br />
            Diese Angaben können später geändert werden.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Mandant */}
          <div style={{ marginBottom: 16 }}>
            <label className="app-label">Name der Familie / des Mandanten</label>
            <input
              type="text"
              value={mandantName}
              onChange={e => setMandantName(e.target.value)}
              placeholder="z.B. Familie Mustermann"
              required
              autoFocus
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

          {/* Benutzer */}
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              Erstes Benutzerkonto
            </p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="app-label">Anzeigename</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Max Mustermann"
              required
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="app-label">E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="max@example.com"
              required
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="app-label">Passwort</label>
            <input
              type="password"
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              required
              minLength={8}
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="app-label">Passwort bestätigen</label>
            <input
              type="password"
              value={passwort2}
              onChange={e => setPasswort2(e.target.value)}
              placeholder="Passwort wiederholen"
              required
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16,
              padding: '10px 14px',
              background: 'var(--rose-dim)',
              border: '1px solid color-mix(in srgb, var(--rose) 30%, transparent)',
              borderRadius: 8,
              color: 'var(--rose)',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="app-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 14 }}
          >
            {loading ? 'Einrichten…' : 'App einrichten & anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
