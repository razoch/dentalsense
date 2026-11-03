import { CircleCheckBig, PencilLine, RotateCw, Stethoscope, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CLINIC_TIME_ZONE, type Appointment } from '@/lib/appointments'
import { cn } from '@/lib/utils'
import { StatusBadge, statusConfig } from './status-badge'
import { WhatsAppIcon } from './whatsapp-icon'

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})



export function AppointmentRow({
  appointment,
  onResend,
  onReschedule,
  onComplete,
  onCancel,
}: {
  appointment: Appointment
  onResend: (id: string) => void
  onReschedule: (appointment: Appointment) => void
  onComplete: (appointment: Appointment) => void
  onCancel: (appointment: Appointment) => void
}) {
  const { patientName, phone, treatment, start, status, lastMessageAt } = appointment
  const isSending = status === 'sending'
  const isCompleted = status === 'completed'
  const isClosed = isCompleted || status === 'cancelled'
  const canResend = status === 'sent' || status === 'pending'

  return (
    <li
      className={cn(
        'relative flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:gap-6',
        status === 'cancelled' && 'bg-danger-soft/40',
        isCompleted && 'opacity-70',
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
          {isCompleted
            ? 'Paciente atendido'
            : lastMessageAt
              ? `Último mensaje: ${timeFormatter.format(new Date(lastMessageAt))} hrs`
              : 'Se enviará automáticamente'}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:w-56 sm:shrink-0">
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
        <Button
          variant={status === 'cancelled' ? 'default' : 'outline'}
          className="w-full"
          disabled={isSending}
          onClick={() => onReschedule(appointment)}
          aria-label={`Editar cita de ${patientName}`}
        >
          <PencilLine className="size-4" aria-hidden="true" />
          Editar
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-success/40 text-success hover:bg-success-soft hover:text-success"
            disabled={isSending || isClosed}
            onClick={() => onComplete(appointment)}
            aria-label={`Finalizar cita de ${patientName}`}
          >
            <CircleCheckBig className="size-4" aria-hidden="true" />
            Finalizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
            disabled={isSending || isClosed}
            onClick={() => onCancel(appointment)}
            aria-label={`Cancelar cita de ${patientName}`}
          >
            <XCircle className="size-4" aria-hidden="true" />
            Cancelar
          </Button>
        </div>
      </div>
    </li>
  )
}
