import 'server-only'
import {
  getUpcomingDayKeys,
  rowToAppointment,
  toClinicISO,
  type DashboardAppointmentRow,
  type RiskPatient,
  type Treatment,
} from '@/lib/appointments'
import { isCalendarConnected } from '@/lib/google-calendar'
import { getDemoStaff } from '@/lib/supabase/admin'

export async function getCurrentStaff() {
  const { supabase, staff } = await getDemoStaff()
  const user = { id: staff?.id ?? '', email: null as string | null }
  return { supabase, user, staff }
}

export async function getDashboardData() {
  const { supabase, user, staff } = await getCurrentStaff()
  const dayKeys = getUpcomingDayKeys()

  if (!staff?.is_active) {
    return {
      user,
      staff,
      dayKeys,
      appointments: [],
      treatments: [],
      riskPatients: [] as RiskPatient[],
      calendarConnected: false,
    }
  }

  const rangeStart = toClinicISO(dayKeys[0], '00:00')
  const lastDay = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() + 1)
  const rangeEnd = toClinicISO(lastDay.toISOString().slice(0, 10), '00:00')

  const [appointmentsResult, treatmentsResult, riskResult, calendarConnected] = await Promise.all([
    supabase
      .from('dashboard_appointments')
      .select('id, patient_name, phone, treatment_id, treatment, starts_at, status, last_message_at')
      .gte('starts_at', rangeStart)
      .lt('starts_at', rangeEnd)
      .order('starts_at'),
    supabase.from('treatments').select('id, name, duration_minutes').eq('is_active', true).order('name'),
    supabase
      .from('abandonment_risk')
      .select(
        'appointment_id, patient_id, patient_name, phone, treatment, followup_category, last_session_at, days_inactive, last_reactivation_at, reactivation_count',
      )
      .order('days_inactive', { ascending: false }),
    isCalendarConnected(),
  ])

  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message)
  if (treatmentsResult.error) throw new Error(treatmentsResult.error.message)
  if (riskResult.error) throw new Error(riskResult.error.message)

  const riskPatients: RiskPatient[] = riskResult.data.map((r) => ({
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    phone: r.phone,
    treatment: r.treatment,
    category: r.followup_category,
    lastSessionAt: r.last_session_at,
    daysInactive: r.days_inactive,
    lastReactivationAt: r.last_reactivation_at,
    reactivationCount: r.reactivation_count,
  }))

  const appointments = (appointmentsResult.data as DashboardAppointmentRow[]).map(rowToAppointment)
  const treatments: Treatment[] = treatmentsResult.data.map((t) => ({
    id: t.id,
    name: t.name,
    durationMinutes: t.duration_minutes,
  }))

  return { user, staff, dayKeys, appointments, treatments, riskPatients, calendarConnected }
}
