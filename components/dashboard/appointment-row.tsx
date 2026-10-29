import { RotateCw, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CLINIC_TIME_ZONE, type Appointment } from '@/lib/appointments'
import { cn } from '@/lib/utils'
import { StatusBadge, statusConfig } from './status-badge'

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.2-4.24 9.44-9.44 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.37-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  )
}

export function AppointmentRow({
  appointment,
  onResend,
}: {
  appointment: Appointment
  onResend: (id: string) => void
}) {
  const { patientName, phone, treatment, start, status, lastMessageAt } = appointment
  const isSending = status === 'sending'
  const canResend = status === 'sent' || status === 'pending'

  return (
    <li
      className={cn(
        'relative flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:gap-6',
        status === 'cancelled' && 'bg-danger-soft/40',
      )}
    >
      <span
        className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full', statusConfig[status].dotClassName)}
        aria-hidden="true"
      />

      <div className="flex items-center gap-4 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0">
        <time dateTime={start} className="text-xl font-semibold tabular-nums">
          {timeFormatter.format(new Date(start))}
        </time>
        <span className="text-xs text-muted-foreground">hrs</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-base font-semibold">{patientName}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Stethoscope className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{treatment}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WhatsAppIcon className="size-3.5 shrink-0 text-whatsapp" />
          {phone}
        </p>
      </div>

      <div className="flex flex-col gap-1 sm:w-52 sm:items-start">
        <StatusBadge status={status} />
        <span className="text-xs text-muted-foreground">
          {lastMessageAt
            ? `Último mensaje: ${timeFormatter.format(new Date(lastMessageAt))} hrs`
            : 'Se enviará automáticamente'}
        </span>
      </div>

      <div className="sm:w-48 sm:shrink-0">
        <Button
          variant={canResend ? 'default' : 'outline'}
          className="w-full"
          disabled={!canResend || isSending}
          onClick={() => onResend(appointment.id)}
          aria-label={`Reenviar recordatorio a ${patientName}`}
        >
          <RotateCw className={cn('size-4', isSending && 'animate-spin')} aria-hidden="true" />
          {isSending ? 'Enviando…' : 'Reenviar recordatorio'}
        </Button>
      </div>
    </li>
  )
}
