import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { CalendarControls } from './calendar-controls'

export function DashboardHeader({
  userName,
  calendarConnected,
  showCalendar,
}: {
  userName: string
  calendarConnected: boolean
  showCalendar: boolean
}) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            L
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Consultorio Dental Dra. Laura</p>
            <h1 className="text-xl font-semibold text-balance">Recordatorios y confirmaciones</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {showCalendar && <CalendarControls connected={calendarConnected} />}
          <form action={signOut} className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{userName}</span>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" aria-hidden="true" />
              Salir
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
