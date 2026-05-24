import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'

interface Props {
  rechnungId: string | null
  onClose: () => void
  onUpdate?: () => void
}

function formatEuro(cent: number) {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDatum(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

export default function RechnungDetailSlider({ rechnungId, onClose, onUpdate: _onUpdate }: Props) {
  const qc = useQueryClient()
  const { data: rechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

  useEffect(() => {
    if (!rechnungId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rechnungId, onClose])

  if (!rechnungId) return null

  const rechnung = rechnungen.find(r => r.id === rechnungId)
  const person = personen.find(p => p.id === rechnung?.person_id)
  const corr = correspondents.find(c => c.id === rechnung?.leistungserbringer_id)

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100 }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)',
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right .2s ease',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.07em' }}>RECHNUNG</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
              {rechnung ? `R-${String(rechnung.referenz_nr).padStart(4, '0')}` : '—'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 20, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {!rechnung ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Rechnung nicht gefunden.</p>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {formatEuro(rechnung.betrag)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {person?.name} · {corr?.name}
                </div>
              </div>

              {row('Datum', rechnung.datum ? formatDatum(rechnung.datum) : null)}
              {row('Typ', rechnung.typ)}
              {row('Bezahlt am', rechnung.bezahlt_am ? formatDatum(rechnung.bezahlt_am) : null)}
              {row('Beihilfe eingereicht', rechnung.beihilfe_eingereicht_am ? formatDatum(rechnung.beihilfe_eingereicht_am) : null)}
              {row('PKV eingereicht', rechnung.pkv_eingereicht_am ? formatDatum(rechnung.pkv_eingereicht_am) : null)}
              {rechnung.beihilfe_erstattet_betrag != null && row('Beihilfe erstattet', formatEuro(rechnung.beihilfe_erstattet_betrag))}
              {rechnung.pkv_erstattet_betrag != null && row('PKV erstattet', formatEuro(rechnung.pkv_erstattet_betrag))}
              {rechnung.notiz && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.07em', marginBottom: 4 }}>NOTIZ</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rechnung.notiz}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { qc.invalidateQueries({ queryKey: ['rechnungen'] }); onClose() }}
            className="app-btn-secondary"
            style={{ width: '100%', padding: '9px' }}
          >
            Schließen
          </button>
        </div>
      </div>
    </>
  )
}
