import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRechnungen } from '../api/rechnungen'
import { getAktivitaet, getAllAktivitaet } from '../api/aktivitaet'
import { getPersonen } from '../api/personen'
import AktivitaetsLog from '../components/AktivitaetsLog'

export default function AktivitaetsLogPage() {
  const [selectedRechnungId, setSelectedRechnungId] = useState<string>('')
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')

  const { data: rechnungen = [] } = useQuery({
    queryKey: ['rechnungen'],
    queryFn: () => getRechnungen(),
  })

  const { data: personen = [] } = useQuery({
    queryKey: ['personen'],
    queryFn: getPersonen,
  })

  const { data: aktivitaetenEinzel = [], isLoading: loadingEinzel } = useQuery({
    queryKey: ['aktivitaet', selectedRechnungId],
    queryFn: () => getAktivitaet(selectedRechnungId),
    enabled: !!selectedRechnungId,
  })

  const { data: aktivitaetenAlle = [], isLoading: loadingAlle } = useQuery({
    queryKey: ['aktivitaet-alle'],
    queryFn: getAllAktivitaet,
    enabled: !selectedRechnungId,
  })

  const aktivitaeten = selectedRechnungId ? aktivitaetenEinzel : aktivitaetenAlle
  const isLoading = selectedRechnungId ? loadingEinzel : loadingAlle

  const personMap = Object.fromEntries(personen.map(p => [p.id, p]))
  const rechnungenMap = Object.fromEntries(rechnungen.map(r => [r.id, r]))

  const filteredRechnungen = selectedPersonId
    ? rechnungen.filter(r => r.person_id === selectedPersonId)
    : rechnungen

  return (
    <div className="space-y-4 pb-8" style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>Aktivitätslog</h1>

      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedPersonId}
          onChange={e => { setSelectedPersonId(e.target.value); setSelectedRechnungId('') }}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6 }}
        >
          <option value="">Alle Personen</option>
          {personen.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={selectedRechnungId}
          onChange={e => setSelectedRechnungId(e.target.value)}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6 }}
        >
          <option value="">Alle Rechnungen anzeigen</option>
          {filteredRechnungen.map(r => (
            <option key={r.id} value={r.id}>
              {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '?'} · {r.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} · {personMap[r.person_id]?.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
        <AktivitaetsLog
          aktivitaeten={aktivitaeten}
          loading={isLoading}
          rechnungenMap={!selectedRechnungId ? rechnungenMap : undefined}
        />
      </div>
    </div>
  )
}
