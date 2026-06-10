import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteBeleg, updateBeleg, fetchBelegThumbnailBlob, fetchBelegBlob,
} from '../api/belege'
import { TYP_LABELS } from './BelegeUpload'
import type { Beleg, BelegTyp } from '../types'

interface Props {
  beleg: Beleg
  onDeleted?: () => void
}

const TYP_COLORS: Record<BelegTyp, string> = {
  rechnung: 'var(--teal)',
  erstbescheid: 'var(--primary)',
  widerspruchsbescheid: 'var(--amber)',
  rezept: 'var(--emerald)',
  ueberweisung: 'var(--violet)',
  sonstiges: 'var(--text-subtle)',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function formatEuro(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const isBescheidTyp = (t: BelegTyp | null) => t === 'erstbescheid' || t === 'widerspruchsbescheid'
const isLeistungserbringerTyp = (t: BelegTyp | null) => t === 'rechnung' || t === 'rezept' || t === 'ueberweisung'

function ausstellerLabel(t: BelegTyp | null): string {
  if (isBescheidTyp(t)) return 'Aussteller (Behörde / PKV)'
  if (isLeistungserbringerTyp(t)) return 'Leistungserbringer'
  return 'Aussteller'
}

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 6px',
  border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--surface)', color: 'var(--text)',
}

