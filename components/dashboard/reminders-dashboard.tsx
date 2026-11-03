'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertCircle, CalendarDays, CalendarCheck, CalendarPlus } from 'lucide-react'
import { closeAppointment, createAppointment, rescheduleAppointment, resendReminder } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { CLINIC_TIME_ZONE, dayKeyToDate, type Appointment, type Treatment } from '@/lib/appointments'
import { cn } from '@/lib/utils'
import { AppointmentDialog, type AppointmentFormValues, type DialogState } from './appointment-dialog'
import { AppointmentRow } from './appointment-row'
import { ConfirmActionDialog, type ConfirmActionState } from './confirm-action-dialog'
import { StatusSummary, matchesFilter, type StatusFilter } from './status-summary'

const timeZone = CLINIC_TIME_ZONE
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const weekdayFormatter = new Intl.DateTimeFormat('es-MX', { timeZone, weekday: 'short' })
const dayNumberFormatter = new Intl.DateTimeFormat('es-MX', { timeZone, day: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat('es-MX', { timeZone, weekday: 'long', day: 'numeric', month: 'long' })

export function RemindersDashboard({
  appointments,
  treatments,
  dayKeys,
}: {
  appointments: Appointment[]
  treatments: Treatment[]
  dayKeys: string[]
}) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const days = useMemo(() => dayKeys.map((key) => ({ key, date: dayKeyToDate(key) })), [dayKeys])
  const [selectedDay, setSelectedDay] = useState(dayKeys[0] ?? '')
  const [rowError, setRowError] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [, startResend] = useTransition()

  const counts = useMemo(
    () => ({
      confirmed: appointments.filter((a) => a.status === 'confirmed').length,
      sent: appointments.filter((a) => a.status === 'sent' || a.status === 'sending').length,
      pending: appointments.filter((a) => a.status === 'pending').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    }),
    [appointments],
  )

  const dayAppointments = appointments
    .filter((a) => dayKeyFormatter.format(new Date(a.start)) === selectedDay && matchesFilter(a.status, filter))
    .sort((a, b) => a.start.localeCompare(b.start))

  const selectedDate = days.find((d) => d.key === selectedDay)?.date

  const [dialog, setDialog] = useState<DialogState>(null)

  async function handleDialogSubmit(values: AppointmentFormValues) {
    const result =
      dialog?.mode === 'reschedule'
        ? await rescheduleAppointment({ id: dialog.appointment.id, treatmentId: values.treatmentId, start: values.start })
        : await createAppointment(values)
    if (!result.ok) return result.error
    setSelectedDay(dayKeyFormatter.format(new Date(values.start)))
    setFilter('all')
    setDialog(null)
    return null
  }

  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isClosing, startClosing] = useTransition()

  function handleConfirmAction() {
    if (!confirmAction) return
    const { id } = confirmAction.appointment
    const status = confirmAction.action === 'complete' ? 'completed' : 'cancelled'
    startClosing(async () => {
      const result = await closeAppointment(id, status)
      if (!result.ok) {
        setConfirmError(result.error)
        return
      }
      setConfirmAction(null)
    })
  }

  function handleResend(id: string) {
    setRowError(null)
    setResendingId(id)
    startResend(async () => {
      const result = await resendReminder(id)
      if (!result.ok) setRowError(result.error)
      setResendingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <StatusSummary counts={counts} filter={filter} onFilterChange={setFilter} />

      <section aria-labelledby="agenda-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="agenda-title" className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="size-5 text-primary" aria-hidden="true" />
              Citas de los próximos 5 días
            </h2>
            {selectedDate && (
              <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">
                {longDateFormatter.format(selectedDate)}
                {filter !== 'all' && <span className="normal-case"> · filtro activo</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-sm font-medium text-primary hover:underline"
              >
                Ver todas las citas
              </button>
            )}
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              Nueva cita
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Seleccionar día" className="grid grid-cols-5 gap-2">
          {days.map(({ key, date }) => {
            const active = key === selectedDay
            const total = appointments.filter((a) => dayKeyFormatter.format(new Date(a.start)) === key).length
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelectedDay(key)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-foreground hover:border-primary/40',
                )}
              >
                <span className={cn('text-xs font-medium uppercase', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {weekdayFormatter.format(date).replace('.', '')}
                </span>
                <span className="text-xl font-semibold tabular-nums">{dayNumberFormatter.format(date)}</span>
                <span className={cn('text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {total} {total === 1 ? 'cita' : 'citas'}
                </span>
              </button>
            )
          })}
        </div>

        {rowError && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {rowError}
          </p>
        )}

        {dayAppointments.length > 0 ? (
          <ul className="flex flex-col gap-3" role="tabpanel">
            {dayAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={resendingId === appointment.id ? { ...appointment, status: 'sending' } : appointment}
                onResend={handleResend}
                onReschedule={(a) => setDialog({ mode: 'reschedule', appointment: a })}
                onComplete={(a) => {
                  setConfirmError(null)
                  setConfirmAction({ action: 'complete', appointment: a })
                }}
                onCancel={(a) => {
                  setConfirmError(null)
                  setConfirmAction({ action: 'cancel', appointment: a })
                }}
              />
            ))}
          </ul>
        ) : (
          <div role="tabpanel" className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-12 text-center">
            <CalendarCheck className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">
              {appointments.length === 0 ? 'Aún no hay citas registradas' : 'No hay citas con este estado para este día'}
            </p>
            <p className="text-sm text-muted-foreground">
              {appointments.length === 0 ? 'Agenda la primera con el botón “Nueva cita”.' : 'Prueba con otro día o quita el filtro.'}
            </p>
          </div>
        )}
      </section>

      <AppointmentDialog
        state={dialog}
        days={days}
        treatments={treatments}
        appointments={appointments}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={handleDialogSubmit}
      />

      <ConfirmActionDialog
        state={confirmAction}
        isPending={isClosing}
        error={confirmError}
        onOpenChange={(open) => !open && !isClosing && setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  )
}
