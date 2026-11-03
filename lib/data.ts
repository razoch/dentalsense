import 'server-only'
import { redirect } from 'next/navigation'
import {
  getUpcomingDayKeys,
  rowToAppointment,
  toClinicISO,
  type DashboardAppointmentRow,
  type Treatment,
} from '@/lib/appointments'
import { createClient } from '@/lib/supabase/server'

export async function getCurrentStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, staff }
}

export async function getDashboardData() {
  const { supabase, user, staff } = await getCurrentStaff()
  const dayKeys = getUpcomingDayKeys()

  if (!staff?.is_active) {
    return { user, staff, dayKeys, appointments: [], treatments: [] }
  }

  const rangeStart = toClinicISO(dayKeys[0], '00:00')
  const lastDay = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() + 1)
  const rangeEnd = toClinicISO(lastDay.toISOString().slice(0, 10), '00:00')

  const [appointmentsResult, treatmentsResult] = await Promise.all([
    supabase
      .from('dashboard_appointments')
      .select('id, patient_name, phone, treatment_id, treatment, starts_at, status, last_message_at')
      .gte('starts_at', rangeStart)
      .lt('starts_at', rangeEnd)
      .order('starts_at'),
    supabase.from('treatments').select('id, name, duration_minutes').eq('is_active', true).order('name'),
  ])

  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message)
  if (treatmentsResult.error) throw new Error(treatmentsResult.error.message)

  const appointments = (appointmentsResult.data as DashboardAppointmentRow[]).map(rowToAppointment)
  const treatments: Treatment[] = treatmentsResult.data.map((t) => ({
    id: t.id,
    name: t.name,
    durationMinutes: t.duration_minutes,
  }))

  return { user, staff, dayKeys, appointments, treatments }
}
