import { ShieldAlert } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { RemindersDashboard } from '@/components/dashboard/reminders-dashboard'
import { getDashboardData } from '@/lib/data'

export default async function Page() {
  const { staff, user, dayKeys, appointments, treatments } = await getDashboardData()

  return (
    <div className="min-h-dvh">
      <DashboardHeader userName={staff?.full_name ?? user.email ?? ''} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {staff?.is_active ? (
          <RemindersDashboard appointments={appointments} treatments={treatments} dayKeys={dayKeys} />
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <ShieldAlert className="size-8 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Cuenta pendiente de activación</h2>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Tu cuenta fue creada correctamente. La Dra. Laura debe activarla antes de que puedas ver la agenda.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
