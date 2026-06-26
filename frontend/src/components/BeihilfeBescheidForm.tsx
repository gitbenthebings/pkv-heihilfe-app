import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBescheid, deleteBescheid,
  createPosition, deletePosition, getPositionen,
  updateBescheid, updatePosition,
} from '../api/beihilfe_bescheide'
import { getConfig } from '../api/config'
import { verarbeiteBescheidPDF, type RechnungMapping, type N8nExtrahiertePosition } from '../api/n8n'
import BescheidAnhangUpload from './BescheidAnhangUpload'
import type {
  BeihilfeBescheid, BescheidPosition, Rechnung, Person,
  CreateBeihilfeBescheid, UpdateBeihilfeBescheid, UpdateBescheidPosition,
  AntragRechnung, BescheidVorschlag, BescheidVorschlagPosition,
} from '../types'

// bescheid/position values are in Cent
function formatCent(cent: number) {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
// rechnung.betrag is in Euro
function formatEuro(eur: number) {
  return eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
function formatDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('de-DE')
}

const AKZENT: Record<string, { color: string }> = {
  erstbescheid:         { color: 'var(--teal)' },
  widerspruchsbescheid: { color: 'var(--amber)' },
}

// Inline-editable cell — click to edit, blur to save
function InlineCell({
  displayValue, inputValue, type = 'text', onSave, style,
}: {
  displayValue: React.ReactNode
  inputValue: string
  type?: string
  onSave: (v: string) => void
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(inputValue)

  if (editing) {
    return (
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setVal(inputValue); setEditing(false) }
        }}
        style={{ width: 80, padding: '2px 5px', fontSize: 12, textAlign: 'right', borderRadius: 4, ...style }}
      />
    )
  }
  return (
    <span
      onClick={() => { setVal(inputValue); setEditing(true) }}
      style={{ cursor: 'text', ...style }}
      title="Klicken zum Bearbeiten"
    >
      {displayValue}
    </span>
  )
}

