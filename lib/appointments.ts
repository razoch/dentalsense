export type ReminderStatus = 'pending' | 'sending' | 'sent' | 'confirmed' | 'cancelled' | 'completed'

export type Appointment = {
  id: string
  patientName: string
  phone: string
  treatmentId: string
  treatment: string
  start: string
  status: ReminderStatus
  lastMessageAt?: string
}

export type Treatment = { id: string; name: string; durationMinutes: number }

export type RiskPatient = {
  appointmentId: string
  patientId: string
  patientName: string
  phone: string
  treatment: string
  category: 'multisesion_endodoncia' | 'multisesion_ortodoncia'
  lastSessionAt: string
  daysInactive: number
  lastReactivationAt: string | null
  reactivationCount: number
}

export const REACTIVATION_HIGH_RISK_DAYS = 30
export const REACTIVATION_COOLDOWN_HOURS = 24

export function buildReactivationMessage(patientName: string, treatment: string, daysInactive: number) {
  const firstName = patientName.trim().split(/\s+/)[0]
  return `Hola ${firstName}, te saluda el consultorio de la Dra. Laura. Notamos que han pasado ${daysInactive} días desde tu última sesión de ${treatment.toLowerCase()}. Aunque ya no sientas molestias, es importante concluir el tratamiento para evitar complicaciones. ¿Te gustaría que te agendemos tu siguiente cita esta semana? Responde SÍ y te compartimos horarios.`
}

export type DashboardAppointmentRow = {
  id: string
  patient_name: string
  phone: string
  treatment_id: string
  treatment: string
  starts_at: string
  status: ReminderStatus
  last_message_at: string | null
}

export const CLINIC_TIME_ZONE = 'America/Mexico_City'
const CLINIC_UTC_OFFSET = '-06:00'
export const UPCOMING_DAYS = 5

export function toClinicISO(dayKey: string, time: string) {
  return new Date(`${dayKey}T${time}:00${CLINIC_UTC_OFFSET}`).toISOString()
}

export function dayKeyToDate(dayKey: string) {
  return new Date(`${dayKey}T12:00:00${CLINIC_UTC_OFFSET}`)
}

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIME_ZONE })
const timeKeyFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function toClinicParts(iso: string) {
  const date = new Date(iso)
  return { dayKey: dayKeyFormatter.format(date), time: timeKeyFormatter.format(date) }
}

export function getUpcomingDayKeys(now = new Date(), count = UPCOMING_DAYS) {
  const [y, m, d] = dayKeyFormatter.format(now).split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10))
}

export function rowToAppointment(row: DashboardAppointmentRow): Appointment {
  return {
    id: row.id,
    patientName: row.patient_name,
    phone: row.phone,
    treatmentId: row.treatment_id,
    treatment: row.treatment,
    start: new Date(row.starts_at).toISOString(),
    status: row.status,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : undefined,
  }
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+52${digits}`
  return `+${digits}`
}

export function formatPhone(e164: string) {
  const match = e164.match(/^\+52(\d{2})(\d{4})(\d{4})$/)
  return match ? `+52 ${match[1]} ${match[2]} ${match[3]}` : e164
}
