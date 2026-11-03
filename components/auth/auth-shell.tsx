import type { ReactNode } from 'react'

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            L
          </span>
          <p className="text-sm text-muted-foreground">Consultorio Dental Dra. Laura</p>
        </div>
        <section className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-balance">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
