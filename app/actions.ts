'use server'

import { revalidatePath } from 'next/cache'
import {
  REACTIVATION_COOLDOWN_HOURS,
  buildReactivationMessage,
  normalizePhone,
} from '@/lib/appointments'
import { isCalendarConnected, setCalendarConnected, wait } from '@/lib/google-calendar'
import { createAdminClient, getDemoStaff } from '@/lib/supabase/admin'

export type ActionResult = { ok: true } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/

async function requireStaff() {
  const { supabase, staff } = await getDemoStaff()
  return staff?.is_active ? { supabase, userId: staff.id as string } : null
}

type StaffContext = NonNullable<Awaited<ReturnType<typeof requireStaff>>>

// Emulated push: marks the appointment as linked to a calendar event without calling Google.
async function pushToCalendar(ctx: StaffContext, appointmentId: string, operation: 'upsert' | 'delete') {
  if (operation === 'delete' || !(await isCalendarConnected())) return
  await ctx.supabase
    .from('appointments')
    .update({ google_event_id: `demo-${appointmentId}` })
    .eq('id', appointmentId)
    .is('google_event_id', null)
}

function dbError(error: { code?: string; message: string }): ActionResult {
  if (error.code === '23P01') return { ok: false, error: 'Ese horario se empalma con otra cita activa.' }
  if (error.code === '23514') return { ok: false, error: 'Algún dato no es válido. Revisa el formulario.' }
  console.error('[actions] Supabase error:', error.message)
  return { ok: false, error: 'No se pudo guardar el cambio. Intenta de nuevo.' }
}

function parseStart(start: unknown) {
  if (typeof start !== 'string') return null
  const date = new Date(start)
  return Number.isNaN(date.getTime()) ? null : date
}

async function getTreatmentDuration(supabase: ReturnType<typeof createAdminClient>, treatmentId: string) {
  const { data } = await supabase
    .from('treatments')
    .select('duration_minutes')
    .eq('id', treatmentId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.duration_minutes ?? null
}

// Patients are matched by phone + name so relatives sharing a WhatsApp number keep separate records
// and booking never renames an existing patient.
async function findOrCreatePatient(
  supabase: ReturnType<typeof createAdminClient>,
  fullName: string,
  phone: string,
): Promise<{ id: string } | { error: { code?: string; message: string } }> {
  const { data: matches, error: lookupError } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('phone', phone)
  if (lookupError) return { error: lookupError }

  const wanted = fullName.trim().toLowerCase()
  const existing = matches?.find((p) => p.full_name.trim().toLowerCase() === wanted)
  if (existing) return { id: existing.id }

  const { data: created, error } = await supabase
    .from('patients')
    .insert({ full_name: fullName, phone })
    .select('id')
    .single()
  return error ? { error } : { id: created.id }
}

export async function createAppointment(input: {
  patientName: string
  phone: string
  treatmentId: string
  start: string
}): Promise<ActionResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos para agendar.' }

  const patientName = String(input.patientName ?? '').trim()
  const phone = normalizePhone(String(input.phone ?? ''))
  const start = parseStart(input.start)

  if (patientName.length < 2 || patientName.length > 120) return { ok: false, error: 'Escribe el nombre del paciente.' }
  if (!PHONE_RE.test(phone)) return { ok: false, error: 'El WhatsApp debe tener 10 dígitos o formato +52…' }
  if (!UUID_RE.test(input.treatmentId)) return { ok: false, error: 'Selecciona un tratamiento.' }
  if (!start || start.getTime() < Date.now()) return { ok: false, error: 'Elige un horario futuro.' }

  const duration = await getTreatmentDuration(ctx.supabase, input.treatmentId)
  if (!duration) return { ok: false, error: 'El tratamiento seleccionado no está disponible.' }

  const patient = await findOrCreatePatient(ctx.supabase, patientName, phone)
  if ('error' in patient) return dbError(patient.error)

  const { data: created, error } = await ctx.supabase
    .from('appointments')
    .insert({
      patient_id: patient.id,
      treatment_id: input.treatmentId,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
      created_by: ctx.userId,
    })
    .select('id')
    .single()
  if (error) return dbError(error)

  await pushToCalendar(ctx, created.id, 'upsert')
  revalidatePath('/')
  return { ok: true }
}

const EDITABLE_STATUSES = ['pending', 'sent', 'confirmed', 'completed', 'cancelled'] as const
export type EditableStatus = (typeof EDITABLE_STATUSES)[number]

export async function updateAppointment(input: {
  id: string
  patientName: string
  phone: string
  treatmentId: string
  start: string
  status: EditableStatus
}): Promise<ActionResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos para editar.' }

  const patientName = String(input.patientName ?? '').trim()
  const phone = normalizePhone(String(input.phone ?? ''))
  const start = parseStart(input.start)

  if (!UUID_RE.test(input.id) || !UUID_RE.test(input.treatmentId)) return { ok: false, error: 'Datos inválidos.' }
  if (patientName.length < 2 || patientName.length > 120) return { ok: false, error: 'Escribe el nombre del paciente.' }
  if (!PHONE_RE.test(phone)) return { ok: false, error: 'El WhatsApp debe tener 10 dígitos o formato +52…' }
  if (!EDITABLE_STATUSES.includes(input.status)) return { ok: false, error: 'Estado inválido.' }
  if (!start) return { ok: false, error: 'Elige una fecha y hora válidas.' }

  const duration = await getTreatmentDuration(ctx.supabase, input.treatmentId)
  if (!duration) return { ok: false, error: 'El tratamiento seleccionado no está disponible.' }

  const patient = await findOrCreatePatient(ctx.supabase, patientName, phone)
  if ('error' in patient) return dbError(patient.error)

  const endsAt = new Date(start.getTime() + duration * 60_000).toISOString()
  const status = input.status

  const { data, error } = await ctx.supabase
    .from('appointments')
    .update({
      patient_id: patient.id,
      treatment_id: input.treatmentId,
      starts_at: start.toISOString(),
      ends_at: endsAt,
      status,
      // Stamp completion at the session end so back-dated sessions feed the abandonment-risk view correctly.
      completed_at: status === 'completed' ? endsAt : null,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
      ...(status === 'pending' ? { last_message_at: null, reminder_attempts: 0 } : {}),
    })
    .eq('id', input.id)
    .select('id')
  if (error) return dbError(error)
  if (!data.length) return { ok: false, error: 'No se encontró la cita.' }

  await pushToCalendar(ctx, input.id, 'upsert')
  revalidatePath('/')
  return { ok: true }
}

