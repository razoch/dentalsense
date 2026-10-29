import { CalendarX2, CheckCircle2, Clock, Send } from 'lucide-react'
import type { ReminderStatus } from '@/lib/appointments'
import { cn } from '@/lib/utils'

export type StatusFilter = 'all' | 'pending' | 'sent' | 'confirmed' | 'cancelled'

const items: {
  key: Exclude<StatusFilter, 'all'>
  label: string
  icon: typeof Clock
  iconClassName: string
  activeClassName: string
}[] = [
  { key: 'confirmed', label: 'Confirmados', icon: CheckCircle2, iconClassName: 'bg-success-soft text-success', activeClassName: 'ring-success' },
  { key: 'sent', label: 'Sin respuesta', icon: Send, iconClassName: 'bg-info-soft text-info', activeClassName: 'ring-info' },
  { key: 'pending', label: 'Por enviar', icon: Clock, iconClassName: 'bg-warning-soft text-warning', activeClassName: 'ring-warning' },
  { key: 'cancelled', label: 'Cancelados', icon: CalendarX2, iconClassName: 'bg-danger-soft text-danger', activeClassName: 'ring-danger' },
]

export function matchesFilter(status: ReminderStatus, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'sent') return status === 'sent' || status === 'sending'
  return status === filter
}

export function StatusSummary({
  counts,
  filter,
  onFilterChange,
}: {
  counts: Record<Exclude<StatusFilter, 'all'>, number>
  filter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
}) {
  return (
    <section aria-label="Resumen de recordatorios" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ key, label, icon: Icon, iconClassName, activeClassName }) => {
        const active = filter === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(active ? 'all' : key)}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active && cn('ring-2', activeClassName),
            )}
          >
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-2xl font-semibold leading-none tabular-nums">{counts[key]}</span>
              <span className="mt-1 text-sm text-muted-foreground">{label}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
