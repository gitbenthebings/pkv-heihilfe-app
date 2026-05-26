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

const AKTION_LABELS: Record<string, string> = {
  erstellt: 'Rechnung erstellt',
  geaendert: 'Rechnung geändert',
  antrag_zugewiesen: 'Antrag zugewiesen',
  antrag_entfernt: 'Antrag entfernt',
  anhang_hochgeladen: 'Anhang hochgeladen',
  anhang_geloescht: 'Anhang gelöscht',
}

function formatCent(val: string | null): string {
  if (val === null) return '—'
  const n = parseInt(val, 10)
  if (isNaN(n)) return val
  return (n / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatFieldValue(feld: string, val: string | null): string {
  if (val === null || val === '') return '—'
  if (['betrag', 'beihilfe_erstattet_betrag', 'pkv_erstattet_betrag'].includes(feld)) {
    return formatCent(val)
  }
  if (['pkv_gescannt', 'beihilfe_gescannt', 'pkv_verzicht'].includes(feld)) {
    return val === 'true' ? 'Ja' : 'Nein'
  }
  if (['datum', 'zahlungsziel', 'bezahlt_am', 'beihilfe_eingereicht_am', 'pkv_eingereicht_am'].includes(feld)) {
    try { return new Date(val).toLocaleDateString('de-DE') } catch { return val }
  }
  return val
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function DiffRow({ diff }: { diff: AktivitaetDiff }) {
  const label = FELD_LABELS[diff.feld] ?? diff.feld
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-gray-500 dark:text-gray-400 w-32 shrink-0">{label}</span>
      <span className="text-red-600 dark:text-red-400 line-through">{formatFieldValue(diff.feld, diff.alt)}</span>
      <span className="text-gray-400">→</span>
      <span className="text-green-600 dark:text-green-400">{formatFieldValue(diff.feld, diff.neu)}</span>
    </div>
  )
}

function AktivitaetItem({ item, rechnungLabel }: { item: RechnungAktivitaet; rechnungLabel?: string }) {
  let diffs: AktivitaetDiff[] = []
  let extra: Record<string, string> = {}
  try {
    const parsed = JSON.parse(item.aenderungen)
    if (Array.isArray(parsed)) {
      diffs = parsed
    } else if (parsed && typeof parsed === 'object') {
      extra = parsed
    }
  } catch { /* ignore */ }

  const aktionLabel = AKTION_LABELS[item.aktion] ?? item.aktion

  return (
    <div className="border-l-2 border-gray-200 dark:border-gray-600 pl-3 py-1">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{aktionLabel}</span>
          {rechnungLabel && (
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{rechnungLabel}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatTimestamp(item.erstellt_am)}</span>
      </div>

      {diffs.length > 0 && (
        <div className="space-y-0.5">
          {diffs.map((d, i) => <DiffRow key={i} diff={d} />)}
        </div>
      )}

      {Object.keys(extra).length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(extra).map(([k, v]) => (
            <span key={k} className="mr-3">{k}: {v}</span>
          ))}
        </div>
      )}
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
    return <p className="text-sm text-gray-400 dark:text-gray-500">Lade Aktivitätslog…</p>
  }

  if (aktivitaeten.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Keine Aktivitäten vorhanden.</p>
  }

  return (
    <div className="space-y-3">
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