export async function closeAppointment(id: string, status: 'completed' | 'cancelled'): Promise<ActionResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos.' }
  if (!UUID_RE.test(id) || (status !== 'completed' && status !== 'cancelled')) return { ok: false, error: 'Datos inválidos.' }

  const { data, error } = await ctx.supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .not('status', 'in', '(completed,cancelled)')
    .select('id')
  if (error) return dbError(error)
  if (!data.length) return { ok: false, error: 'La cita ya estaba cerrada.' }

  if (status === 'cancelled') await pushToCalendar(ctx, id, 'delete')
  revalidatePath('/')
  return { ok: true }
}

export async function resendReminder(id: string): Promise<ActionResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos.' }
  if (!UUID_RE.test(id)) return { ok: false, error: 'Datos inválidos.' }

  const { data: appointment } = await ctx.supabase
    .from('dashboard_appointments')
    .select('id, patient_name, treatment, starts_at, status, reminder_attempts')
    .eq('id', id)
    .maybeSingle()
  if (!appointment) return { ok: false, error: 'No se encontró la cita.' }
  if (appointment.status === 'completed' || appointment.status === 'cancelled' || appointment.status === 'confirmed') {
    return { ok: false, error: 'Esta cita ya no necesita recordatorio.' }
  }

  const when = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(appointment.starts_at))

  const { error: messageError } = await ctx.supabase.from('whatsapp_messages').insert({
    appointment_id: id,
    direction: 'outbound',
    kind: 'resend',
    body: `Hola ${appointment.patient_name}, te recordamos tu cita de ${appointment.treatment} el ${when} con la Dra. Laura. Responde SÍ para confirmar o NO para reagendar.`,
    delivery_status: 'sent',
    sent_by: ctx.userId,
  })
  if (messageError) return dbError(messageError)

  // Simulated WhatsApp delivery delay; the row shows "Enviando…" on the client meanwhile.
  await wait(1800)

  const { error } = await ctx.supabase
    .from('appointments')
    .update({
      status: 'sent',
      last_message_at: new Date().toISOString(),
      reminder_attempts: (appointment.reminder_attempts ?? 0) + 1,
    })
    .eq('id', id)
  if (error) return dbError(error)

  revalidatePath('/')
  return { ok: true }
}

export async function sendReactivationSequence(
  appointmentId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos.' }
  if (!UUID_RE.test(appointmentId)) return { ok: false, error: 'Datos inválidos.' }

  const { data: patient } = await ctx.supabase
    .from('abandonment_risk')
    .select('appointment_id, patient_name, treatment, days_inactive, last_reactivation_at')
    .eq('appointment_id', appointmentId)
    .maybeSingle()
  if (!patient) return { ok: false, error: 'Este paciente ya no está en riesgo de abandono.' }

  if (
    patient.last_reactivation_at &&
    Date.now() - new Date(patient.last_reactivation_at).getTime() < REACTIVATION_COOLDOWN_HOURS * 3_600_000
  ) {
    return { ok: false, error: 'Ya se envió una secuencia en las últimas 24 horas.' }
  }

  const message = buildReactivationMessage(patient.patient_name, patient.treatment, patient.days_inactive)

  // Simulated delivery: logged as sent until a WhatsApp provider is connected.
  const { error } = await ctx.supabase.from('whatsapp_messages').insert({
    appointment_id: appointmentId,
    direction: 'outbound',
    kind: 'reactivation',
    body: message,
    delivery_status: 'sent',
    sent_by: ctx.userId,
  })
  if (error) {
    const result = dbError(error)
    return { ok: false, error: result.ok ? 'Error inesperado.' : result.error }
  }

  revalidatePath('/')
  return { ok: true, message }
}

export async function connectGoogleCalendar(): Promise<ActionResult> {
  await wait(1200)
  await setCalendarConnected(true)
  revalidatePath('/')
  return { ok: true }
}

export async function disconnectGoogleCalendar(): Promise<ActionResult> {
  await setCalendarConnected(false)
  revalidatePath('/')
  return { ok: true }
}

export type CalendarSyncResult =
  | { ok: true; synced: number }
  | { ok: false; error: string; needsAuthorization?: boolean }

export async function syncGoogleCalendar(): Promise<CalendarSyncResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'No hay personal activo en el consultorio.' }
  if (!(await isCalendarConnected())) {
    return { ok: false, error: 'Conecta Google Calendar primero.', needsAuthorization: true }
  }

  await wait(1500)

  const { data, error } = await ctx.supabase
    .from('appointments')
    .update({ google_event_id: 'demo-synced' })
    .is('google_event_id', null)
    .not('status', 'in', '(completed,cancelled)')
    .gte('starts_at', new Date().toISOString())
    .select('id')
  if (error) {
    console.error('[actions] Calendar sync error:', error.message)
    return { ok: false, error: 'No se pudo sincronizar el calendario.' }
  }

  revalidatePath('/')
  return { ok: true, synced: data.length }
}
