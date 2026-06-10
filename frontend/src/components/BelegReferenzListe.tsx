import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBelegeForRechnung, addBelegToRechnung, removeBelegFromRechnung,
  getBelegeForAntrag, addBelegToAntrag, removeBelegFromAntrag,
  fetchBelegBlob, fetchBelegThumbnailBlob,
} from '../api/belege'
import { createBescheid } from '../api/beihilfe_bescheide'
import BelegPicker from './BelegPicker'
import BelegeUpload from './BelegeUpload'
import { TYP_LABELS } from './BelegeUpload'
import type { Beleg, BelegTyp } from '../types'

interface RechnungProps { mode: 'rechnung'; id: string; thumbnailView?: boolean }
interface AntragProps  { mode: 'antrag';   id: string; antragTyp?: 'beihilfe' | 'pkv'; thumbnailView?: boolean }
type Props = RechnungProps | AntragProps

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatEuro(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const isBescheidTyp = (t: BelegTyp | null) => t === 'erstbescheid' || t === 'widerspruchsbescheid'
const isLeistungserbringerTyp = (t: BelegTyp | null) => t === 'rechnung' || t === 'rezept' || t === 'ueberweisung'

function ausstellerLabel(t: BelegTyp | null): string {
  if (isBescheidTyp(t)) return 'Behörde / PKV'
  if (isLeistungserbringerTyp(t)) return 'Leistungserbringer'
  return 'Aussteller'
}

const TYP_COLORS: Record<BelegTyp, string> = {
  rechnung: 'var(--teal)',
  erstbescheid: 'var(--primary)',
  widerspruchsbescheid: 'var(--amber)',
  rezept: 'var(--emerald)',
  ueberweisung: 'var(--violet)',
  sonstiges: 'var(--text-subtle)',
}

// ── Thumbnail-Karte (Slider-Ansicht) ─────────────────────────────────────────

function BelegThumbCard({
  beleg,
  onOpen,
  onRemove,
  opening,
}: {
  beleg: Beleg
  onOpen: () => void
  onRemove: () => void
  opening: boolean
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!beleg.has_thumbnail) return
    let revoked = false
    fetchBelegThumbnailBlob(beleg.id)
      .then(url => { if (!revoked) setThumbUrl(url) })
      .catch(() => {})
    return () => {
      revoked = true
      if (thumbUrl) URL.revokeObjectURL(thumbUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beleg.id, beleg.has_thumbnail])

  const displayName = beleg.bezeichnung || beleg.dateiname

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Thumbnail */}
      <div
        onClick={onOpen}
        style={{
          height: 100, background: 'var(--surface-alt)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: opening ? 'default' : 'pointer', overflow: 'hidden', position: 'relative',
        }}
        title="PDF öffnen"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"
            style={{ color: 'var(--rose)', opacity: 0.6 }}>
            <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
          </svg>
        )}
        {opening && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#fff' }}>Öffne…</span>
          </div>
        )}
        {/* Entfernen-Button oben rechts */}
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{
            position: 'absolute', top: 4, right: 4,
            background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 13, lineHeight: 1, padding: '2px 5px',
            cursor: 'pointer',
          }}
          title="Verknüpfung entfernen"
        >×</button>
      </div>

      {/* Info */}
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Typ-Badge + Datum */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {beleg.typ && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 8,
              background: TYP_COLORS[beleg.typ] + '22',
              color: TYP_COLORS[beleg.typ],
              border: `1px solid ${TYP_COLORS[beleg.typ]}44`,
              fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {TYP_LABELS[beleg.typ]}
            </span>
          )}
          {beleg.datum && (
            <span style={{ fontSize: 9, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
              {formatDate(beleg.datum)}
            </span>
          )}
        </div>

        {/* Bezeichnung / Dateiname */}
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={displayName}>{displayName}</span>

        {/* Aussteller */}
        {beleg.aussteller && (
          <span style={{
            fontSize: 10, color: 'var(--text-subtle)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={`${ausstellerLabel(beleg.typ)}: ${beleg.aussteller}`}>
            {beleg.aussteller}
          </span>
        )}

        {/* Betrag */}
        {beleg.betrag != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {beleg.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 8px',
  border: '1px solid var(--border)', borderRadius: 5,
  background: 'var(--surface)', color: 'var(--text)',
}

// ── Inline form to create a Bescheid from a Beleg ────────────────────────────

interface BescheidFormProps {
  antragId: string
  antragTyp?: 'beihilfe' | 'pkv'
  beleg: Beleg
  onDone: () => void
  onCancel: () => void
}

function BescheidAusBeleg({ antragId, antragTyp, beleg, onDone, onCancel }: BescheidFormProps) {
  const qc = useQueryClient()
  const label = antragTyp === 'pkv' ? 'Abrechnung' : 'Bescheid'

  const [bDatum, setBDatum] = useState(beleg.datum ?? '')
  const [bEingang, setBEingang] = useState(beleg.eingangsdatum ?? '')
  const [bAktenzeichen, setBAktenzeichen] = useState(beleg.aktenzeichen ?? '')
  const [bBetrag, setBBetrag] = useState(beleg.betrag != null ? String(beleg.betrag) : '')
  const [bTyp, setBTyp] = useState<'erstbescheid' | 'widerspruchsbescheid'>(
    beleg.typ === 'widerspruchsbescheid' ? 'widerspruchsbescheid' : 'erstbescheid'
  )
  const [bNotiz, setBNotiz] = useState(beleg.notiz ?? '')
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () => createBescheid(antragId, {
      aktenzeichen: bAktenzeichen || undefined,
      bescheid_datum: bDatum,
      eingangsdatum: bEingang || undefined,
      erstattungsbetrag_gesamt: parseFloat(bBetrag) || 0,
      typ: bTyp,
      notiz: bNotiz || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bescheide', antragId] })
      onDone()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8,
      padding: '12px 14px', background: 'var(--surface-alt)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
        {label} aus Beleg erstellen
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Typ</label>
          <select value={bTyp} onChange={e => setBTyp(e.target.value as typeof bTyp)} style={inputStyle}>
            <option value="erstbescheid">{label === 'Abrechnung' ? 'Erstabrechnung' : 'Erstbescheid'}</option>
            <option value="widerspruchsbescheid">{label === 'Abrechnung' ? 'Widerspruch' : 'Widerspruchsbescheid'}</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Aktenzeichen</label>
          <input value={bAktenzeichen} onChange={e => setBAktenzeichen(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{label}-Datum *</label>
          <input type="date" value={bDatum} onChange={e => setBDatum(e.target.value)} style={inputStyle} required />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Eingangsdatum</label>
          <input type="date" value={bEingang} onChange={e => setBEingang(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
            {antragTyp === 'pkv' ? 'Erstattungsbetrag (€)' : 'Erstattungsbetrag gesamt (€)'}
          </label>
          <input type="number" step="0.01" min="0" value={bBetrag}
            onChange={e => setBBetrag(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Notiz</label>
          <textarea value={bNotiz} onChange={e => setBNotiz(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !bDatum}
          style={{
            fontSize: 12, padding: '5px 12px',
            background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 5, cursor: 'pointer',
            opacity: mut.isPending || !bDatum ? 0.6 : 1,
          }}
        >
          {mut.isPending ? 'Anlegen…' : `${label} anlegen`}
        </button>
        <button onClick={onCancel}
          style={{ fontSize: 12, padding: '5px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BelegReferenzListe(props: Props) {
  const qc = useQueryClient()
  const queryKey = ['belege', props.mode, props.id]
  const antragTyp = props.mode === 'antrag' ? props.antragTyp : undefined
  const thumbnailView = props.thumbnailView ?? false

  const [showPicker, setShowPicker] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bescheidFromBelegId, setBescheidFromBelegId] = useState<string | null>(null)

  const { data: belege = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      props.mode === 'rechnung'
        ? getBelegeForRechnung(props.id)
        : getBelegeForAntrag(props.id),
  })

  const addMut = useMutation({
    mutationFn: (belegId: string) =>
      props.mode === 'rechnung'
        ? addBelegToRechnung(props.id, belegId)
        : addBelegToAntrag(props.id, belegId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => setError(e.message),
  })

  const removeMut = useMutation({
    mutationFn: (belegId: string) =>
      props.mode === 'rechnung'
        ? removeBelegFromRechnung(props.id, belegId)
        : removeBelegFromAntrag(props.id, belegId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const handleOpen = async (b: Beleg) => {
    setOpeningId(b.id)
    setError(null)
    try {
      const blobUrl = await fetchBelegBlob(b.id)
      const win = window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
      if (!win) setError('Popup-Blocker aktiv')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF konnte nicht geöffnet werden')
    } finally {
      setOpeningId(null)
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '7px 10px', fontSize: 12,
    background: 'var(--surface-alt)',
    border: '1px solid var(--border)',
    borderRadius: 6,
  }

  const bescheidBelegInView = belege.find(b => b.id === bescheidFromBelegId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {isLoading && <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: 0 }}>Lade…</p>}

      {/* ── Thumbnail-Raster (Slider-Ansicht) ── */}
      {thumbnailView ? (
        belege.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 4,
          }}>
            {belege.map(b => (
              <BelegThumbCard
                key={b.id}
                beleg={b}
                onOpen={() => handleOpen(b)}
                onRemove={() => removeMut.mutate(b.id)}
                opening={openingId === b.id}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Listen-Ansicht (Tabelle / Antrag-Kontext) ── */
        belege.map(b => (
          <div key={b.id} style={rowStyle}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
                style={{ color: 'var(--rose)', flexShrink: 0 }}>
                <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
              </svg>

              <button onClick={() => handleOpen(b)} disabled={openingId === b.id}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--primary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: openingId === b.id ? 0.5 : 1 }}
                title={b.bezeichnung || b.dateiname}>
                {openingId === b.id ? 'Öffne…' : (b.bezeichnung || b.dateiname)}
              </button>

              {/* Bescheid erstellen – nur im Antrag-Kontext bei Bescheid-Typen */}
              {props.mode === 'antrag' && isBescheidTyp(b.typ) && (
                <button
                  onClick={() => setBescheidFromBelegId(bescheidFromBelegId === b.id ? null : b.id)}
                  style={{
                    fontSize: 10, padding: '2px 7px', flexShrink: 0,
                    background: bescheidFromBelegId === b.id ? 'var(--primary)' : 'none',
                    color: bescheidFromBelegId === b.id ? '#fff' : 'var(--primary)',
                    border: '1px solid var(--primary)', borderRadius: 4, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${antragTyp === 'pkv' ? 'Abrechnung' : 'Bescheid'} aus diesem Beleg erstellen`}
                >
                  → {antragTyp === 'pkv' ? 'Abrechnung' : 'Bescheid'}
                </button>
              )}

              <button onClick={() => removeMut.mutate(b.id)} disabled={removeMut.isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 15, lineHeight: 1, flexShrink: 0, opacity: removeMut.isPending ? 0.5 : 1 }}
                title="Verknüpfung entfernen">×</button>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-subtle)', flexWrap: 'wrap', paddingLeft: 21 }}>
              {b.typ && <span>{TYP_LABELS[b.typ]}</span>}
              {b.aussteller && <span>{b.aussteller}</span>}
              {b.datum && <span>{formatDate(b.datum)}</span>}
              {b.aktenzeichen && <span>Az: {b.aktenzeichen}</span>}
              {b.betrag != null && <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{formatEuro(b.betrag)}</span>}
              <span style={{ marginLeft: 'auto' }}>{formatBytes(b.groesse)}</span>
            </div>

            {/* Inline Bescheid-Formular */}
            {bescheidFromBelegId === b.id && bescheidBelegInView && props.mode === 'antrag' && (
              <div style={{ marginTop: 4 }}>
                <BescheidAusBeleg
                  antragId={props.id}
                  antragTyp={antragTyp}
                  beleg={bescheidBelegInView}
                  onDone={() => setBescheidFromBelegId(null)}
                  onCancel={() => setBescheidFromBelegId(null)}
                />
              </div>
            )}
          </div>
        ))
      )}

      {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}

      {showUpload ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface-alt)' }}>
          <BelegeUpload
            queryKeys={[queryKey]}
            onUploaded={() => { setShowUpload(false); qc.invalidateQueries({ queryKey }) }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowPicker(true)}
            style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px dashed var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
            + Beleg verknüpfen
          </button>
          <button onClick={() => setShowUpload(true)}
            style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px dashed var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
            + Neuer Beleg
          </button>
        </div>
      )}

      {showPicker && (
        <BelegPicker
          excludeIds={belege.map(b => b.id)}
          onSelect={b => { addMut.mutate(b.id); setShowPicker(false) }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