export default function BelegCard({ beleg, onDeleted }: Props) {
  const qc = useQueryClient()
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [bezeichnung, setBezeichnung] = useState(beleg.bezeichnung ?? '')
  const [datum, setDatum] = useState(beleg.datum ?? '')
  const [eingangsdatum, setEingangsdatum] = useState(beleg.eingangsdatum ?? '')
  const [typ, setTyp] = useState<BelegTyp | ''>(beleg.typ ?? '')
  const [aktenzeichen, setAktenzeichen] = useState(beleg.aktenzeichen ?? '')
  const [betrag, setBetrag] = useState(beleg.betrag != null ? String(beleg.betrag) : '')
  const [aussteller, setAussteller] = useState(beleg.aussteller ?? '')
  const [notiz, setNotiz] = useState(beleg.notiz ?? '')

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

  const deleteMut = useMutation({
    mutationFn: () => deleteBeleg(beleg.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['belege'] })
      onDeleted?.()
    },
  })

  const saveMut = useMutation({
    mutationFn: () => updateBeleg(beleg.id, {
      bezeichnung: bezeichnung || null,
      datum: datum || null,
      eingangsdatum: eingangsdatum || null,
      typ: (typ || null) as BelegTyp | null,
      aktenzeichen: aktenzeichen || null,
      betrag: betrag ? parseFloat(betrag) : null,
      aussteller: aussteller || null,
      notiz: notiz || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['belege'] })
      setEditing(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleOpen = async () => {
    setOpening(true)
    setError(null)
    try {
      const blobUrl = await fetchBelegBlob(beleg.id)
      const win = window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
      if (!win) setError('Popup-Blocker aktiv – bitte erlauben')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF konnte nicht geöffnet werden')
    } finally {
      setOpening(false)
    }
  }

  const displayName = beleg.bezeichnung || beleg.dateiname
  const isBescheid = isBescheidTyp(beleg.typ)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Thumbnail */}
      <div onClick={handleOpen} style={{
        height: 160, background: 'var(--surface-alt)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
      }} title="PDF öffnen">
        {thumbUrl ? (
          <img src={thumbUrl} alt={displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"
            style={{ color: 'var(--rose)', opacity: 0.7 }}>
            <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
          </svg>
        )}
        {opening && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#fff' }}>Öffne…</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Typ */}
            <select value={typ} onChange={e => setTyp(e.target.value as BelegTyp | '')} style={inputStyle}>
              <option value="">– kein Typ –</option>
              {(Object.entries(TYP_LABELS) as [BelegTyp, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {/* Bezeichnung */}
            <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
              placeholder="Bezeichnung" style={inputStyle} />
            {/* Aussteller */}
            <input value={aussteller} onChange={e => setAussteller(e.target.value)}
              placeholder={ausstellerLabel(typ as BelegTyp | null)} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                title={isBescheidTyp(typ as BelegTyp) ? 'Bescheid-Datum' : 'Belegdatum'} style={inputStyle} />
              {isBescheidTyp(typ as BelegTyp) ? (
                <input type="date" value={eingangsdatum} onChange={e => setEingangsdatum(e.target.value)}
                  title="Eingangsdatum" style={inputStyle} />
              ) : (
                <input type="number" step="0.01" value={betrag} onChange={e => setBetrag(e.target.value)}
                  placeholder="Betrag €" style={inputStyle} />
              )}
              {isBescheidTyp(typ as BelegTyp) && (
                <>
                  <input value={aktenzeichen} onChange={e => setAktenzeichen(e.target.value)}
                    placeholder="Aktenzeichen" style={inputStyle} />
                  <input type="number" step="0.01" value={betrag} onChange={e => setBetrag(e.target.value)}
                    placeholder="Erstattungsbetrag €" style={inputStyle} />
                </>
              )}
            </div>
            <textarea value={notiz} onChange={e => setNotiz(e.target.value)}
              placeholder="Notiz" rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
            {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                style={{ fontSize: 11, padding: '4px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saveMut.isPending ? 0.6 : 1 }}>
                {saveMut.isPending ? '…' : 'Speichern'}
              </button>
              <button onClick={() => { setEditing(false); setError(null) }}
                style={{ fontSize: 11, padding: '4px 10px', background: 'var(--surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                title={displayName}>
                {displayName}
              </span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => setEditing(true)}
                  style={{ fontSize: 11, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-subtle)' }}
                  title="Bearbeiten">✎</button>
                <button onClick={() => { if (confirm(`"${displayName}" wirklich löschen?`)) deleteMut.mutate() }}
                  disabled={deleteMut.isPending}
                  style={{ fontSize: 13, lineHeight: 1, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-subtle)', opacity: deleteMut.isPending ? 0.5 : 1 }}
                  title="Löschen">×</button>
              </div>
            </div>

            {/* Badges row */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {beleg.typ && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: TYP_COLORS[beleg.typ] + '22',
                  color: TYP_COLORS[beleg.typ],
                  border: `1px solid ${TYP_COLORS[beleg.typ]}44`,
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}>
                  {TYP_LABELS[beleg.typ]}
                </span>
              )}
              {beleg.datum && (
                <span style={{ fontSize: 10, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                  {formatDate(beleg.datum)}
                </span>
              )}
              {beleg.betrag != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {formatEuro(beleg.betrag)}
                </span>
              )}
            </div>

            {/* Bescheid-spezifische Felder */}
            {isBescheid && (beleg.aktenzeichen || beleg.eingangsdatum) && (
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
                {beleg.aktenzeichen && <span title="Aktenzeichen">Az: {beleg.aktenzeichen}</span>}
                {beleg.eingangsdatum && <span title="Eingangsdatum">Eingang: {formatDate(beleg.eingangsdatum)}</span>}
              </div>
            )}

            {/* Aussteller */}
            {beleg.aussteller && (
              <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={beleg.aussteller}>
                {beleg.aussteller}
              </p>
            )}

            {/* Notiz */}
            {beleg.notiz && (
              <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={beleg.notiz}>
                {beleg.notiz}
              </p>
            )}

            {/* Footer: Dateigröße + OCR-Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                {formatBytes(beleg.groesse)}
              </span>
              {beleg.ocr_status === 'done' && beleg.ocr_text && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--emerald) 15%, transparent)',
                  color: 'var(--emerald)',
                  border: '1px solid color-mix(in srgb, var(--emerald) 30%, transparent)',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }} title="OCR-Text verfügbar – durchsuchbar">
                  OCR ✓
                </span>
              )}
              {beleg.ocr_status === 'failed' && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--amber) 15%, transparent)',
                  color: 'var(--amber)',
                  border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }} title="OCR konnte keinen Text extrahieren">
                  OCR –
                </span>
              )}
              {!beleg.ocr_status && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--text-subtle) 10%, transparent)',
                  color: 'var(--text-subtle)',
                  border: '1px solid color-mix(in srgb, var(--text-subtle) 20%, transparent)',
                  fontWeight: 500, whiteSpace: 'nowrap',
                }} title="OCR läuft im Hintergrund">
                  OCR …
                </span>
              )}
            </div>

            {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
