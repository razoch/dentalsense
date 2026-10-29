'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, CalendarCheck, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CLINIC_TIME_ZONE, type Appointment } from '@/lib/appointments'
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

type Day = { key: string; date: Date }

export function RemindersDashboard({ initialAppointments }: { initialAppointments: Appointment[] }) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [filter, setFilter] = useState<StatusFilter>('all')

  const days = useMemo<Day[]>(() => {
    const map = new Map<string, Date>()
    for (const a of initialAppointments) {
      const date = new Date(a.start)
      const key = dayKeyFormatter.format(date)
      if (!map.has(key)) map.set(key, date)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 5).map(([key, date]) => ({ key, date }))
  }, [initialAppointments])

  const [selectedDay, setSelectedDay] = useState(days[0]?.key ?? '')

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

  function handleDialogSubmit(values: AppointmentFormValues) {
    if (dialog?.mode === 'reschedule') {
      const id = dialog.appointment.id
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, treatment: values.treatment, start: values.start, status: 'pending', lastMessageAt: undefined }
            : a,
        ),
      )
    } else {
      setAppointments((prev) => [
        ...prev,
        { id: `evt-${crypto.randomUUID()}`, ...values, status: 'pending' },
      ])
    }
    setSelectedDay(dayKeyFormatter.format(new Date(values.start)))
    setFilter('all')
    setDialog(null)
  }

  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null)

  function handleConfirmAction() {
    if (!confirmAction) return
    const { id } = confirmAction.appointment
    const status = confirmAction.action === 'complete' ? 'completed' : 'cancelled'
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    setConfirmAction(null)
  }

  function handleResend(id: string) {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'sending' } : a)))
    setTimeout(() => {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'sent', lastMessageAt: new Date().toISOString() } : a)),
      )
    }, 1800)
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

        {dayAppointments.length > 0 ? (
          <ul className="flex flex-col gap-3" role="tabpanel">
            {dayAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onResend={handleResend}
                onReschedule={(a) => setDialog({ mode: 'reschedule', appointment: a })}
                onComplete={(a) => setConfirmAction({ action: 'complete', appointment: a })}
                onCancel={(a) => setConfirmAction({ action: 'cancel', appointment: a })}
              />
            ))}
          </ul>
        ) : (
          <div role="tabpanel" className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-12 text-center">
            <CalendarCheck className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No hay citas con este estado para este día</p>
            <p className="text-sm text-muted-foreground">Prueba con otro día o quita el filtro.</p>
          </div>
        )}
      </section>

      <AppointmentDialog
        state={dialog}
        days={days}
        appointments={appointments}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={handleDialogSubmit}
      />

      <ConfirmActionDialog
        state={confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  )
}
