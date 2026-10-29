import { CalendarSync } from 'lucide-react'

export function DashboardHeader() {
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
        <div className="flex items-center gap-2 self-start rounded-full bg-success-soft px-3 py-1.5 text-sm font-medium text-success sm:self-auto">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <CalendarSync className="size-4" aria-hidden="true" />
          Sincronizado con Google Calendar
        </div>
      </div>
    </header>
  )
}
