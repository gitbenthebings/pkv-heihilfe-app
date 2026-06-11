import { useQuery } from '@tanstack/react-query'
import { getCorrespondents } from '../api/correspondents'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import type { BelegTyp } from '../types'

interface Props {
  typ: BelegTyp | '' | null
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
}

export const isLeistungserbringerTyp = (t: BelegTyp | '' | null) =>
  t === 'rechnung' || t === 'rezept' || t === 'ueberweisung'

export const isBescheidTyp = (t: BelegTyp | '' | null) =>
  t === 'erstbescheid' || t === 'widerspruchsbescheid'

export default function AusstellerSelect({ typ, value, onChange, style }: Props) {
  const { data: correspondents = [] } = useQuery({
    queryKey: ['correspondents'],
    queryFn: getCorrespondents,
    enabled: isLeistungserbringerTyp(typ),
  })

  const { data: beihilfestellen = [] } = useQuery({
    queryKey: ['beihilfestellen'],
    queryFn: getBeihilfestellen,
    enabled: isBescheidTyp(typ),
  })

  const { data: pkv = [] } = useQuery({
    queryKey: ['pkv'],
    queryFn: getPkv,
    enabled: isBescheidTyp(typ),
  })

  if (isLeistungserbringerTyp(typ)) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={style}>
        <option value="">– Leistungserbringer wählen –</option>
        {correspondents.map(c => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
    )
  }

  if (isBescheidTyp(typ)) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={style}>
        <option value="">– Aussteller wählen –</option>
        {beihilfestellen.length > 0 && (
          <optgroup label="Beihilfestellen">
            {beihilfestellen.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </optgroup>
        )}
        {pkv.length > 0 && (
          <optgroup label="PKV">
            {pkv.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    )
  }

  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder="Aussteller" style={style} />
  )
}
