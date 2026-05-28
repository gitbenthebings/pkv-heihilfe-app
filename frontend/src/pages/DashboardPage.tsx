import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard'
import { useJahr } from '../context/JahrContext'
import RechnungDetailSlider from '../components/RechnungDetailSlider'
import type { PipelineData, BescheidSummary, OffenerAntragSummary, BreIndikator } from '../types'

// ── Formatter ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtS(n: number) {
  return Math.round(n || 0).toLocaleString('de-DE') + ' €'
}
function gruss() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}
function fmtDatum(s: string) {
  const parts = s.slice(0, 10).split('-')
  return `${parts[2]}.${parts[1]}.`
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ children, padding = '16px 18px', style = {} }: {
  children: React.ReactNode
  padding?: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ children, action, onAction }: {
  children: React.ReactNode
  action?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        {children}
      </div>
      {action && (
        <span
          onClick={onAction}
          style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {action} →
        </span>
      )}
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ name, jahr, pipeline_bh, pipeline_pkv }: {
  name: string
  jahr: number
  pipeline_bh: PipelineData
  pipeline_pkv: PipelineData
}) {
  const erwartetBH = pipeline_bh.einreichbar.voraussichtlich + pipeline_bh.eingereicht.voraussichtlich
  const erwartetPKV = pipeline_pkv.einreichbar.voraussichtlich + pipeline_pkv.eingereicht.voraussichtlich
  const erstattetGesamt = pipeline_bh.erstattet.tatsaechlich + pipeline_pkv.erstattet.tatsaechlich

  return (
    <div style={{
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 18,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{
          fontSize: 12, color: 'var(--text-subtle)', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3,
        }}>
          Dashboard · {jahr}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
          {gruss()}, {name}.
        </h1>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, display: 'flex', overflow: 'hidden',
      }}>
        <div style={{ padding: '11px 18px', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em', marginBottom: 3 }}>
            VORAUSSICHTL. BEIHILFE
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(erwartetBH)}
          </div>
        </div>
        <div style={{ padding: '11px 18px', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em', marginBottom: 3 }}>
            VORAUSSICHTL. PKV
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(erwartetPKV)}
          </div>
        </div>
        <div style={{ padding: '11px 18px', background: 'var(--surface-alt)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em', marginBottom: 3 }}>
            ERSTATTET {jahr} <span style={{ color: 'var(--green)', marginLeft: 3 }}>↑</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(erstattetGesamt)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline Stage ────────────────────────────────────────────────────────────

const STAGE_TONES: Record<string, string> = {
  einreichbar: 'amber',
  eingereicht: 'blue',
  erstattet: 'green',
  abgelehnt: 'rose',
}

function PipelineStage({ label, value, sub, anzahl, isLast }: {
  label: string
  value: number
  sub: string
  anzahl: number
  isLast: boolean
}) {
  const tone = STAGE_TONES[label.toLowerCase()] ?? 'blue'
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {label}
          </span>
          <span style={{
            background: `var(--${tone}-dim)`, color: `var(--${tone})`,
            fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>{anzahl}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: `var(--${tone})`, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
          {fmtS(value)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
          {sub}
        </div>
      </div>
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 3px' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" style={{ color: 'var(--border-hi)' }}>
            <path d="M5 3 L10 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({ title, data, accentColor, accentDim, satzInfo, jahr }: {
  title: string
  data: PipelineData
  accentColor: string
  accentDim: string
  satzInfo: string
  jahr: number
}) {
  const stages = [
    {
      label: 'Einreichbar',
      value: data.einreichbar.voraussichtlich,
      sub: `v. ${fmtS(data.einreichbar.brutto)} brutto`,
      anzahl: data.einreichbar.anzahl,
    },
    {
      label: 'Eingereicht',
      value: data.eingereicht.voraussichtlich,
      sub: `v. ${fmtS(data.eingereicht.brutto)} brutto`,
      anzahl: data.eingereicht.anzahl,
    },
    {
      label: 'Erstattet',
      value: data.erstattet.tatsaechlich,
      sub: 'tatsächlich',
      anzahl: data.erstattet.anzahl,
    },
    {
      label: 'Abgelehnt',
      value: data.abgelehnt.tatsaechlich,
      sub: 'tatsächlich',
      anzahl: data.abgelehnt.anzahl,
    },
  ]

  const offenBetrag = data.einreichbar.voraussichtlich + data.eingereicht.voraussichtlich

  return (
    <Card padding="0">
      <div style={{
        padding: '10px 16px 9px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
            {title} · {jahr}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {satzInfo}
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: accentDim, color: accentColor,
          borderRadius: 14, padding: '3px 11px', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>OFFEN</span>
          <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmtS(offenBetrag)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', padding: '2px 4px' }}>
        {stages.map((s, i) => (
          <PipelineStage key={s.label} {...s} isLast={i === stages.length - 1} />
        ))}
      </div>
    </Card>
  )
}

// ── Bescheide Bar Chart ───────────────────────────────────────────────────────

function BescheideChart({ bescheide, onAlle }: {
  bescheide: BescheidSummary[]
  onAlle: () => void
}) {
  const maxBetrag = Math.max(...bescheide.map(b => b.erstattet + b.abgelehnt), 1)

  return (
    <Card>
      <SectionLabel action="Alle" onAction={onAlle}>Letzte Bescheide</SectionLabel>
      {bescheide.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Keine Bescheide vorhanden.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bescheide.map((b) => {
              const eingereicht = b.erstattet + b.abgelehnt
              const widthPct = eingereicht > 0 ? (eingereicht / maxBetrag) * 100 : 0
              const erstattetPct = eingereicht > 0 ? (b.erstattet / eingereicht) * 100 : 0
              const kurz = `${b.antrag_typ === 'pkv' ? 'P' : 'B'}-${String(b.referenz_nr).padStart(3, '0')}`
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 84px',
                    alignItems: 'center',
                    gap: 10,
                    opacity: b.overridden ? 0.4 : 1,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDatum(b.bescheid_datum)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: b.antrag_typ === 'pkv' ? 'var(--teal)' : 'var(--blue)' }}>
                      {b.stelle ?? kurz}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 16 }}>
                    <div style={{
                      display: 'flex', height: '100%', borderRadius: 3, overflow: 'hidden',
                      width: `${widthPct}%`, background: 'var(--surface-alt)',
                    }}>
                      <div style={{ width: `${erstattetPct}%`, background: 'var(--green)', transition: 'width .4s ease' }} />
                      <div style={{ width: `${100 - erstattetPct}%`, background: 'var(--rose)', opacity: 0.85, transition: 'width .4s ease' }} />
                    </div>
                    {b.ws && (
                      <span style={{
                        position: 'absolute', left: `calc(${widthPct}% + 4px)`, top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
                        background: 'var(--amber-dim)', color: 'var(--amber)',
                        border: '1px solid rgba(232,160,48,.25)',
                        letterSpacing: '.04em', whiteSpace: 'nowrap',
                      }}>WSP</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{fmtS(b.erstattet)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>v. {fmtS(eingereicht)}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 10, paddingTop: 9,
            borderTop: '1px solid var(--row-border)',
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> erstattet
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--rose)', display: 'inline-block' }} /> abgelehnt
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)' }}>{bescheide.length} Bescheide</span>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Offene Anträge ────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  entwurf:        'text-subtle',
  versendet:      'blue',
  in_bearbeitung: 'amber',
  beschieden:     'green',
}

const STATUS_LABEL: Record<string, string> = {
  entwurf:        'Entwurf',
  versendet:      'Versendet',
  in_bearbeitung: 'In Bearb.',
  beschieden:     'Beschieden',
}

function OffeneAntraegeSection({ antraege, onAlle, onAntrag }: {
  antraege: OffenerAntragSummary[]
  onAlle: () => void
  onAntrag: (id: string) => void
}) {
  return (
    <Card>
      <SectionLabel action="Alle" onAction={onAlle}>Offene Anträge</SectionLabel>
      {antraege.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Keine offenen Anträge.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {antraege.map((a) => {
            const tone = STATUS_TONE[a.status] ?? 'text-muted'
            const typTone = a.typ === 'beihilfe' ? 'blue' : 'teal'
            return (
              <div
                key={a.id}
                onClick={() => onAntrag(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 6,
                  background: 'var(--surface-alt)', cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 4, height: 32, borderRadius: 2,
                  background: `var(--${tone})`, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>{a.nr}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                      background: `var(--${typTone}-dim)`, color: `var(--${typTone})`,
                    }}>
                      {a.typ === 'beihilfe' ? 'BH' : 'PKV'}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13, color: a.titel ? 'var(--text)' : 'var(--text-subtle)',
                    fontWeight: 500, fontStyle: a.titel ? 'normal' : 'italic',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {a.titel ?? 'Kein Titel'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 10, color: `var(--${tone})`, fontWeight: 700,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtS(a.betrag)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── BRE / Beitragsrückerstattung ──────────────────────────────────────────────

function BeitragsRueckSection({ bre }: { bre: BreIndikator[] }) {
  if (bre.length === 0) return (
    <Card>
      <SectionLabel>PKV-Beitragsrückerstattung</SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-subtle)', fontStyle: 'italic' }}>
        Keine BRE-Schwellen konfiguriert.
      </p>
    </Card>
  )

  return (
    <Card>
      <SectionLabel>PKV-Beitragsrückerstattung</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bre.map((p) => {
          const hasSchwelle = p.bre_schwelle > 0
          const eingereichtPct = hasSchwelle ? Math.min((p.pkv_eingereicht / p.bre_schwelle) * 100, 100) : 0
          const offenPct = hasSchwelle
            ? Math.min((p.pkv_offen / p.bre_schwelle) * 100, 100 - eingereichtPct)
            : 0
          return (
            <div key={p.person_id} style={{ padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.person_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                  {hasSchwelle
                    ? `Schw. ${fmtS(p.bre_schwelle)}`
                    : 'keine Schw.'}
                </div>
              </div>
              {hasSchwelle ? (
                <div style={{ position: 'relative', background: 'var(--surface-alt)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${eingereichtPct}%`, background: 'var(--blue)',
                  }} />
                  <div style={{
                    position: 'absolute', left: `${eingereichtPct}%`, top: 0, bottom: 0,
                    width: `${offenPct}%`, background: 'var(--amber)', opacity: 0.7,
                  }} />
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                  Schwelle bereits ausgeschöpft.
                </div>
              )}
              {hasSchwelle && (
                <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11, color: 'var(--text-subtle)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--blue)', display: 'inline-block' }} />
                    {fmtS(p.pkv_eingereicht)} eingereicht
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--amber)', display: 'inline-block' }} />
                    {fmtS(p.pkv_offen)} offen
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function Skeleton({ h = 120 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'var(--surface)', border: '1px solid var(--border)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { jahr } = useJahr()

  const sliderRechnungId = searchParams.get('rechnung')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  })

  function closeSlider() {
    setSearchParams(p => { p.delete('rechnung'); return p })
  }
  function goToAntraege(antragId?: string) {
    if (antragId) {
      navigate(`/beihilfe-antraege?selected=${antragId}`)
    } else {
      navigate('/beihilfe-antraege')
    }
  }

  const displayJahr = data?.aktuelles_jahr ?? jahr

  if (isLoading || !data) {
    return (
      <div>
        <div style={{ marginBottom: 14, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between' }}>
          <Skeleton h={60} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Skeleton h={140} />
          <Skeleton h={140} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
          <Skeleton h={240} />
          <Skeleton h={240} />
          <Skeleton h={240} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div>

        {/* Hero */}
        <HeroSection
          name={data.benutzer_name}
          jahr={displayJahr}
          pipeline_bh={data.beihilfe_pipeline}
          pipeline_pkv={data.pkv_pipeline}
        />

        {/* Pipeline-Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <PipelineCard
            title="Beihilfe-Pipeline"
            data={data.beihilfe_pipeline}
            accentColor="var(--blue)"
            accentDim="var(--blue-dim)"
            satzInfo="gem. Beihilfesatz"
            jahr={displayJahr}
          />
          <PipelineCard
            title="PKV-Pipeline"
            data={data.pkv_pipeline}
            accentColor="var(--teal)"
            accentDim="var(--teal-dim)"
            satzInfo="gem. PKV-Tarifsatz"
            jahr={displayJahr}
          />
        </div>

        {/* Untere Dreispalten-Zeile */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
          <BescheideChart
            bescheide={data.letzte_bescheide}
            onAlle={() => goToAntraege()}
          />
          <OffeneAntraegeSection
            antraege={data.offene_antraege}
            onAlle={() => goToAntraege()}
            onAntrag={(id) => goToAntraege(id)}
          />
          <BeitragsRueckSection bre={data.bre} />
        </div>

      </div>

      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={closeSlider}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['rechnungen'] })}
        onKopieren={(r) => navigate('/rechnungen', { state: { kopieVon: r } })}
      />
    </>
  )
}
