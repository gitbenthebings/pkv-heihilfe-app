import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard'
import { addBelegToRechnung } from '../api/belege'
import RechnungDetailSlider from '../components/RechnungDetailSlider'
import BelegPicker from '../components/BelegPicker'
import type {
  DashboardData,
  DashboardRechnung,
  BhGruppe,
  PkvGruppe,
  LaufenderAntrag,
  BescheidSummary,
  BreIndikator,
} from '../types'
// BreIndikator still used in BreAmpel + sidebar

// ── Formatter ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtD(s: string) {
  const p = s.slice(0, 10).split('-')
  return `${p[2]}.${p[1]}.${p[0].slice(2)}`
}

// ── Sidebar-Pattern (identisch zu BelegePage) ─────────────────────────────────

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        marginBottom: 8, padding: '0 4px',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  )
}

function FilterRow({
  label, count, active, dot, onClick,
}: { label: string; count: number; active: boolean; dot?: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--row-active)' : hov ? 'var(--row-hover)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: 3, background: dot, flexShrink: 0 }} />}
      <span style={{
        flex: 1, fontSize: 13,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
      }}>{label}</span>
      {count > 0 && (
        <span style={{
          fontSize: 11, color: 'var(--text-subtle)',
          background: active ? 'var(--surface-hi)' : 'transparent',
          borderRadius: 10, padding: '1px 7px',
          minWidth: 22, textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>{count}</span>
      )}
    </div>
  )
}

// ── KPI-Chip ──────────────────────────────────────────────────────────────────

function KpiChip({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone: string
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 16px',
      borderLeft: `3px solid var(--${tone})`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: `var(--${tone})`, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Rechnung-Zeile mit Beleg-Badge ────────────────────────────────────────────

function RechnungZeile({ r, onOpen, onBeleg }: {
  r: DashboardRechnung
  onOpen: () => void
  onBeleg: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 7,
        background: hov ? 'var(--row-hover)' : 'transparent',
        transition: 'background 0.1s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
    >
      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.leistungserbringer_name ?? '–'}&ensp;
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 400 }}>{r.person_name}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 1 }}>
          {fmtD(r.datum)}
          {r.zahlungsziel && <>&ensp;·&ensp;fällig {fmtD(r.zahlungsziel)}</>}
        </div>
      </div>
      {/* Betrag */}
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(r.betrag)}</div>
        {r.voraussichtlich > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>~{fmt(r.voraussichtlich)} erw.</div>
        )}
      </div>
      {/* Beleg-Badge */}
      <button
        onClick={e => { e.stopPropagation(); onBeleg() }}
        title={r.beleg_count > 0 ? `${r.beleg_count} Beleg(e) verknüpft` : 'Beleg verknüpfen'}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6, border: '1px solid',
          cursor: 'pointer', fontSize: 11, fontWeight: 600,
          flexShrink: 0,
          background: r.beleg_count > 0 ? 'var(--green-dim)' : 'var(--amber-dim)',
          borderColor: r.beleg_count > 0 ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'color-mix(in srgb, var(--amber) 30%, transparent)',
          color: r.beleg_count > 0 ? 'var(--green)' : 'var(--amber)',
        }}
      >
        {r.beleg_count > 0 ? `📎 ${r.beleg_count}` : '+ Beleg'}
      </button>
    </div>
  )
}

// ── Aktions-Kachel ────────────────────────────────────────────────────────────

function AktionsKachel({ title, sub, tone, children, onAlle }: {
  title: string
  sub: string
  tone: string
  children: React.ReactNode
  onAlle?: () => void
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '11px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderLeft: `3px solid var(--${tone})`,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>{sub}</div>
        </div>
        {onAlle && (
          <button
            onClick={onAlle}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--primary)', fontWeight: 600, padding: '3px 8px',
            }}
          >
            Anträge →
          </button>
        )}
      </div>
      <div style={{ padding: '8px 4px' }}>
        {children}
      </div>
    </div>
  )
}

// ── BH-Einreichen-Gruppe ──────────────────────────────────────────────────────

