import { useEffect } from 'react'
import BeihilfeAntragDetail from './BeihilfeAntragDetail'

interface Props {
  antragId: string | null
  onClose: () => void
}

export default function BeihilfeAntragSlider({ antragId, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!antragId) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--overlay)',
          animation: 'overlay-in 0.2s ease',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, bottom: 0, right: 0,
        width: '100%', maxWidth: 800,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.32)',
        zIndex: 102,
        animation: 'drawer-in 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <BeihilfeAntragDetail key={antragId} antragId={antragId} onClose={onClose} />
      </div>
    </>
  )
}
