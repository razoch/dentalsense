'use client'

import { CalendarX2, CircleCheckBig } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Appointment } from '@/lib/appointments'
import { cn } from '@/lib/utils'

export type ConfirmActionState = { action: 'complete' | 'cancel'; appointment: Appointment } | null

const copy = {
  complete: {
    title: 'Finalizar cita',
    description: (name: string) => `Marca la cita de ${name} como atendida. Ya no se enviarán recordatorios.`,
    confirm: 'Sí, finalizar',
    icon: CircleCheckBig,
    iconClassName: 'bg-success-soft text-success',
    buttonClassName: 'bg-success text-white hover:bg-success/90',
  },
  cancel: {
    title: 'Cancelar cita',
    description: (name: string) =>
      `Se cancelará la cita de ${name} y quedará marcada para reagendar. Podrás reagendarla después.`,
    confirm: 'Sí, cancelar cita',
    icon: CalendarX2,
    iconClassName: 'bg-danger-soft text-danger',
    buttonClassName: 'bg-danger text-white hover:bg-danger/90',
  },
} as const

export function ConfirmActionDialog({
  state,
  onOpenChange,
  onConfirm,
}: {
  state: ConfirmActionState
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const config = state ? copy[state.action] : copy.cancel
  const Icon = config.icon

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className={cn('mb-2 flex size-10 items-center justify-center rounded-lg', config.iconClassName)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{state ? config.description(state.appointment.patientName) : null}</DialogDescription>
        </DialogHeader>
        {state && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{state.appointment.patientName}</p>
            <p className="text-muted-foreground">{state.appointment.treatment}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button className={config.buttonClassName} onClick={onConfirm}>
            {config.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
