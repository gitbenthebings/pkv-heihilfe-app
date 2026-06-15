import type { RechnungAktivitaet, AktivitaetDiff, Rechnung } from '../types'

const FELD_LABELS: Record<string, string> = {
  betrag: 'Betrag',
  datum: 'Datum',
  zahlungsziel: 'Zahlungsziel',
  bezahlt_am: 'Bezahlt am',
  beihilfe_eingereicht_am: 'Beihilfe eingereicht',
  pkv_eingereicht_am: 'PKV eingereicht',
  notiz: 'Notiz',
  leistungserbringer_id: 'Leistungserbringer',
  typ: 'Typ',
  person_id: 'Person',
  pkv_gescannt: 'PKV gescannt',
  beihilfe_gescannt: 'Beihilfe gescannt',
  pkv_verzicht: 'PKV-Verzicht',
  beihilfe_erstattet_betrag: 'Beihilfe erstattet',
  pkv_erstattet_betrag: 'PKV erstattet',
}

export const AKTION_LABELS: Record<string, string> = {
  erstellt: 'Rechnung erstellt',
  geaendert: 'Rechnung geändert',
  antrag_zugewiesen: 'Antrag zugewiesen',
  antrag_entfernt: 'Antrag entfernt',
  anhang_hochgeladen: 'Anhang hochgeladen',
  anhang_geloescht: 'Anhang gelöscht',
}

export const AKTION_DOT: Record<string, string> = {
  erstellt: 'var(--green)',
  geaendert: 'var(--blue)',
  antrag_zugewiesen: 'var(--teal)',
  antrag_entfernt: 'var(--amber)',
  anhang_hochgeladen: 'var(--purple)',
  anhang_geloescht: 'var(--rose)',
}

function formatCent(val: string | null): string {
  if (val === null) return '—'
  const n = parseInt(val, 10)
  if (isNaN(n)) return val
  return (n / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatFieldValue(feld: string, val: string | null): string {
  if (val === null || val === '') return '—'
  if (['betrag', 'beihilfe_erstattet_betrag', 'pkv_erstattet_betrag'].includes(feld)) return formatCent(val)
  if (['pkv_gescannt', 'beihilfe_gescannt', 'pkv_verzicht'].includes(feld)) return val === 'true' ? 'Ja' : 'Nein'
  if (['datum', 'zahlungsziel', 'bezahlt_am', 'beihilfe_eingereicht_am', 'pkv_eingereicht_am'].includes(feld)) {
    try { return new Date(val).toLocaleDateString('de-DE') } catch { return val }
  }
  return val
}

export function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return ts }
}

function DiffRow({ diff }: { diff: AktivitaetDiff }) {
  const label = FELD_LABELS[diff.feld] ?? diff.feld
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11 }}>
      <span style={{ color: 'var(--text-subtle)', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--rose)', textDecoration: 'line-through' }}>{formatFieldValue(diff.feld, diff.alt)}</span>
      <span style={{ color: 'var(--text-subtle)' }}>→</span>
      <span style={{ color: 'var(--green)' }}>{formatFieldValue(diff.feld, diff.neu)}</span>
    </div>
  )
}

export function parseAenderungen(raw: string): { diffs: AktivitaetDiff[]; extra: Record<string, string> } {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { diffs: parsed, extra: {} }
    if (parsed && typeof parsed === 'object') return { diffs: [], extra: parsed }
  } catch { /* ignore */ }
  return { diffs: [], extra: {} }
}

export function AktivitaetDiffs({ item }: { item: RechnungAktivitaet }) {
  const { diffs, extra } = parseAenderungen(item.aenderungen)
  if (diffs.length === 0 && Object.keys(extra).length === 0) return null
  return (
    <div style={{ marginTop: 4 }}>
      {diffs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {diffs.map((d, i) => <DiffRow key={i} diff={d} />)}
        </div>
      )}
      {Object.keys(extra).length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(extra).map(([k, v]) => <span key={k}>{k}: {v}</span>)}
        </div>
      )}
    </div>
  )
}

export function AktivitaetItem({ item, rechnungLabel }: { item: RechnungAktivitaet; rechnungLabel?: string }) {
  const aktionLabel = AKTION_LABELS[item.aktion] ?? item.aktion
  const dot = AKTION_DOT[item.aktion] ?? 'var(--text-subtle)'
  const { diffs } = parseAenderungen(item.aenderungen)

  return (
    <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12, paddingTop: 4, paddingBottom: 4, position: 'relative' }}>
      <span style={{
        position: 'absolute', left: -5, top: 8,
        width: 8, height: 8, borderRadius: '50%',
        background: dot, border: '2px solid var(--bg)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: diffs.length > 0 ? 4 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{aktionLabel}</span>
          {rechnungLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'monospace', flexShrink: 0 }}>{rechnungLabel}</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {formatTimestamp(item.erstellt_am)}
        </span>
      </div>
      <AktivitaetDiffs item={item} />
    </div>
  )
}

interface Props {
  aktivitaeten: RechnungAktivitaet[]
  loading?: boolean
  rechnungenMap?: Record<string, Rechnung>
}

export default function AktivitaetsLog({ aktivitaeten, loading, rechnungenMap }: Props) {
  if (loading) {
    return <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Lade Aktivitätslog…</p>
  }
  if (aktivitaeten.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Keine Aktivitäten vorhanden.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {aktivitaeten.map(item => {
        let rechnungLabel: string | undefined
        if (rechnungenMap) {
          const r = rechnungenMap[item.rechnung_id]
          rechnungLabel = r?.referenz_nr != null
            ? `R-${String(r.referenz_nr).padStart(4, '0')}`
            : item.rechnung_id.slice(0, 8)
        }
        return <AktivitaetItem key={item.id} item={item} rechnungLabel={rechnungLabel} />
      })}
    </div>
  )
}
