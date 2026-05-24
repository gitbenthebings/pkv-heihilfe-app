import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadBescheid, deleteBescheid, getPositionen, updatePosition } from '../api/beihilfe_bescheide'
import type { BeihilfeBescheid, BeihilfePosition, AntragRechnung, Rechnung, Person } from '../types'

const ANALYSE_TIMEOUT_SEC = 120

interface Props {
  antragId: string
  antragTyp: string
  bescheide: BeihilfeBescheid[]
  antragRechnungen: AntragRechnung[]
  rechnungen: Rechnung[]
  personMap: Record<string, Person>
  onOpenRechnung: (id: string) => void
}

function formatEuro(cent: number | null) {
  if (cent == null) return '—'
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function AnalyseStatusBadge({ status, fehler }: { status: BeihilfeBescheid['analyse_status']; fehler: string | null }) {
  const cfg = {
    ausstehend:       { label: 'Ausstehend',     color: 'var(--text-subtle)',  bg: 'var(--surface-alt)' },
    wird_analysiert:  { label: 'Wird analysiert', color: 'var(--amber)',        bg: 'var(--amber-dim)' },
    abgeschlossen:    { label: 'Analysiert',      color: 'var(--green)',        bg: 'var(--green-dim)' },
    fehler:           { label: fehler ?? 'Fehler', color: 'var(--rose)',        bg: 'var(--rose-dim)' },
  }[status] ?? { label: status, color: 'var(--text-muted)', bg: 'var(--surface-alt)' }

  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function LoadingBar({ bescheid, onTimeout }: { bescheid: BeihilfeBescheid; onTimeout: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const timedOut = useRef(false)

  const secondsAgo = Math.floor((Date.now() - new Date(bescheid.erstellt_am).getTime()) / 1000)

  useEffect(() => {
    setElapsed(secondsAgo)
    const t = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= ANALYSE_TIMEOUT_SEC && !timedOut.current) {
          timedOut.current = true
          onTimeout()
        }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.min(elapsed / ANALYSE_TIMEOUT_SEC, 1) * 100
  const remaining = Math.max(ANALYSE_TIMEOUT_SEC - elapsed, 0)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: 'linear-gradient(90deg, var(--primary), var(--green))',
          width: `${pct}%`,
          transition: 'width 1s linear',
          animation: 'analyse-pulse 2s ease-in-out infinite',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
        Analyse läuft… {remaining}s verbleibend
      </div>
    </div>
  )
}

function PositionenListe({
  antragId,
  bescheid,
  antragRechnungen,
  rechnungen,
  personMap,
  onOpenRechnung,
}: {
  antragId: string
  bescheid: BeihilfeBescheid
  antragRechnungen: AntragRechnung[]
  rechnungen: Rechnung[]
  personMap: Record<string, Person>
  onOpenRechnung: (id: string) => void
}) {
  const qc = useQueryClient()
  const { data: positionen = [] } = useQuery({
    queryKey: ['positionen', bescheid.id],
    queryFn: () => getPositionen(antragId, bescheid.id),
    enabled: bescheid.analyse_status === 'abgeschlossen',
  })

  const assignMut = useMutation({
    mutationFn: ({ posId, rechnungId }: { posId: string; rechnungId: string | null }) =>
      updatePosition(antragId, bescheid.id, posId, rechnungId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positionen', bescheid.id] }),
  })

  if (bescheid.analyse_status !== 'abgeschlossen') return null
  if (positionen.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8, fontStyle: 'italic' }}>Keine Positionen extrahiert.</p>
  }

  const verfuegbareRechnungen = antragRechnungen
    .map(ar => rechnungen.find(r => r.id === ar.rechnung_id))
    .filter(Boolean) as Rechnung[]

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.07em', marginBottom: 8 }}>
        POSITIONEN ({positionen.length})
      </div>
      {positionen.map(pos => (
        <PositionRow
          key={pos.id}
          pos={pos}
          verfuegbareRechnungen={verfuegbareRechnungen}
          personMap={personMap}
          onAssign={(rechnungId) => assignMut.mutate({ posId: pos.id, rechnungId })}
          onOpenRechnung={onOpenRechnung}
          isPending={assignMut.isPending}
        />
      ))}
    </div>
  )
}

function PositionRow({
  pos,
  verfuegbareRechnungen,
  personMap,
  onAssign,
  onOpenRechnung,
  isPending,
}: {
  pos: BeihilfePosition
  verfuegbareRechnungen: Rechnung[]
  personMap: Record<string, Person>
  onAssign: (id: string | null) => void
  onOpenRechnung: (id: string) => void
  isPending: boolean
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
      background: pos.rechnung_id ? 'var(--green-dim)' : 'var(--surface-alt)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)' }}>#{pos.lfd_nr}</span>
            {pos.rechnungsdatum && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {pos.rechnungsdatum.split('-').reverse().join('.')}
              </span>
            )}
            {pos.leistungserbringer && (
              <span style={{ fontSize: 11, color: 'var(--text)' }}>{pos.leistungserbringer}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {pos.rechnungsbetrag != null && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-subtle)', fontWeight: 700 }}>RECHNUNG</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatEuro(pos.rechnungsbetrag)}</div>
              </div>
            )}
            {pos.anerkannt_betrag != null && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>ANERKANNT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{formatEuro(pos.anerkannt_betrag)}</div>
              </div>
            )}
            {pos.beihilfe_betrag != null && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 700 }}>BEIHILFE</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{formatEuro(pos.beihilfe_betrag)}</div>
              </div>
            )}
            {pos.abgelehnt_betrag != null && pos.abgelehnt_betrag > 0 && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--rose)', fontWeight: 700 }}>ABGELEHNT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose)' }}>{formatEuro(pos.abgelehnt_betrag)}</div>
              </div>
            )}
          </div>
          {pos.ablehnungsgrund && (
            <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 4 }}>Grund: {pos.ablehnungsgrund}</div>
          )}
        </div>

        {/* Zuordnung */}
        <div style={{ minWidth: 160 }}>
          {pos.rechnung_id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => onOpenRechnung(pos.rechnung_id!)}
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {(() => {
                  const r = verfuegbareRechnungen.find(r => r.id === pos.rechnung_id)
                  return r ? `R-${String(r.referenz_nr).padStart(4, '0')}` : 'Zugeordnet'
                })()}
              </button>
              <button
                onClick={() => onAssign(null)}
                disabled={isPending}
                style={{ fontSize: 12, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >×</button>
            </div>
          ) : (
            <select
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }}
              defaultValue=""
              disabled={isPending}
              onChange={e => { if (e.target.value) onAssign(e.target.value) }}
            >
              <option value="">+ Rechnung zuordnen…</option>
              {verfuegbareRechnungen.map(r => {
                const person = personMap[r.person_id]
                return (
                  <option key={r.id} value={r.id}>
                    R-{String(r.referenz_nr).padStart(4, '0')} · {(r.betrag / 100).toFixed(2)} € · {person?.name}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export default function BeihilfeBescheidForm({
  antragId,
  antragTyp: _antragTyp,
  bescheide,
  antragRechnungen,
  rechnungen,
  personMap,
  onOpenRechnung,
}: Props) {
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedTyp, setSelectedTyp] = useState<'bescheid' | 'widerspruchsbescheid'>('bescheid')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [timedOutIds, setTimedOutIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Keine Datei ausgewählt')
      return uploadBescheid(antragId, selectedFile, selectedTyp)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bescheide', antragId] })
      setShowUpload(false)
      setSelectedFile(null)
      setUploadError(null)
    },
    onError: (e: Error) => setUploadError(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBescheid(antragId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bescheide', antragId] }),
  })

  const handleTimeout = (id: string) => {
    setTimedOutIds(prev => new Set(prev).add(id))
    qc.invalidateQueries({ queryKey: ['bescheide', antragId] })
  }

  const isAnalyzing = (b: BeihilfeBescheid) =>
    (b.analyse_status === 'ausstehend' || b.analyse_status === 'wird_analysiert') &&
    !timedOutIds.has(b.id)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.09em' }}>BESCHEIDE</div>
        <button
          className="app-btn-secondary"
          style={{ padding: '3px 11px', fontSize: 11 }}
          onClick={() => { setShowUpload(s => !s); setUploadError(null) }}
        >
          {showUpload ? 'Abbrechen' : '+ Bescheid hochladen'}
        </button>
      </div>

      {/* Upload-Formular */}
      {showUpload && (
        <div style={{
          background: 'var(--blue-dim)', border: '1px solid rgba(74,136,245,.3)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 14, animation: 'fade-in .15s ease',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>TYP</div>
              <select
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 5 }}
                value={selectedTyp}
                onChange={e => setSelectedTyp(e.target.value as typeof selectedTyp)}
              >
                <option value="bescheid">Bescheid</option>
                <option value="widerspruchsbescheid">Widerspruchsbescheid</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>PDF-DATEI</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ fontSize: 12 }}
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button
              className="app-btn-primary"
              style={{ padding: '6px 16px', fontSize: 12 }}
              disabled={!selectedFile || uploadMut.isPending}
              onClick={() => uploadMut.mutate()}
            >
              {uploadMut.isPending ? 'Lädt…' : 'Hochladen'}
            </button>
          </div>
          {uploadError && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--rose)' }}>{uploadError}</div>
          )}
        </div>
      )}

      {/* Bescheide-Liste */}
      {bescheide.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', fontStyle: 'italic' }}>
          Noch kein Bescheid hochgeladen.
        </p>
      ) : (
        bescheide.map(b => (
          <div key={b.id} style={{
            border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 10,
            background: 'var(--bg)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {b.typ === 'widerspruchsbescheid' ? 'Widerspruchsbescheid' : 'Bescheid'}
                  </span>
                  <AnalyseStatusBadge
                    status={timedOutIds.has(b.id) ? 'fehler' : b.analyse_status}
                    fehler={timedOutIds.has(b.id) ? 'Timeout (n8n nicht erreichbar?)' : b.analyse_fehler}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {b.dateiname} · {(b.groesse / 1024).toFixed(0)} KB ·{' '}
                  {new Date(b.erstellt_am).toLocaleDateString('de-DE')}
                </div>
                {b.datum && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Bescheiddatum: {b.datum.split('-').reverse().join('.')}
                    {b.aktenzeichen && ` · Az.: ${b.aktenzeichen}`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a
                  href={`/api/antraege/${antragId}/bescheide/${b.id}/datei`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-block' }}
                >
                  PDF
                </a>
                <button
                  onClick={() => { if (confirm('Bescheid löschen?')) deleteMut.mutate(b.id) }}
                  disabled={deleteMut.isPending}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'transparent', border: '1px solid var(--rose)', color: 'var(--rose)', cursor: 'pointer' }}
                >
                  Löschen
                </button>
              </div>
            </div>

            {/* Lade-Indikator */}
            {isAnalyzing(b) && (
              <LoadingBar
                bescheid={b}
                onTimeout={() => handleTimeout(b.id)}
              />
            )}

            {/* Positionen */}
            <PositionenListe
              antragId={antragId}
              bescheid={b}
              antragRechnungen={antragRechnungen}
              rechnungen={rechnungen}
              personMap={personMap}
              onOpenRechnung={onOpenRechnung}
            />
          </div>
        ))
      )}
    </div>
  )
}
