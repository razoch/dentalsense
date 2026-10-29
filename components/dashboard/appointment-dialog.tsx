'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, CalendarClock, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CLINIC_TIME_ZONE,
  TREATMENTS,
  toClinicISO,
  toClinicParts,
  type Appointment,
} from '@/lib/appointments'
import { cn } from '@/lib/utils'

export type DialogState = { mode: 'create' } | { mode: 'reschedule'; appointment: Appointment } | null

export type AppointmentFormValues = {
  patientName: string
  phone: string
  treatment: string
  start: string
}

const dayLabelFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: CLINIC_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const fieldClassName =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function AppointmentDialog({
  state,
  days,
  appointments,
  onOpenChange,
  onSubmit,
}: {
  state: DialogState
  days: { key: string; date: Date }[]
  appointments: Appointment[]
  onOpenChange: (open: boolean) => void
  onSubmit: (values: AppointmentFormValues) => void
}) {
  const formKey = state?.mode === 'reschedule' ? state.appointment.id : state?.mode ?? 'closed'

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state && (
          <AppointmentForm
            key={formKey}
            state={state}
            days={days}
            appointments={appointments}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AppointmentForm({
  state,
  days,
  appointments,
  onSubmit,
}: {
  state: NonNullable<DialogState>
  days: { key: string; date: Date }[]
  appointments: Appointment[]
  onSubmit: (values: AppointmentFormValues) => void
}) {
  const isReschedule = state.mode === 'reschedule'
  const current = isReschedule ? state.appointment : null
  const initial = current ? toClinicParts(current.start) : { dayKey: days[0]?.key ?? '', time: '09:00' }
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patientName = current?.patientName ?? String(data.get('patientName')).trim()
    const phone = current?.phone ?? String(data.get('phone')).trim()
    const treatment = String(data.get('treatment')).trim()
    const dayKey = String(data.get('day'))
    const time = String(data.get('time'))

    if (!patientName || !phone || !treatment || !dayKey || !time) {
      setError('Completa todos los campos.')
      return
    }

    const start = toClinicISO(dayKey, time)
    if (current && start === current.start) {
      setError('Selecciona un horario distinto al actual.')
      return
    }

    const conflict = appointments.find(
      (a) => a.id !== current?.id && a.status !== 'cancelled' && a.start === start,
    )
    if (conflict) {
      setError(`Ese horario ya está ocupado por ${conflict.patientName}.`)
      return
    }

    onSubmit({ patientName, phone, treatment, start })
  }

  const Icon = isReschedule ? CalendarClock : CalendarPlus

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle>{isReschedule ? 'Reagendar cita' : 'Agendar nueva cita'}</DialogTitle>
            <DialogDescription>
              {isReschedule
                ? 'Se actualizará en Google Calendar y se enviará un nuevo recordatorio.'
                : 'La cita se creará en Google Calendar con recordatorio automático.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {current ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="font-semibold">{current.patientName}</p>
          <p className="text-xs text-muted-foreground">{current.phone}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Horario actual:{' '}
            <span className="font-medium text-foreground first-letter:uppercase">
              {dayLabelFormatter.format(new Date(current.start))} · {initial.time} hrs
            </span>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="patientName">Nombre del paciente</Label>
            <Input id="patientName" name="patientName" required autoComplete="off" placeholder="Ej. Laura Pérez" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="phone">WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" required placeholder="+52 55 1234 5678" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="treatment">Tratamiento</Label>
          <Input
            id="treatment"
            name="treatment"
            list="treatment-options"
            required
            defaultValue={current?.treatment}
            placeholder="Selecciona o escribe"
          />
          <datalist id="treatment-options">
            {TREATMENTS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="day">Día</Label>
          <select id="day" name="day" defaultValue={initial.dayKey} className={cn(fieldClassName, 'capitalize')}>
            {days.map((d) => (
              <option key={d.key} value={d.key} className="bg-popover">
                {dayLabelFormatter.format(d.date)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="time">Hora</Label>
          <Input id="time" name="time" type="time" min="08:00" max="20:00" step={900} required defaultValue={initial.time} />
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit">{isReschedule ? 'Confirmar nuevo horario' : 'Agendar cita'}</Button>
      </DialogFooter>
    </form>
  )
}