function BhGruppeBlock({ gruppe, onOpen, onBeleg }: {
  gruppe: BhGruppe
  onOpen: (id: string) => void
  onBeleg: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px 4px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.04em' }}>
          {gruppe.beihilfestelle_name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
          ~{fmt(gruppe.voraussichtlich_gesamt)} erw.
        </span>
      </div>
      {gruppe.rechnungen.map(r => (
        <RechnungZeile
          key={r.id}
          r={r}
          onOpen={() => onOpen(r.id)}
          onBeleg={() => onBeleg(r.id)}
        />
      ))}
    </div>
  )
}

// ── PKV-Gruppe ────────────────────────────────────────────────────────────────

function PkvGruppeBlock({ gruppe, onOpen, onBeleg, isLast }: {
  gruppe: PkvGruppe
  onOpen: (id: string) => void
  onBeleg: (id: string) => void
  isLast: boolean
}) {
  return (
    <div style={{
      marginBottom: isLast ? 0 : 4,
      paddingBottom: isLast ? 0 : 12,
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 4px',
        background: 'var(--surface-alt)',
        margin: '0 4px',
        borderRadius: 6,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>
          {gruppe.pkv_name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
          {gruppe.anzahl} Rechnung{gruppe.anzahl !== 1 ? 'en' : ''} · ~{fmt(gruppe.voraussichtlich_gesamt)} erw.
        </span>
      </div>
      {gruppe.rechnungen.map(r => (
        <RechnungZeile
          key={r.id}
          r={r}
          onOpen={() => onOpen(r.id)}
          onBeleg={() => onBeleg(r.id)}
        />
      ))}
    </div>
  )
}

// ── Laufende Anträge ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  versendet: 'Versendet',
  in_bearbeitung: 'In Bearbeitung',
}

function LaufendeAntraege({ antraege, onAntrag }: {
  antraege: LaufenderAntrag[]
  onAntrag: (id: string) => void
}) {
  if (antraege.length === 0) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Laufende Anträge</div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>Warten auf Bescheid · hier eintragen wenn Post eingegangen</div>
      </div>
      <div style={{ padding: '6px 4px' }}>
        {antraege.map(a => {
          const typTone = a.typ === 'pkv' ? 'teal' : 'blue'
          const warnt = (a.tage_offen ?? 0) > 30
          return (
            <div
              key={a.id}
              onClick={() => onAntrag(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', cursor: 'pointer', borderRadius: 7,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 4, minHeight: 32, borderRadius: 2,
                background: `var(--${typTone})`, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                    background: `var(--${typTone}-dim)`, color: `var(--${typTone})`,
                  }}>
                    {a.typ === 'pkv' ? 'PKV' : 'BH'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {a.nr}
                  </span>
                  {a.stelle && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.stelle}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
                  {a.anzahl_rechnungen} Rechnung{a.anzahl_rechnungen !== 1 ? 'en' : ''} · {fmt(a.betrag)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: warnt ? 'var(--amber)' : 'var(--text-subtle)', letterSpacing: '0.03em' }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </div>
                {a.tage_offen !== null && (
                  <div style={{ fontSize: 10, color: warnt ? 'var(--amber)' : 'var(--text-subtle)' }}>
                    {a.tage_offen} Tage{warnt ? ' ⚠' : ''}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Letzte Bescheide ──────────────────────────────────────────────────────────

function LetzteDescheide({ bescheide, onAlle }: {
  bescheide: BescheidSummary[]
  onAlle: () => void
}) {
  if (bescheide.length === 0) return null
  const max = Math.max(...bescheide.map(b => b.erstattet + b.abgelehnt), 1)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Letzte Bescheide</div>
        <button onClick={onAlle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
          Alle →
        </button>
      </div>
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bescheide.map(b => {
          const gesamt = b.erstattet + b.abgelehnt
          const wPct = gesamt > 0 ? (gesamt / max) * 100 : 0
          const ePct = gesamt > 0 ? (b.erstattet / gesamt) * 100 : 0
          const typTone = b.antrag_typ === 'pkv' ? 'teal' : 'blue'
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 72px', alignItems: 'center', gap: 10, opacity: b.overridden ? 0.4 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtD(b.bescheid_datum)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: `var(--${typTone})`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.stelle ?? (b.antrag_typ === 'pkv' ? 'PKV' : 'Beihilfe')}
                  </span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 14 }}>
                <div style={{ display: 'flex', height: '100%', borderRadius: 3, overflow: 'hidden', width: `${wPct}%`, minWidth: 4 }}>
                  <div style={{ width: `${ePct}%`, background: 'var(--green)' }} />
                  <div style={{ width: `${100 - ePct}%`, background: 'var(--rose)', opacity: 0.8 }} />
                </div>
                {b.ws && (
                  <span style={{
                    position: 'absolute', left: `calc(${wPct}% + 4px)`, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4,
                    background: 'var(--amber-dim)', color: 'var(--amber)',
                  }}>WSP</span>
                )}
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{fmt(b.erstattet)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>v. {fmt(gesamt)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── BRE-Ampel ─────────────────────────────────────────────────────────────────

function BreAmpel({ bre }: { bre: BreIndikator[] }) {
  const mitSchwelle = bre.filter(b => b.bre_schwelle > 0)
  if (mitSchwelle.length === 0) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>PKV-Beitragsrückerstattung</div>
      </div>
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mitSchwelle.map(p => {
          const eingePct = Math.min((p.pkv_eingereicht / p.bre_schwelle) * 100, 100)
          const offenPct = Math.min((p.pkv_offen / p.bre_schwelle) * 100, 100 - eingePct)
          const warnt = p.bre_spielraum < 0
          return (
            <div key={p.person_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.person_name}</span>
                <span style={{ fontSize: 11, color: warnt ? 'var(--rose)' : 'var(--text-subtle)' }}>
                  Schw. {fmt(p.bre_schwelle)}{warnt ? ' ⚠ überschritten' : ''}
                </span>
              </div>
              <div style={{ position: 'relative', background: 'var(--surface-alt)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${eingePct}%`, background: 'var(--blue)' }} />
                <div style={{ position: 'absolute', left: `${eingePct}%`, top: 0, bottom: 0, width: `${offenPct}%`, background: 'var(--amber)', opacity: 0.7 }} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--text-subtle)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--blue)', display: 'inline-block' }} />
                  {fmt(p.pkv_eingereicht)} eingereicht
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--amber)', display: 'inline-block' }} />
                  {fmt(p.pkv_offen)} offen
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ h = 100 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'var(--surface)', border: '1px solid var(--border)',
    }} />
  )
}

// ── Institutionsfilter-Typ ────────────────────────────────────────────────────

type InstFilter = 'alle' | `bh:${string}` | `pkv:${string}`

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [instFilter, setInstFilter] = useState<InstFilter>('alle')
  const [sliderRechnungId, setSliderRechnungId] = useState<string | null>(null)
  const [belegPickerRechnungId, setBelegPickerRechnungId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  })

  function closeSlider() { setSliderRechnungId(null) }
  function goToAntraege(id?: string) {
    navigate(id ? `/beihilfe-antraege?selected=${id}` : '/beihilfe-antraege')
  }

  async function handleBelegSelect(beleg: { id: string }) {
    if (!belegPickerRechnungId) return
    await addBelegToRechnung(belegPickerRechnungId, beleg.id)
    setBelegPickerRechnungId(null)
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // ── Sidebar-Zählungen ──────────────────────────────────────────────────────
  const totalBezahlen = data?.bezahlen.length ?? 0
  const totalBh = data?.bh_gruppen.reduce((s, g) => s + g.anzahl, 0) ?? 0
  const totalPkv = data?.pkv_gruppen.reduce((s, g) => s + g.anzahl, 0) ?? 0
  const totalAlle = totalBezahlen + totalBh + totalPkv

  // ── Institutionsfilter anwenden ────────────────────────────────────────────
  const visibleBh = data?.bh_gruppen.filter(g =>
    instFilter === 'alle' || instFilter === `bh:${g.beihilfestelle_id}`
  ) ?? []
  const visiblePkv = data?.pkv_gruppen.filter(g =>
    instFilter === 'alle' || instFilter === `pkv:${g.pkv_id ?? ''}`
  ) ?? []
  const showBezahlen = instFilter === 'alle'

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div className="hidden sm:block" style={{ width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)' }} />
        <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skel h={56} />
          <div style={{ display: 'flex', gap: 12 }}><Skel h={80} /><Skel h={80} /><Skel h={80} /><Skel h={80} /></div>
          <Skel h={200} />
          <Skel h={160} />
        </div>
      </div>
    )
  }

  const { kpis, bezahlen, bh_gruppen, pkv_gruppen, laufende_antraege, letzte_bescheide, bre, aktuelles_jahr, benutzer_name } = data as DashboardData

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Mobile Institution-Filter (Tab-Leiste) */}
        <div className="flex sm:hidden" style={{
          overflowX: 'auto', flexShrink: 0,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <button
            onClick={() => setInstFilter('alle')}
            style={{
              minWidth: 'max-content', padding: '10px 14px',
              fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
              color: instFilter === 'alle' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${instFilter === 'alle' ? 'var(--primary)' : 'transparent'}`,
              fontWeight: instFilter === 'alle' ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >Alle</button>
          {bh_gruppen.map(g => (
            <button
              key={g.beihilfestelle_id}
              onClick={() => setInstFilter(`bh:${g.beihilfestelle_id}`)}
              style={{
                minWidth: 'max-content', padding: '10px 14px',
                fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
                color: instFilter === `bh:${g.beihilfestelle_id}` ? 'var(--blue)' : 'var(--text-muted)',
                borderBottom: `2px solid ${instFilter === `bh:${g.beihilfestelle_id}` ? 'var(--blue)' : 'transparent'}`,
                fontWeight: instFilter === `bh:${g.beihilfestelle_id}` ? 600 : 400, whiteSpace: 'nowrap',
              }}
            >{g.beihilfestelle_name}</button>
          ))}
          {pkv_gruppen.map(g => (
            <button
              key={g.pkv_id ?? 'pkv'}
              onClick={() => setInstFilter(`pkv:${g.pkv_id ?? ''}`)}
              style={{
                minWidth: 'max-content', padding: '10px 14px',
                fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
                color: instFilter === `pkv:${g.pkv_id ?? ''}` ? 'var(--teal)' : 'var(--text-muted)',
                borderBottom: `2px solid ${instFilter === `pkv:${g.pkv_id ?? ''}` ? 'var(--teal)' : 'transparent'}`,
                fontWeight: instFilter === `pkv:${g.pkv_id ?? ''}` ? 600 : 400, whiteSpace: 'nowrap',
              }}
            >{g.pkv_name}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div className="hidden sm:block" style={{
          width: 220, minWidth: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          overflowY: 'auto',
          padding: '18px 14px 16px',
        }}>
          <FilterGroup title="Institution">
            <FilterRow
              label="Alle"
              count={totalAlle}
              active={instFilter === 'alle'}
              dot="var(--primary)"
              onClick={() => setInstFilter('alle')}
            />
            {bh_gruppen.map(g => (
              <FilterRow
                key={g.beihilfestelle_id}
                label={g.beihilfestelle_name}
                count={g.anzahl}
                active={instFilter === `bh:${g.beihilfestelle_id}`}
                dot="var(--blue)"
                onClick={() => setInstFilter(`bh:${g.beihilfestelle_id}`)}
              />
            ))}
            {pkv_gruppen.map(g => (
              <FilterRow
                key={g.pkv_id ?? 'pkv'}
                label={g.pkv_name}
                count={g.anzahl}
                active={instFilter === `pkv:${g.pkv_id ?? ''}`}
                dot="var(--teal)"
                onClick={() => setInstFilter(`pkv:${g.pkv_id ?? ''}`)}
              />
            ))}
          </FilterGroup>

          {laufende_antraege.length > 0 && (
            <FilterGroup title="Laufend">
              <FilterRow
                label="Anträge"
                count={laufende_antraege.length}
                active={false}
                dot="var(--amber)"
                onClick={() => goToAntraege()}
              />
            </FilterGroup>
          )}

          {bre.filter(b => b.bre_schwelle > 0).length > 0 && (
            <FilterGroup title="PKV-BRE">
              {bre.filter(b => b.bre_schwelle > 0).map(b => {
                const warnt = b.bre_spielraum < 0
                return (
                  <div key={b.person_id} style={{ padding: '4px 10px 2px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{b.person_name}</div>
                    <div style={{ background: 'var(--surface-alt)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min((b.pkv_eingereicht / b.bre_schwelle) * 100, 100)}%`,
                        height: '100%',
                        background: warnt ? 'var(--rose)' : 'var(--blue)',
                      }} />
                    </div>
                  </div>
                )
              })}
            </FilterGroup>
          )}
        </div>

        {/* ── Hauptbereich ── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)' }}>

          {/* Toolbar */}
          <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>
              Dashboard · {aktuelles_jahr}
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
              {benutzer_name}
            </h1>
          </div>

          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPI-Chips */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiChip
                label="Eigenkosten offen"
                value={fmt(kpis.eigenkosten_offen)}
                sub="unbezahlte Rechnungen"
                tone="amber"
              />
              <KpiChip
                label="Ausstehende Erstattung"
                value={fmt(kpis.ausstehende_erstattung)}
                sub="aus laufenden Anträgen"
                tone="blue"
              />
              <KpiChip
                label={`${aktuelles_jahr} erstattet`}
                value={fmt(kpis.erstattet_ytd)}
                sub="BH + PKV zusammen"
                tone="green"
              />
              <KpiChip
                label="Einzureichen"
                value={String(kpis.einzureichen_anzahl)}
                sub="Rechnungen bereit"
                tone="text-muted"
              />
            </div>

            {/* Bezahlen */}
            {showBezahlen && bezahlen.length > 0 && (
              <AktionsKachel
                title="Rechnungen bezahlen"
                sub={`${bezahlen.length} offen · ${fmt(bezahlen.reduce((s, r) => s + r.betrag, 0))} gesamt`}
                tone="amber"
              >
                {bezahlen.map(r => (
                  <RechnungZeile
                    key={r.id}
                    r={r}
                    onOpen={() => setSliderRechnungId(r.id)}
                    onBeleg={() => setBelegPickerRechnungId(r.id)}
                  />
                ))}
              </AktionsKachel>
            )}

            {/* BH-Einreichen */}
            {visibleBh.length > 0 && (
              <AktionsKachel
                title="Bei Beihilfe einreichen"
                sub={`${visibleBh.reduce((s, g) => s + g.anzahl, 0)} Rechnungen · ${fmt(visibleBh.reduce((s, g) => s + g.voraussichtlich_gesamt, 0))} erwartet`}
                tone="blue"
                onAlle={() => goToAntraege()}
              >
                {visibleBh.map(g => (
                  <BhGruppeBlock
                    key={g.beihilfestelle_id}
                    gruppe={g}
                    onOpen={setSliderRechnungId}
                    onBeleg={setBelegPickerRechnungId}
                  />
                ))}
              </AktionsKachel>
            )}

            {/* PKV-Einreichen */}
            {visiblePkv.length > 0 && (
              <AktionsKachel
                title="Bei PKV einreichen"
                sub={`${visiblePkv.reduce((s, g) => s + g.anzahl, 0)} Rechnungen · ${fmt(visiblePkv.reduce((s, g) => s + g.voraussichtlich_gesamt, 0))} erwartet`}
                tone="teal"
                onAlle={() => goToAntraege()}
              >
                {visiblePkv.map((g, i) => (
                  <PkvGruppeBlock
                    key={g.pkv_id ?? 'pkv'}
                    gruppe={g}
                    onOpen={setSliderRechnungId}
                    onBeleg={setBelegPickerRechnungId}
                    isLast={i === visiblePkv.length - 1}
                  />
                ))}
              </AktionsKachel>
            )}

            {/* Keine Aktionen */}
            {!showBezahlen && visibleBh.length === 0 && visiblePkv.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subtle)', fontSize: 13 }}>
                Keine offenen Aktionen für diese Institution.
              </div>
            )}
            {showBezahlen && bezahlen.length === 0 && bh_gruppen.length === 0 && pkv_gruppen.length === 0 && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '32px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Alles erledigt</div>
                <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>Keine offenen Aktionen.</div>
              </div>
            )}

            {/* Statuszone */}
            <LaufendeAntraege
              antraege={laufende_antraege}
              onAntrag={goToAntraege}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
              <LetzteDescheide bescheide={letzte_bescheide} onAlle={() => goToAntraege()} />
              <BreAmpel bre={bre} />
            </div>

          </div>
        </div>
        </div>
      </div>

      {/* Slider & Picker */}
      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={closeSlider}
        onUpdate={() => {
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['rechnungen'] })
        }}
        onKopieren={r => navigate('/rechnungen', { state: { kopieVon: r } })}
      />

      {belegPickerRechnungId && (
        <BelegPicker
          excludeIds={[]}
          onSelect={handleBelegSelect}
          onCancel={() => setBelegPickerRechnungId(null)}
        />
      )}
    </>
  )
}
