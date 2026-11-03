'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, AlertTriangle, CalendarPlus, CheckCircle2, Clock, HeartPulse, Loader2 } from 'lucide-react'
import { sendReactivationSequence } from '@/app/actions'
import { Button } from '@/components/ui/button'
import {
  CLINIC_TIME_ZONE,
  REACTIVATION_COOLDOWN_HOURS,
  REACTIVATION_HIGH_RISK_DAYS,
  type RiskPatient,
} from '@/lib/appointments'
import { cn } from '@/lib/utils'
import { WhatsAppIcon } from './whatsapp-icon'

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: CLINIC_TIME_ZONE,
  day: 'numeric',
  month: 'short',
})

const relativeFormatter = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

function formatRelative(iso: string) {
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
  return Math.abs(hours) < 24
    ? relativeFormatter.format(hours, 'hour')
    : relativeFormatter.format(Math.round(hours / 24), 'day')
}

function isOnCooldown(patient: RiskPatient) {
  return (
    !!patient.lastReactivationAt &&
    Date.now() - new Date(patient.lastReactivationAt).getTime() < REACTIVATION_COOLDOWN_HOURS * 3_600_000
  )
}

export function AbandonmentRisk({
  patients,
  onSchedule,
}: {
  patients: RiskPatient[]
  onSchedule: (patient: RiskPatient) => void
}) {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentMessages, setSentMessages] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const highRisk = patients.filter((p) => p.daysInactive > REACTIVATION_HIGH_RISK_DAYS).length

  function handleSend(patient: RiskPatient) {
    setSendingId(patient.appointmentId)
    setErrors(({ [patient.appointmentId]: _, ...rest }) => rest)
    startTransition(async () => {
      const result = await sendReactivationSequence(patient.appointmentId)
      if (result.ok) {
        setSentMessages((prev) => ({ ...prev, [patient.appointmentId]: result.message }))
      } else {
        setErrors((prev) => ({ ...prev, [patient.appointmentId]: result.error }))
      }
      setSendingId(null)
    })
  }

  return (
    <section aria-labelledby="risk-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="risk-title" className="flex items-center gap-2 text-lg font-semibold">
          <HeartPulse className="size-5 text-primary" aria-hidden="true" />
          Tratamientos multisesión sin continuidad
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Pacientes de endodoncia u ortodoncia con su última sesión finalizada hace más de 15 días y sin una cita nueva.
          {highRisk > 0 && (
            <>
              {' '}
              <span className="font-medium text-danger">
                {highRisk} {highRisk === 1 ? 'lleva' : 'llevan'} más de {REACTIVATION_HIGH_RISK_DAYS} días.
              </span>
            </>
          )}
        </p>
      </div>

      {patients.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => {
            const high = patient.daysInactive > REACTIVATION_HIGH_RISK_DAYS
            const sentMessage = sentMessages[patient.appointmentId]
            const error = errors[patient.appointmentId]
            const sending = sendingId === patient.appointmentId
            const cooldown = !sentMessage && isOnCooldown(patient)

            return (
              <li
                key={patient.appointmentId}
                className={cn(
                  'flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm',
                  high ? 'border-danger/40' : 'border-warning/30',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="truncate font-semibold">{patient.patientName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {patient.treatment}
                      <span aria-hidden="true"> · </span>
                      <span className="whitespace-nowrap">Última sesión {dateFormatter.format(new Date(patient.lastSessionAt))}</span>
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex shrink-0 flex-col items-center rounded-xl px-3 py-1.5',
                      high ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                    )}
                  >
                    <span className="text-xl font-semibold leading-tight tabular-nums">{patient.daysInactive}</span>
                    <span className="text-xs font-medium">días inactivo</span>
                  </div>
                </div>

                {high && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                    Riesgo alto de abandono
                  </p>
                )}

                {sentMessage ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-success-soft p-3" role="status">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Secuencia enviada (simulación)
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">{sentMessage}</p>
                  </div>
                ) : (
                  patient.lastReactivationAt && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                      {patient.reactivationCount} {patient.reactivationCount === 1 ? 'envío' : 'envíos'} · último{' '}
                      {formatRelative(patient.lastReactivationAt)}
                    </p>
                  )
                )}

                {error && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    className="flex-1"
                    disabled={sending || cooldown || !!sentMessage}
                    onClick={() => handleSend(patient)}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <WhatsAppIcon className="size-4" />
                    )}
                    {sending
                      ? 'Enviando…'
                      : sentMessage || cooldown
                        ? 'Enviada hoy'
                        : 'Enviar secuencia de reactivación'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSchedule(patient)}
                    aria-label={`Agendar siguiente sesión de ${patient.patientName}`}
                    title="Agendar siguiente sesión"
                  >
                    <CalendarPlus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-12 text-center">
          <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
          <p className="font-medium">Ningún paciente en riesgo de abandono</p>
          <p className="text-sm text-muted-foreground">
            Todos los tratamientos multisesión tienen su siguiente cita agendada.
          </p>
        </div>
      )}
    </section>
  )
}
