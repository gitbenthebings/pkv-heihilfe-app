import type { CSSProperties } from 'react'

interface Props {
  label: string
  status: 'offen' | 'bezahlt' | 'eingereicht' | 'beschieden' | null
  context?: 'zahlung' | 'beihilfe' | 'pkv'
}


type BadgeColor = 'green' | 'amber' | 'blue' | 'rose' | 'teal' | 'muted'

const BADGE_STYLES: Record<BadgeColor, CSSProperties> = {
  green:  { background: 'var(--green-dim)',  color: 'var(--green)',  border: '1px solid rgba(26,158,88,0.25)' },
  amber:  { background: 'var(--amber-dim)',  color: 'var(--amber)',  border: '1px solid rgba(200,120,32,0.25)' },
  blue:   { background: 'var(--blue-dim)',   color: 'var(--blue)',   border: '1px solid rgba(43,92,232,0.25)' },
  rose:   { background: 'var(--rose-dim)',   color: 'var(--rose)',   border: '1px solid rgba(216,64,96,0.25)' },
  teal:   { background: 'var(--teal-dim)',   color: 'var(--teal)',   border: '1px solid rgba(24,158,138,0.25)' },
  muted:  { background: 'rgba(127,127,127,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
}

function pickColor(status: string, context?: string): BadgeColor {
  if (status === 'bezahlt') return 'green'
  if (context === 'zahlung') return 'amber'
  if (context === 'beihilfe' && status === 'offen') return 'rose'
  if (context === 'beihilfe' && status === 'eingereicht') return 'blue'
  if (context === 'beihilfe' && status === 'beschieden') return 'green'
  if (context === 'pkv' && status === 'eingereicht') return 'teal'
  if (context === 'pkv' && status === 'beschieden') return 'green'
  return 'muted'
}

export default function StatusBadge({ label, status, context }: Props) {
  if (status === null) return null

  const color = pickColor(status, context)
  const style: CSSProperties = {
    ...BADGE_STYLES[color],
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 20,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  }

  return <span style={style}>{label}: {status}</span>
}
