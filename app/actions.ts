'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  REACTIVATION_COOLDOWN_HOURS,
  buildReactivationMessage,
  getUpcomingDayKeys,
  normalizePhone,
  toClinicISO,
} from '@/lib/appointments'
import {
  deleteEvent,
  getCalendarAuthorizationUrl,
  getCalendarToken,
  insertEvent,
  listEvents,
  patchEvent,
  type GoogleCalendarEvent,
} from '@/lib/google-calendar'
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

type StaffContext = NonNullable<Awaited<ReturnType<typeof requireStaff>>>

async function pushToCalendar(ctx: StaffContext, appointmentId: string, operation: 'upsert' | 'delete') {
  try {
    const token = await getCalendarToken(ctx.userId)
    if (!token) return

    const { data } = await ctx.supabase
      .from('appointments')
      .select('id, google_event_id, starts_at, ends_at, patients(full_name, phone), treatments(name)')
      .eq('id', appointmentId)
      .maybeSingle()
    if (!data) return

    if (operation === 'delete') {
      if (data.google_event_id) await deleteEvent(token, data.google_event_id)
      return
    }

    const patient = data.patients as unknown as { full_name: string; phone: string }
    const treatment = data.treatments as unknown as { name: string }
    const input = {
      appointmentId: data.id,
      patientName: patient.full_name,
      phone: patient.phone,
      treatment: treatment.name,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    }

    if (data.google_event_id) {
      await patchEvent(token, data.google_event_id, input)
    } else {
      const eventId = await insertEvent(token, input)
      if (eventId) await ctx.supabase.from('appointments').update({ google_event_id: eventId }).eq('id', data.id)
    }
  } catch (error) {
    console.error('[actions] Google Calendar push failed:', error instanceof Error ? error.message : error)
  }
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

export async function connectGoogleCalendar(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos.' }
  try {
    return { ok: true, url: await getCalendarAuthorizationUrl(ctx.userId) }
  } catch (error) {
    console.error('[actions] Google authorization failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'No se pudo iniciar la conexión con Google. Intenta de nuevo.' }
  }
}

export type CalendarSyncResult =
  | { ok: true; imported: number; updated: number; cancelled: number; skipped: number }
  | { ok: false; error: string; needsAuthorization?: boolean }

const PHONE_IN_TEXT_RE = /\+?\d[\d\s().-]{8,}\d/

function findPhone(event: GoogleCalendarEvent) {
  const match = `${event.description ?? ''}\n${event.summary ?? ''}`.match(PHONE_IN_TEXT_RE)
  if (!match) return null
  const phone = normalizePhone(match[0])
  return PHONE_RE.test(phone) ? phone : null
}

function findPatientName(event: GoogleCalendarEvent, treatmentName: string | null) {
  const fromDescription = event.description?.match(/Paciente:\s*(.+)/i)?.[1]?.trim()
  if (fromDescription) return fromDescription
  let name = (event.summary ?? '').replace(PHONE_IN_TEXT_RE, '')
  if (treatmentName) name = name.replace(new RegExp(treatmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
  return name.replace(/[-–|:,]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function syncGoogleCalendar(): Promise<CalendarSyncResult> {
  const ctx = await requireStaff()
  if (!ctx) return { ok: false, error: 'Tu sesión no tiene permisos.' }

  let token: string | null
  try {
    token = await getCalendarToken(ctx.userId)
  } catch (error) {
    console.error('[actions] Google token failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'No se pudo contactar a Google Calendar.' }
  }
  if (!token) return { ok: false, error: 'Conecta tu cuenta de Google primero.', needsAuthorization: true }

  const dayKeys = getUpcomingDayKeys()
  const lastDay = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() + 1)

  let events: GoogleCalendarEvent[]
  try {
    events = await listEvents(token, toClinicISO(dayKeys[0], '00:00'), toClinicISO(lastDay.toISOString().slice(0, 10), '00:00'))
  } catch (error) {
    console.error('[actions] Google list failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'No se pudieron leer los eventos de Google Calendar.' }
  }

  const timedEvents = events.filter((e) => e.start?.dateTime && e.end?.dateTime)
  const [{ data: treatments }, { data: existing }] = await Promise.all([
    ctx.supabase.from('treatments').select('id, name').eq('is_active', true),
    ctx.supabase
      .from('appointments')
      .select('id, google_event_id, starts_at, ends_at, status')
      .in('google_event_id', timedEvents.length ? timedEvents.map((e) => e.id) : ['-']),
  ])
  const byEventId = new Map((existing ?? []).map((a) => [a.google_event_id as string, a]))
  const fallbackTreatment =
    treatments?.find((t) => t.name.toLowerCase() === 'revisión general') ?? treatments?.[0] ?? null

  const result = { imported: 0, updated: 0, cancelled: 0, skipped: 0 }

  for (const event of timedEvents) {
    const current = byEventId.get(event.id)
    const closed = current?.status === 'completed' || current?.status === 'cancelled'

    if (event.status === 'cancelled') {
      if (current && !closed) {
        const { error } = await ctx.supabase.from('appointments').update({ status: 'cancelled' }).eq('id', current.id)
        if (!error) result.cancelled++
      }
      continue
    }

    const startsAt = new Date(event.start!.dateTime!).toISOString()
    const endsAt = new Date(event.end!.dateTime!).toISOString()

    if (current) {
      const moved =
        new Date(current.starts_at).getTime() !== new Date(startsAt).getTime() ||
        new Date(current.ends_at).getTime() !== new Date(endsAt).getTime()
      if (moved && !closed) {
        const { error } = await ctx.supabase
          .from('appointments')
          .update({ starts_at: startsAt, ends_at: endsAt, status: 'pending', last_message_at: null, reminder_attempts: 0 })
          .eq('id', current.id)
        if (error) result.skipped++
        else result.updated++
      }
      continue
    }

    const text = `${event.summary ?? ''} ${event.description ?? ''}`.toLowerCase()
    const treatment = treatments?.find((t) => text.includes(t.name.toLowerCase())) ?? fallbackTreatment
    const phone = findPhone(event)
    const patientName = findPatientName(event, treatment?.name ?? null)
    if (!treatment || !phone || patientName.length < 2) {
      result.skipped++
      continue
    }

    const { data: patient, error: patientError } = await ctx.supabase
      .from('patients')
      .upsert({ full_name: patientName.slice(0, 120), phone }, { onConflict: 'phone' })
      .select('id')
      .single()
    if (patientError) {
      result.skipped++
      continue
    }

    const { error } = await ctx.supabase.from('appointments').insert({
      patient_id: patient.id,
      treatment_id: treatment.id,
      starts_at: startsAt,
      ends_at: endsAt,
      google_event_id: event.id,
      created_by: ctx.userId,
    })
    if (error) result.skipped++
    else result.imported++
  }

  revalidatePath('/')
  return { ok: true, ...result }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