// ── Circular Gauge SVG ───────────────────────────────────────────────────
function Gauge({ approved, total, size = 68 }: { approved: number; total: number; size?: number }) {
  const R = size * 0.37
  const C = 2 * Math.PI * R
  const pct = total > 0 ? Math.max(0, Math.min(1, approved / total)) : 0
  const col = pct >= 0.75 ? 'var(--green)' : pct >= 0.4 ? 'var(--amber)' : 'var(--rose)'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--surface-hi)" strokeWidth={size * 0.11} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={col} strokeWidth={size * 0.11}
          strokeDasharray={`${pct * C} ${C}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .7s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.2, fontWeight: 800, color: col, lineHeight: 1, letterSpacing: '-.02em' }}>{Math.round(pct * 100)}</span>
        <span style={{ fontSize: size * 0.13, color: 'var(--text-subtle)', lineHeight: 1 }}>%</span>
      </div>
    </div>
  )
}

interface KarteProps {
  antragId: string
  b: BeihilfeBescheid
  antragRechnungen: AntragRechnung[]
  rechnungMap: Record<string, Rechnung>
  personMap: Record<string, Person>
  onDelete: (id: string) => void
  deleting: boolean
  isOverridden: boolean
  onOpenRechnung?: (id: string) => void
}

function BescheidKarte({ antragId, b, antragRechnungen, rechnungMap, personMap, onDelete, deleting, isOverridden, onOpenRechnung }: KarteProps) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(!isOverridden)
  const [ocrOffene, setOcrOffene] = useState<BescheidVorschlagPosition[]>([])
  const [vorschlagMsg, setVorschlagMsg] = useState<string | null>(null)

  const { data: pos = [] } = useQuery({
    queryKey: ['positionen', b.id],
    queryFn: () => getPositionen(antragId, b.id),
  })

  const invalidatePos = () => {
    qc.invalidateQueries({ queryKey: ['positionen', b.id] })
    qc.invalidateQueries({ queryKey: ['rechnungen'] })
  }

  const updateBescheidMut = useMutation({
    mutationFn: (data: UpdateBeihilfeBescheid) => updateBescheid(antragId, b.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bescheide', antragId] }),
  })

  const addPosMut = useMutation({
    mutationFn: (rechnungId: string) => {
      const r = rechnungMap[rechnungId]
      const person = r ? personMap[r.person_id] : undefined
      const anerkannt = r && person ? Math.round(r.betrag * person.beihilfe_satz) / 100 : undefined
      const tatsaechlich = r ? r.betrag : undefined
      return createPosition(antragId, b.id, {
        rechnung_id: rechnungId,
        tatsaechliche_kosten: tatsaechlich,
        anerkannt_betrag: anerkannt,
      })
    },
    onSuccess: invalidatePos,
  })

  const updatePosMut = useMutation({
    mutationFn: ({ posId, data }: { posId: string; data: UpdateBescheidPosition }) =>
      updatePosition(antragId, b.id, posId, data),
    onSuccess: invalidatePos,
  })

  const deletePosMut = useMutation({
    mutationFn: (posId: string) => deletePosition(antragId, b.id, posId),
    onSuccess: invalidatePos,
  })

  const ac = AKZENT[b.typ] ?? AKZENT.erstbescheid
  const typLabel = b.typ === 'widerspruchsbescheid' ? 'Widerspruchsbescheid' : 'Erstbescheid'

  const sumAnerkannt = pos.reduce((s, p) => s + (p.anerkannt_betrag ?? 0), 0)
  const sumTatsaechlich = pos.reduce((s, p) => s + (p.tatsaechliche_kosten ?? 0), 0)
  const sumAbgelehnt = pos.reduce((s, p) => s + (p.abgelehnt_betrag ?? 0), 0)
  const diffZuGesamt = sumAnerkannt - b.erstattungsbetrag_gesamt
  // Gauge denominator: prefer tatsaechliche_kosten; fall back to sum of rechnung Beträge (in Cent)
  const sumRechnungenCent = pos.reduce((s, p) => {
    const r = rechnungMap[p.rechnung_id]
    return s + (r ? r.betrag * 100 : 0)
  }, 0)
  const gaugeTotal = sumTatsaechlich > 0 ? sumTatsaechlich : sumRechnungenCent

  const savePos = (p: BescheidPosition, field: keyof UpdateBescheidPosition, raw: string) => {
    const parsed = parseFloat(raw)
    updatePosMut.mutate({ posId: p.id, data: { [field]: isNaN(parsed) ? null : parsed } })
  }

  const handleVorschlag = async (vorschlag: BescheidVorschlag) => {
    // Meta-Felder übernehmen
    const upd: UpdateBeihilfeBescheid = {}
    if (vorschlag.bescheid_datum) upd.bescheid_datum = vorschlag.bescheid_datum
    if (vorschlag.aktenzeichen) upd.aktenzeichen = vorschlag.aktenzeichen
    if (vorschlag.erstattungsbetrag_gesamt != null) upd.erstattungsbetrag_gesamt = vorschlag.erstattungsbetrag_gesamt
    if (Object.keys(upd).length > 0) await updateBescheidMut.mutateAsync(upd)

    // Positionen: nur gematchte, noch nicht vorhandene anlegen
    const existing = new Set(pos.map(p => p.rechnung_id))
    const matched = vorschlag.positionen.filter(p => p.rechnung_id && !existing.has(p.rechnung_id))
    const unmatched = vorschlag.positionen.filter(p => !p.rechnung_id)

    for (const p of matched) {
      await createPosition(antragId, b.id, {
        rechnung_id: p.rechnung_id!,
        tatsaechliche_kosten: p.tatsaechliche_kosten ?? undefined,
        anerkannt_betrag: p.anerkannt_betrag ?? undefined,
        abgelehnt_betrag: p.abgelehnt_betrag ?? undefined,
      })
    }

    invalidatePos()
    setOcrOffene(unmatched)
    setVorschlagMsg(
      matched.length > 0
        ? `${matched.length} Position(en) übernommen.${unmatched.length > 0 ? ` ${unmatched.length} konnte(n) nicht zugeordnet werden.` : ''}`
        : unmatched.length > 0
        ? `${unmatched.length} Position(en) ohne Rechnungszuordnung — bitte manuell erfassen.`
        : 'Keine passenden Positionen gefunden.'
    )
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
      opacity: isOverridden ? 0.6 : 1, transition: 'opacity .2s',
    }}>
      {/* ── Card header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
          background: 'var(--surface-alt)', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <Gauge approved={sumAnerkannt} total={gaugeTotal} size={60} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{typLabel}</span>
            {isOverridden && (
              <span style={{ fontSize: 9, color: 'var(--text-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px' }}>
                überschrieben
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginLeft: 'auto' }}>{formatDate(b.bescheid_datum) ?? '—'}</span>
          </div>
          {/* Approval bar */}
          <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--rose-dim)', marginBottom: 6 }}>
            <div style={{
              width: `${gaugeTotal > 0 ? (sumAnerkannt / gaugeTotal) * 100 : 0}%`,
              height: '100%', background: 'var(--green)',
              transition: 'width .6s cubic-bezier(.4,0,.2,1)', borderRadius: 3,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>BH-Erstattung {formatCent(sumAnerkannt)}</span>
            {sumAbgelehnt > 50 && (
              <span style={{ color: 'var(--rose)', fontWeight: 600 }}>Nicht beihilfefähig {formatCent(sumAbgelehnt)}</span>
            )}
            <span style={{ color: ac.color, fontWeight: 700, marginLeft: 'auto' }}>Gesamt {formatCent(b.erstattungsbetrag_gesamt)}</span>
          </div>
        </div>

        <span style={{ color: 'var(--text-subtle)', fontSize: 10, flexShrink: 0 }}>{open ? '∧' : '∨'}</span>
      </div>

      {open && (
        <div style={{ padding: '14px 14px 16px', background: 'var(--surface)' }}>

          {/* ── Meta fields (inline editable) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 14 }}>
            {[
              { label: 'AKTENZEICHEN', display: b.aktenzeichen ?? '—', inputVal: b.aktenzeichen ?? '', type: 'text', onSave: (v: string) => updateBescheidMut.mutate({ aktenzeichen: v || undefined }) },
              { label: 'BESCHEIDDATUM', display: formatDate(b.bescheid_datum) ?? '—', inputVal: b.bescheid_datum, type: 'date', onSave: (v: string) => updateBescheidMut.mutate({ bescheid_datum: v || undefined }) },
              { label: 'EINGANGSDATUM', display: formatDate(b.eingangsdatum) ?? '—', inputVal: b.eingangsdatum ?? '', type: 'date', onSave: (v: string) => updateBescheidMut.mutate({ eingangsdatum: v || undefined }) },
              { label: 'ERSTATTUNGSBETRAG (€)', display: formatCent(b.erstattungsbetrag_gesamt), inputVal: (b.erstattungsbetrag_gesamt / 100).toString(), type: 'number', onSave: (v: string) => updateBescheidMut.mutate({ erstattungsbetrag_gesamt: parseFloat(v) || 0 }) },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em', marginBottom: 3 }}>{f.label}</div>
                <InlineCell
                  displayValue={f.display}
                  inputValue={f.inputVal}
                  type={f.type}
                  onSave={f.onSave}
                  style={{ fontSize: 12, color: 'var(--text-muted)' }}
                />
              </div>
            ))}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em', marginBottom: 3 }}>NOTIZ</div>
              <InlineCell
                displayValue={b.notiz ?? '—'}
                inputValue={b.notiz ?? ''}
                onSave={(v) => updateBescheidMut.mutate({ notiz: v || undefined })}
                style={{ fontSize: 12, color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          {/* ── Positions table ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 12 }}>
            <thead>
              <tr>
                {['Rechnung', 'BH-fähige Kosten', 'BH-Erstattung', 'Nicht beihilfefähig', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '4px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: 'var(--text-subtle)', textAlign: i === 0 ? 'left' : 'right',
                    borderBottom: '1px solid var(--border)',
                  }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pos.map((p: BescheidPosition) => {
                const r = rechnungMap[p.rechnung_id]
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--row-border)' }}>
                    <td style={{ padding: '7px 8px' }}>
                      <button
                        onClick={() => onOpenRechnung?.(p.rechnung_id)}
                        style={{ fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: onOpenRechnung ? 'pointer' : 'default', padding: 0, fontSize: 12, marginRight: 4 }}
                      >
                        {r ? `R-${String(r.referenz_nr).padStart(4, '0')}` : p.rechnung_id.slice(0, 8)}
                      </button>
                      {r && <span style={{ color: 'var(--text-subtle)', fontSize: 11 }}>· {formatEuro(r.betrag)}</span>}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <InlineCell
                        displayValue={p.tatsaechliche_kosten != null ? formatCent(p.tatsaechliche_kosten) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        inputValue={p.tatsaechliche_kosten != null ? (p.tatsaechliche_kosten / 100).toString() : ''}
                        type="number"
                        onSave={(v) => savePos(p, 'tatsaechliche_kosten', v)}
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <InlineCell
                        displayValue={p.anerkannt_betrag != null
                          ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>{formatCent(p.anerkannt_betrag)}</span>
                          : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        inputValue={p.anerkannt_betrag != null ? (p.anerkannt_betrag / 100).toString() : ''}
                        type="number"
                        onSave={(v) => savePos(p, 'anerkannt_betrag', v)}
                      />
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 13 }}>
                      <InlineCell
                        displayValue={p.abgelehnt_betrag != null && p.abgelehnt_betrag > 0
                          ? <span style={{ color: 'var(--rose)', fontWeight: 700 }}>✗</span>
                          : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        inputValue={p.abgelehnt_betrag != null ? (p.abgelehnt_betrag / 100).toString() : ''}
                        type="number"
                        onSave={(v) => savePos(p, 'abgelehnt_betrag', v)}
                      />
                    </td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', width: 24 }}>
                      <button
                        onClick={() => deletePosMut.mutate(p.id)}
                        style={{ fontSize: 15, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
                      >×</button>
                    </td>
                  </tr>
                )
              })}
              {/* Sum row */}
              {pos.length > 1 && (
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 700, color: 'var(--text)', fontSize: 11 }}>Summe</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-subtle)', fontSize: 11 }}>
                    {sumTatsaechlich > 0 ? formatCent(sumTatsaechlich) : '—'}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: ac.color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCent(sumAnerkannt)}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-subtle)' }}>
                    {sumAbgelehnt > 0 ? '✗' : '—'}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>

          {/* Validation */}
          {pos.length > 0 && (
            <div style={{
              fontSize: 11, marginBottom: 12, padding: '4px 10px', borderRadius: 5, display: 'inline-block',
              background: diffZuGesamt === 0 ? 'var(--green-dim)' : 'var(--rose-dim)',
              color: diffZuGesamt === 0 ? 'var(--green)' : 'var(--rose)',
            }}>
              {diffZuGesamt === 0
                ? '✓ Summe stimmt mit Bescheid überein'
                : `Δ ${formatCent(Math.abs(diffZuGesamt))} Abweichung zum Bescheid-Gesamtbetrag`}
            </div>
          )}

          {/* Add rechnung */}
          {antragRechnungen.filter(ar => !pos.some(p => p.rechnung_id === ar.rechnung_id)).length > 0 && (
            <select
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}
              defaultValue=""
              onChange={e => { if (e.target.value) { addPosMut.mutate(e.target.value); e.target.value = '' } }}
            >
              <option value="">+ Rechnung zuordnen…</option>
              {antragRechnungen
                .filter(ar => !pos.some(p => p.rechnung_id === ar.rechnung_id))
                .map(ar => {
                  const r = rechnungMap[ar.rechnung_id]
                  return (
                    <option key={ar.rechnung_id} value={ar.rechnung_id}>
                      {r ? `R-${String(r.referenz_nr).padStart(4, '0')} – ${formatEuro(r.betrag)}` : ar.rechnung_id}
                    </option>
                  )
                })}
            </select>
          )}

          {/* ── Anhänge & OCR ── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.08em', marginBottom: 8 }}>ANHÄNGE</div>
            <BescheidAnhangUpload
              antragId={antragId}
              bescheidId={b.id}
              onVorschlag={handleVorschlag}
            />
          </div>

          {/* OCR Vorschlag Ergebnis */}
          {vorschlagMsg && (
            <div style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 6, marginTop: 4,
              background: 'var(--primary-dim)', color: 'var(--primary)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{vorschlagMsg}</span>
              <button onClick={() => { setVorschlagMsg(null); setOcrOffene([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>
          )}
          {ocrOffene.length > 0 && (
            <div style={{
              background: 'var(--amber-dim)', border: '1px solid rgba(232,160,48,.3)',
              borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>
                OCR — {ocrOffene.length} Position(en) ohne Rechnung
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Diese Beträge wurden erkannt, konnten aber keiner Rechnung zugeordnet werden. Bitte oben manuell zuweisen.
              </p>
              {ocrOffene.map((p, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 6, padding: '5px 10px', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                  {p.tatsaechliche_kosten != null && <span style={{ color: 'var(--text-muted)' }}>Kosten: {p.tatsaechliche_kosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>}
                  {p.anerkannt_betrag != null && <span style={{ color: 'var(--green)', fontWeight: 600 }}>BH: {p.anerkannt_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>}
                  {p.abgelehnt_betrag != null && p.abgelehnt_betrag > 0 && <span style={{ color: 'var(--rose)' }}>✗ {p.abgelehnt_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Footer: delete */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={() => confirm('Bescheid löschen?') && onDelete(b.id)}
              disabled={deleting}
              style={{ fontSize: 11, color: 'var(--rose)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  antragId: string
  antragTyp?: 'beihilfe' | 'pkv'
  bescheide: BeihilfeBescheid[]
  antragRechnungen: AntragRechnung[]
  rechnungen: Rechnung[]
  personMap: Record<string, Person>
  onOpenRechnung?: (id: string) => void
}

export default function BeihilfeBescheidForm({ antragId, antragTyp, bescheide, antragRechnungen, rechnungen, personMap, onOpenRechnung }: Props) {
  const isPkv = antragTyp === 'pkv'
  const bescheidLabel = isPkv ? 'Abrechnung' : 'Bescheid'
  const bescheideLabel = isPkv ? 'Abrechnungen' : 'Bescheide'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CreateBeihilfeBescheid>({
    bescheid_datum: new Date().toISOString().slice(0, 10),
    erstattungsbetrag_gesamt: 0,
  })

  const [n8nUploading, setN8nUploading] = useState(false)
  const [n8nMsg, setN8nMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [n8nOffenePositionen, setN8nOffenePositionen] = useState<N8nExtrahiertePosition[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig })
  const n8nUrl = config?.n8n_webhook_url

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bescheide', antragId] })

  const createMut = useMutation({
    mutationFn: (data: CreateBeihilfeBescheid) => createBescheid(antragId, data),
    onSuccess: () => { invalidate(); setShowForm(false) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBescheid(antragId, id),
    onSuccess: invalidate,
  })

  const rechnungMap = Object.fromEntries(rechnungen.map(r => [r.id, r]))
  const hasWiderspruch = bescheide.some(b => b.typ === 'widerspruchsbescheid')

  const handleN8nScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !n8nUrl) return
    e.target.value = ''

    // Mapping: verschiedene Referenz-Formate → Rechnungs-UUID
    const mapping: RechnungMapping = {}
    antragRechnungen.forEach(ar => {
      const r = rechnungen.find(x => x.id === ar.rechnung_id)
      if (r?.referenz_nr != null) {
        const num = r.referenz_nr
        mapping[`R-${String(num).padStart(4, '0')}`] = r.id
        mapping[`R-${num}`] = r.id
        mapping[String(num)] = r.id
      }
    })

    setN8nUploading(true); setN8nMsg(null); setN8nOffenePositionen([])
    try {
      const ergebnis = await verarbeiteBescheidPDF(n8nUrl, antragId, file, mapping)
      invalidate()
      qc.invalidateQueries({ queryKey: ['antrag', antragId] })
      qc.invalidateQueries({ queryKey: ['antraege'] })

      // Positionen ohne Mapping ermitteln und für manuelle Erfassung anzeigen
      const mappedRefs = new Set(Object.keys(mapping))
      const offene = ergebnis.alle_positionen_claude.filter(
        p => !mappedRefs.has(p.rechnungs_referenz)
      )
      setN8nOffenePositionen(offene)

      const gesamtEUR = ergebnis.extrahierte_daten.erstattungsbetrag_gesamt
        .toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
      setN8nMsg({
        ok: true,
        text: offene.length > 0
          ? `Bescheid angelegt (${gesamtEUR}). ${offene.length} Position(en) konnten nicht automatisch zugewiesen werden — bitte unten manuell erfassen.`
          : `Bescheid erfolgreich verarbeitet (${gesamtEUR}).`,
      })
    } catch (err) {
      setN8nMsg({ ok: false, text: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    } finally {
      setN8nUploading(false)
    }
  }

  // bescheide are ordered DESC by date, so index 0 is most recent → not overridden
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hidden file input für KI-Scan */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleN8nScan}
      />

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.08em', marginBottom: 3 }}>{bescheideLabel.toUpperCase()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {bescheide.length === 0
              ? `Keine ${bescheidLabel} vorhanden`
              : `${bescheide.length} ${bescheide.length !== 1 ? bescheideLabel : bescheidLabel}`}
            {hasWiderspruch && (
              <span style={{
                background: 'var(--amber-dim)', border: '1px solid rgba(232,160,48,.3)',
                borderRadius: 10, padding: '1px 7px', fontSize: 9, fontWeight: 700, color: 'var(--amber)',
              }}>
                Widerspruch eingereicht
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {n8nUrl && !isPkv && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={n8nUploading}
              className="app-btn-secondary"
              style={{ fontSize: 11, padding: '5px 12px' }}
              title="Beihilfebescheid als PDF hochladen und automatisch per KI verarbeiten"
            >
              {n8nUploading ? 'Analysiere…' : 'KI-Scan'}
            </button>
          )}
          <button
            onClick={() => setShowForm(s => !s)}
            className={showForm ? 'app-btn-secondary' : 'app-btn-primary'}
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            {showForm ? 'Abbrechen' : `+ ${bescheidLabel}`}
          </button>
        </div>
      </div>

      {/* KI-Scan Ergebnis */}
      {n8nMsg && (
        <p style={{ fontSize: 12, color: n8nMsg.ok ? 'var(--green)' : 'var(--rose)', margin: 0 }}>
          {n8nMsg.ok ? '✓ ' : '✗ '}{n8nMsg.text}
        </p>
      )}

      {/* KI-Scan: Nicht gemappte Positionen zur manuellen Erfassung */}
      {n8nOffenePositionen.length > 0 && (
        <div style={{
          background: 'var(--amber-dim)', border: '1px solid rgba(232,160,48,.3)',
          borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>
              KI-Extraktion — bitte manuell zuweisen
            </span>
            <button
              onClick={() => setN8nOffenePositionen([])}
              style={{ fontSize: 10, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            Diese Positionen wurden vom KI-Scan erkannt, konnten aber keiner Rechnung automatisch zugewiesen werden.
            Bitte im entsprechenden Bescheid manuell als Position hinzufügen.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {n8nOffenePositionen.map((p, i) => (
              <div key={i} style={{
                background: 'var(--surface)', borderRadius: 6, padding: '6px 10px',
                fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.rechnungs_referenz}</span>
                {p.leistungsart && <span style={{ color: 'var(--text-muted)' }}>{p.leistungsart}</span>}
                {p.tatsaechliche_kosten != null && (
                  <span style={{ color: 'var(--text-subtle)' }}>
                    Kosten: {p.tatsaechliche_kosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
                {p.anerkannt_betrag != null && (
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                    Anerkannt: {p.anerkannt_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
                {p.abgelehnt_betrag != null && p.abgelehnt_betrag > 0 && (
                  <span style={{ color: 'var(--rose)' }}>
                    Abgelehnt: {p.abgelehnt_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
                {p.ablehnungsgrund && (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{p.ablehnungsgrund}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Bescheiddatum', key: 'bescheid_datum', type: 'date', value: formData.bescheid_datum },
              { label: 'Eingangsdatum', key: 'eingangsdatum', type: 'date', value: formData.eingangsdatum ?? '' },
              { label: 'Erstattungsbetrag (€)', key: 'erstattungsbetrag_gesamt', type: 'number', value: formData.erstattungsbetrag_gesamt },
              { label: 'Typ', key: 'typ', type: 'select', value: formData.typ ?? 'erstbescheid' },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={f.value as string}
                    onChange={e => setFormData(v => ({ ...v, typ: e.target.value as 'erstbescheid' | 'widerspruchsbescheid' }))}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 5 }}
                  >
                    <option value="erstbescheid">Erstbescheid</option>
                    <option value="widerspruchsbescheid">Widerspruchsbescheid</option>
                  </select>
                ) : (
                  <input
                    type={f.type}
                    step={f.type === 'number' ? '0.01' : undefined}
                    value={f.value as string | number}
                    onChange={e => {
                      const val = f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                      setFormData(v => ({ ...v, [f.key]: val || undefined }))
                    }}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 5 }}
                  />
                )}
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-1">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aktenzeichen</label>
              <input type="text" value={formData.aktenzeichen ?? ''}
                onChange={e => setFormData(v => ({ ...v, aktenzeichen: e.target.value || undefined }))}
                style={{ padding: '5px 8px', fontSize: 12, borderRadius: 5 }} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notiz</label>
              <input type="text" value={formData.notiz ?? ''}
                onChange={e => setFormData(v => ({ ...v, notiz: e.target.value || undefined }))}
                style={{ padding: '5px 8px', fontSize: 12, borderRadius: 5 }} />
            </div>
          </div>
          <button onClick={() => createMut.mutate(formData)} disabled={createMut.isPending} className="app-btn-primary" style={{ fontSize: 11 }}>
            {createMut.isPending ? 'Speichern…' : 'Bescheid anlegen'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {bescheide.length === 0 && !showForm && (
        <div style={{
          textAlign: 'center', padding: '32px 16px',
          border: '1px dashed var(--border)', borderRadius: 10,
          color: 'var(--text-subtle)', fontSize: 12, lineHeight: 1.7,
        }}>
          Noch kein Bescheid erhalten.<br />
          <span style={{ fontSize: 11 }}>Klicke „+ Bescheid" sobald du eine Rückmeldung erhältst.</span>
        </div>
      )}

      {/* Bescheid cards — ordered DESC (index 0 = newest = not overridden) */}
      {bescheide.map((b, i) => (
        <BescheidKarte
          key={b.id}
          antragId={antragId}
          b={b}
          antragRechnungen={antragRechnungen}
          rechnungMap={rechnungMap}
          personMap={personMap}
          onDelete={(id) => deleteMut.mutate(id)}
          deleting={deleteMut.isPending}
          isOverridden={i > 0 && bescheide.length > 1}
          onOpenRechnung={onOpenRechnung}
        />
      ))}
    </div>
  )
}
