'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { REACTIVATION_COOLDOWN_HOURS, buildReactivationMessage, normalizePhone } from '@/lib/appointments'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: staff } = await supabase.from('staff').select('id, is_active').eq('id', user.id).maybeSingle()
  return staff?.is_active ? { supabase, userId: user.id } : null
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

async function getTreatmentDuration(supabase: Awaited<ReturnType<typeof createClient>>, treatmentId: string) {
  const { data } = await supabase
    .from('treatments')
    .select('duration_minutes')
    .eq('id', treatmentId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.duration_minutes ?? null
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

  const { data: patient, error: patientError } = await ctx.supabase
    .from('patients')
    .upsert({ full_name: patientName, phone }, { onConflict: 'phone' })
    .select('id')
    .single()
  if (patientError) return dbError(patientError)

  const { error } = await ctx.supabase.from('appointments').insert({
    patient_id: patient.id,
    treatment_id: input.treatmentId,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
    created_by: ctx.userId,
  })
  if (error) return dbError(error)

  revalidatePath('/')
  return { ok: true }
}

export async function rescheduleAppointment(input: {
  id: string
  treatmentId: string
  start: string
}): Promise<ActionResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos para reagendar.' }

  const start = parseStart(input.start)
  if (!UUID_RE.test(input.id) || !UUID_RE.test(input.treatmentId)) return { ok: false, error: 'Datos inválidos.' }
  if (!start || start.getTime() < Date.now()) return { ok: false, error: 'Elige un horario futuro.' }

  const duration = await getTreatmentDuration(ctx.supabase, input.treatmentId)
  if (!duration) return { ok: false, error: 'El tratamiento seleccionado no está disponible.' }

  const { data, error } = await ctx.supabase
    .from('appointments')
    .update({
      treatment_id: input.treatmentId,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
      status: 'pending',
      last_message_at: null,
      reminder_attempts: 0,
      confirmed_at: null,
      cancelled_at: null,
      cancel_reason: null,
    })
    .eq('id', input.id)
    .neq('status', 'completed')
    .select('id')
  if (error) return dbError(error)
  if (!data.length) return { ok: false, error: 'La cita ya no se puede reagendar.' }

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
    delivery_status: 'queued',
    sent_by: ctx.userId,
  })
  if (messageError) return dbError(messageError)

  const { error } = await ctx.supabase
    .from('appointments')
    .update({
      status: 'sending',
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

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
