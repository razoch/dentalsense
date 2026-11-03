import { CalendarSync, LogOut } from 'lucide-react'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'

export function DashboardHeader({ userName }: { userName: string }) {
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <CalendarSync className="size-4" aria-hidden="true" />
            Google Calendar: pendiente de conectar
          </div>
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
