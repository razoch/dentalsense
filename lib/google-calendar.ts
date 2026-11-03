import 'server-only'
import { cookies } from 'next/headers'

// Emulated Google Calendar connection: the "connected" state lives in a cookie and no Google API is called.
const CONNECTED_COOKIE = 'demo_gcal_connected'

export const DEMO_CALENDAR_ACCOUNT = 'razoch@gmail.com'

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function isCalendarConnected() {
  return (await cookies()).get(CONNECTED_COOKIE)?.value === '1'
}

export async function setCalendarConnected(connected: boolean) {
  const store = await cookies()
  if (connected) {
    store.set(CONNECTED_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  } else {
    store.delete(CONNECTED_COOKIE)
  }
}
