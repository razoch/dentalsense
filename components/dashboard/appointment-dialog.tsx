'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, CalendarPlus, Info, PencilLine } from 'lucide-react'
import type { EditableStatus } from '@/app/actions'
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
import { toClinicISO, toClinicParts, type Appointment, type Treatment } from '@/lib/appointments'

export type DialogState =
  | { mode: 'create'; prefill?: { patientName: string; phone: string; treatmentId?: string } }
  | { mode: 'edit'; appointment: Appointment }
  | null

export type AppointmentFormValues = {
  patientName: string
  phone: string
  treatmentId: string
  start: string
  status: EditableStatus
}

type SubmitHandler = (values: AppointmentFormValues) => Promise<string | null>

const STATUS_OPTIONS: { value: EditableStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente de recordatorio' },
  { value: 'sent', label: 'Recordatorio enviado' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'completed', label: 'Completada (paciente atendido)' },
  { value: 'cancelled', label: 'Cancelada' },
]

const fieldClassName =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function AppointmentDialog({
  state,
  days,
  treatments,
  appointments,
  onOpenChange,
  onSubmit,
}: {
  state: DialogState
  days: { key: string; date: Date }[]
  treatments: Treatment[]
  appointments: Appointment[]
  onOpenChange: (open: boolean) => void
  onSubmit: SubmitHandler
}) {
  const formKey =
    state?.mode === 'edit'
      ? state.appointment.id
      : state?.mode === 'create'
        ? `create-${state.prefill?.phone ?? ''}`
        : 'closed'

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state && (
          <AppointmentForm
            key={formKey}
            state={state}
            todayKey={days[0]?.key ?? ''}
            treatments={treatments}
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
  todayKey,
  treatments,
  appointments,
  onSubmit,
}: {
  state: NonNullable<DialogState>
  todayKey: string
  treatments: Treatment[]
  appointments: Appointment[]
  onSubmit: SubmitHandler
}) {
  const isEdit = state.mode === 'edit'
  const current = isEdit ? state.appointment : null
  const prefill = state.mode === 'create' ? state.prefill : undefined
  const initial = current ? toClinicParts(current.start) : { dayKey: todayKey, time: '09:00' }
  const initialStatus: EditableStatus = current
    ? current.status === 'sending'
      ? 'sent'
      : current.status
    : 'pending'

  const [status, setStatus] = useState<EditableStatus>(initialStatus)
  const [dayKey, setDayKey] = useState(initial.dayKey)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const isPastDate = dayKey !== '' && dayKey < todayKey

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patientName = String(data.get('patientName') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const treatmentId = String(data.get('treatmentId') ?? '')
    const time = String(data.get('time') ?? '')

    if (!patientName || !phone || !treatmentId || !dayKey || !time) {
      setError('Completa todos los campos.')
      return
    }

    const start = toClinicISO(dayKey, time)
    const conflict = appointments.find(
      (a) => a.id !== current?.id && a.status !== 'cancelled' && a.status !== 'completed' && a.start === start,
    )
    if (conflict && status !== 'cancelled') {
      setError(`Ese horario ya está ocupado por ${conflict.patientName}.`)
      return
    }

    setError(null)
    setIsPending(true)
    const submitError = await onSubmit({ patientName, phone, treatmentId, start, status: isEdit ? status : 'pending' })
    setIsPending(false)
    if (submitError) setError(submitError)
  }

  const Icon = isEdit ? PencilLine : CalendarPlus

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle>{isEdit ? 'Editar cita' : 'Agendar nueva cita'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Los cambios solo afectan a esta cita.'
                : 'La cita se creará en Google Calendar con recordatorio automático.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="patientName">Nombre del paciente</Label>
          <Input
            id="patientName"
            name="patientName"
            required
            autoComplete="off"
            placeholder="Ej. Laura Pérez"
            defaultValue={current?.patientName ?? prefill?.patientName}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="+52 55 1234 5678"
            defaultValue={current?.phone ?? prefill?.phone}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="treatmentId">Tratamiento</Label>
          <select
            id="treatmentId"
            name="treatmentId"
            required
            defaultValue={current?.treatmentId ?? prefill?.treatmentId ?? ''}
            className={fieldClassName}
          >
            <option value="" disabled className="bg-popover">
              Selecciona un tratamiento
            </option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id} className="bg-popover">
                {t.name} · {t.durationMinutes} min
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="day">Fecha</Label>
          <Input
            id="day"
            name="day"
            type="date"
            required
            min={isEdit ? undefined : todayKey}
            value={dayKey}
            onChange={(e) => setDayKey(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="time">Hora</Label>
          <Input id="time" name="time" type="time" min="08:00" max="20:00" step={900} required defaultValue={initial.time} />
        </div>
        {isEdit && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="status">Estado</Label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EditableStatus)}
              className={fieldClassName}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-popover">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isEdit && isPastDate && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {status === 'completed'
            ? 'Fecha pasada: si es endodoncia u ortodoncia y han pasado más de 15 días, el paciente aparecerá en Riesgo de abandono.'
            : 'Fecha pasada: marca la cita como Completada para que cuente como última sesión del tratamiento.'}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agendar cita'}
        </Button>
      </DialogFooter>
    </form>
  )
}
