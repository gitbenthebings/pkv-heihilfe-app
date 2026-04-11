import type { Person } from '../types'

interface Props {
  personen: Person[]
  selectedId: string | undefined
  onChange: (id: string | undefined) => void
}

export default function PersonFilter({ personen, selectedId, onChange }: Props) {
  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Alle Personen</option>
      {personen.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
