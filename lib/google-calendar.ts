import 'server-only'
import { headers } from 'next/headers'
import { UserAuthorizationRequiredError, getToken, startAuthorization } from '@vercel/connect'
import { CLINIC_TIME_ZONE } from '@/lib/appointments'

const CONNECTOR_UID = 'google/calendario-consultorio-dental'
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export type GoogleCalendarEvent = {
  id: string
  status?: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}

function subjectFor(userId: string) {
  return { subject: { type: 'user' as const, id: userId, issuer: 'supabase' }, scopes: SCOPES }
}

export async function getCalendarToken(userId: string): Promise<string | null> {
  try {
    return await getToken(CONNECTOR_UID, subjectFor(userId))
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError) return null
    throw error
  }
}

export async function isCalendarConnected(userId: string) {
  try {
    return (await getCalendarToken(userId)) !== null
  } catch (error) {
    console.error('[google-calendar] token check failed:', error instanceof Error ? error.message : error)
    return false
  }
}

async function getOrigin() {
  if (process.env.NODE_ENV !== 'production' && process.env.V0_RUNTIME_URL) return process.env.V0_RUNTIME_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`
}

export async function getCalendarAuthorizationUrl(userId: string) {
  const origin = await getOrigin()
  const { url } = await startAuthorization(CONNECTOR_UID, subjectFor(userId), {
    callbackUrl: `${origin}/?calendar=connected`,
  })
  return url
}

async function calendarFetch<T>(token: string, path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`${EVENTS_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  if (response.status === 204 || response.status === 410) return null
  if (!response.ok) {
    throw new Error(`Google Calendar respondió ${response.status}`)
  }
  return (await response.json()) as T
}

export async function listEvents(token: string, timeMin: string, timeMax: string) {
  const events: GoogleCalendarEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'true',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const page = await calendarFetch<{ items?: GoogleCalendarEvent[]; nextPageToken?: string }>(token, `?${params}`)
    events.push(...(page?.items ?? []))
    pageToken = page?.nextPageToken
  } while (pageToken)
  return events
}

export type CalendarEventInput = {
  appointmentId: string
  patientName: string
  phone: string
  treatment: string
  startsAt: string
  endsAt: string
}

function toEventBody(input: CalendarEventInput) {
  return {
    summary: `${input.patientName} - ${input.treatment}`,
    description: `Paciente: ${input.patientName}\nWhatsApp: ${input.phone}\nTratamiento: ${input.treatment}`,
    start: { dateTime: input.startsAt, timeZone: CLINIC_TIME_ZONE },
    end: { dateTime: input.endsAt, timeZone: CLINIC_TIME_ZONE },
    extendedProperties: { private: { dentalsenseAppointmentId: input.appointmentId } },
  }
}

export async function insertEvent(token: string, input: CalendarEventInput) {
  const event = await calendarFetch<GoogleCalendarEvent>(token, '', {
    method: 'POST',
    body: JSON.stringify(toEventBody(input)),
  })
  return event?.id ?? null
}

export async function patchEvent(token: string, eventId: string, input: CalendarEventInput) {
  await calendarFetch(token, `/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toEventBody(input)),
  })
}

export async function deleteEvent(token: string, eventId: string) {
  await calendarFetch(token, `/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}
