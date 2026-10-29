import { CalendarX2, CheckCircle2, CircleCheckBig, Clock, Loader2, Send } from 'lucide-react'
import type { ReminderStatus } from '@/lib/appointments'
import { cn } from '@/lib/utils'

export const statusConfig: Record<
  ReminderStatus,
  { label: string; icon: typeof Clock; className: string; dotClassName: string }
> = {
  pending: {
    label: 'Pendiente de envío',
    icon: Clock,
    className: 'bg-warning-soft text-warning ring-warning/25',
    dotClassName: 'bg-warning',
  },
  sending: {
    label: 'Enviando…',
    icon: Loader2,
    className: 'bg-info-soft text-info ring-info/25',
    dotClassName: 'bg-info',
  },
  sent: {
    label: 'Enviado',
    icon: Send,
    className: 'bg-info-soft text-info ring-info/25',
    dotClassName: 'bg-info',
  },
  confirmed: {
    label: 'Confirmado',
    icon: CheckCircle2,
    className: 'bg-success-soft text-success ring-success/30',
    dotClassName: 'bg-success',
  },
  cancelled: {
    label: 'Cancelado / Reagendar',
    icon: CalendarX2,
    className: 'bg-danger-soft text-danger ring-danger/25',
    dotClassName: 'bg-danger',
  },
  completed: {
    label: 'Finalizada',
    icon: CircleCheckBig,
    className: 'bg-muted text-muted-foreground ring-border',
    dotClassName: 'bg-muted-foreground/40',
  },
}

export function StatusBadge({ status }: { status: ReminderStatus }) {
  const { label, icon: Icon, className } = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        className,
      )}
    >
      <Icon className={cn('size-3.5', status === 'sending' && 'animate-spin')} aria-hidden="true" />
      {label}
    </span>
  )
}
