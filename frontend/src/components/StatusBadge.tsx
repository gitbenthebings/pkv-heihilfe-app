interface Props {
  label: string
  status: 'offen' | 'bezahlt' | 'eingereicht' | null
}

const colors: Record<string, string> = {
  offen: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  bezahlt: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  eingereicht: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

export default function StatusBadge({ label, status }: Props) {
  if (status === null) return null

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
      {label}: {status}
    </span>
  )
}
