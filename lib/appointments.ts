export type ReminderStatus = 'pending' | 'sending' | 'sent' | 'confirmed' | 'cancelled' | 'completed'

export type Appointment = {
  id: string
  patientName: string
  phone: string
  treatment: string
  start: string
  status: ReminderStatus
  lastMessageAt?: string
}

type CalendarEventSeed = {
  dayOffset: number
  time: string
  summary: string
  description: string
  phone: string
  status: ReminderStatus
}

// Mirrors the shape of Google Calendar events: "summary" holds the patient, "description" the treatment.
const seeds: CalendarEventSeed[] = [
  { dayOffset: 0, time: '09:00', summary: 'María Fernanda López', description: 'Limpieza dental', phone: '+52 55 1234 5678', status: 'confirmed' },
  { dayOffset: 0, time: '10:30', summary: 'Jorge Ramírez', description: 'Resina en molar', phone: '+52 55 2345 6789', status: 'sending' },
  { dayOffset: 0, time: '12:00', summary: 'Ana Sofía Torres', description: 'Revisión de ortodoncia', phone: '+52 55 3456 7890', status: 'sent' },
  { dayOffset: 0, time: '16:00', summary: 'Ricardo Méndez', description: 'Extracción de muela del juicio', phone: '+52 55 4567 8901', status: 'cancelled' },
  { dayOffset: 1, time: '09:30', summary: 'Lucía Herrera', description: 'Blanqueamiento', phone: '+52 55 5678 9012', status: 'sent' },
  { dayOffset: 1, time: '11:00', summary: 'Carlos Gutiérrez', description: 'Endodoncia (2ª sesión)', phone: '+52 55 6789 0123', status: 'confirmed' },
  { dayOffset: 1, time: '13:00', summary: 'Valeria Castillo', description: 'Valoración inicial', phone: '+52 55 7890 1234', status: 'pending' },
  { dayOffset: 2, time: '10:00', summary: 'Diego Morales', description: 'Limpieza dental', phone: '+52 55 8901 2345', status: 'pending' },
  { dayOffset: 2, time: '12:30', summary: 'Patricia Núñez', description: 'Colocación de corona', phone: '+52 55 9012 3456', status: 'sent' },
  { dayOffset: 2, time: '17:00', summary: 'Fernando Ruiz', description: 'Ajuste de brackets', phone: '+52 55 0123 4567', status: 'confirmed' },
  { dayOffset: 3, time: '09:00', summary: 'Gabriela Ortiz', description: 'Resina estética', phone: '+52 55 1122 3344', status: 'pending' },
  { dayOffset: 3, time: '15:30', summary: 'Andrés Vega', description: 'Revisión general', phone: '+52 55 2233 4455', status: 'cancelled' },
  { dayOffset: 4, time: '10:00', summary: 'Sofía Delgado', description: 'Limpieza dental', phone: '+52 55 3344 5566', status: 'pending' },
  { dayOffset: 4, time: '11:30', summary: 'Miguel Ángel Rosas', description: 'Implante (control)', phone: '+52 55 4455 6677', status: 'pending' },
]

export const CLINIC_TIME_ZONE = 'America/Mexico_City'
const CLINIC_UTC_OFFSET = '-06:00'

export const TREATMENTS = [
  'Limpieza dental',
  'Valoración inicial',
  'Revisión general',
  'Resina estética',
  'Endodoncia',
  'Extracción',
  'Blanqueamiento',
  'Ajuste de brackets',
  'Colocación de corona',
  'Implante (control)',
]

export function toClinicISO(dayKey: string, time: string) {
  return new Date(`${dayKey}T${time}:00${CLINIC_UTC_OFFSET}`).toISOString()
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

export function getUpcomingAppointments(now = new Date()): Appointment[] {
  const todayInClinic = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIME_ZONE }).format(now)
  const [y, m, d] = todayInClinic.split('-').map(Number)

  return seeds.map((seed, index) => {
    const day = new Date(Date.UTC(y, m - 1, d + seed.dayOffset)).toISOString().slice(0, 10)
    const start = new Date(`${day}T${seed.time}:00${CLINIC_UTC_OFFSET}`)

    const lastMessageAt =
      seed.status === 'pending' ? undefined : new Date(now.getTime() - (index + 1) * 17 * 60_000).toISOString()

    return {
      id: `evt-${index + 1}`,
      patientName: seed.summary,
      phone: seed.phone,
      treatment: seed.description,
      start: start.toISOString(),
      status: seed.status,
      lastMessageAt,
    }
  })
}
