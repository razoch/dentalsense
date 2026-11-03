'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, CalendarSync, Loader2, RefreshCw, Unplug } from 'lucide-react'
import { connectGoogleCalendar, disconnectGoogleCalendar, syncGoogleCalendar } from '@/app/actions'
import { Button } from '@/components/ui/button'

const ACCOUNT = 'razoch@gmail.com'

export function CalendarControls({ connected }: { connected: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function run(action: 'connect' | 'sync' | 'disconnect') {
    setMessage(null)
    setPendingAction(action)
    startTransition(async () => {
      if (action === 'connect') {
        const result = await connectGoogleCalendar()
        setMessage(result.ok ? `Conectado como ${ACCOUNT}.` : result.error)
      } else if (action === 'disconnect') {
        await disconnectGoogleCalendar()
        setMessage('Google Calendar desconectado.')
      } else {
        const result = await syncGoogleCalendar()
        setMessage(
          result.ok
            ? result.synced
              ? `Sincronizado: ${result.synced} citas enviadas a Google Calendar.`
              : 'Todo al día con Google Calendar.'
            : result.error,
        )
      }
      setPendingAction(null)
      router.refresh()
    })
  }

  const spinner = <Loader2 className="size-4 animate-spin" aria-hidden="true" />

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-sm font-medium text-success">
            <CalendarCheck2 className="size-4" aria-hidden="true" />
            {ACCOUNT}
          </span>
          <Button size="sm" variant="outline" onClick={() => run('sync')} disabled={isPending}>
            {pendingAction === 'sync' ? spinner : <RefreshCw className="size-4" aria-hidden="true" />}
            {pendingAction === 'sync' ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run('disconnect')}
            disabled={isPending}
            aria-label="Desconectar Google Calendar"
          >
            {pendingAction === 'disconnect' ? spinner : <Unplug className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => run('connect')} disabled={isPending}>
          {pendingAction === 'connect' ? spinner : <CalendarSync className="size-4" aria-hidden="true" />}
          {pendingAction === 'connect' ? 'Conectando…' : 'Conectar Google Calendar'}
        </Button>
      )}
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {message ?? ''}
      </p>
    </div>
  )
}
