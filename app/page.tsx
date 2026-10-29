import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { RemindersDashboard } from '@/components/dashboard/reminders-dashboard'
import { getUpcomingAppointments } from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export default function Page() {
  const appointments = getUpcomingAppointments()

  return (
    <div className="min-h-dvh">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <RemindersDashboard initialAppointments={appointments} />
      </main>
    </div>
  )
}
