'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, CalendarSync, Loader2, RefreshCw } from 'lucide-react'
import { connectGoogleCalendar, syncGoogleCalendar } from '@/app/actions'
import { Button } from '@/components/ui/button'

function summarize(result: { imported: number; updated: number; cancelled: number; skipped: number }) {
  const parts = [
    result.imported && `${result.imported} nuevas`,
    result.updated && `${result.updated} actualizadas`,
    result.cancelled && `${result.cancelled} canceladas`,
    result.skipped && `${result.skipped} sin WhatsApp u omitidas`,
  ].filter(Boolean)
  return parts.length ? `Sincronizado: ${parts.join(', ')}.` : 'Todo al día con Google Calendar.'
}

export function CalendarControls({ connected }: { connected: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [awaitingReturn, setAwaitingReturn] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function handleConnect() {
    setMessage(null)
    startTransition(async () => {
      const result = await connectGoogleCalendar()
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      if (window.self !== window.top) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        setAwaitingReturn(true)
      } else {
        window.location.href = result.url
      }
    })
  }

  function handleSync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncGoogleCalendar()
      if (result.ok) {
        setMessage(summarize(result))
        router.refresh()
      } else {
        setMessage(result.error)
        if (result.needsAuthorization) router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {connected ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-sm font-medium text-success">
            <CalendarCheck2 className="size-4" aria-hidden="true" />
            Google Calendar conectado
          </span>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Sincronizar
          </Button>
        </div>
      ) : awaitingReturn ? (
        <Button size="sm" onClick={() => router.refresh()}>
          <CalendarCheck2 className="size-4" aria-hidden="true" />
          Ya autoricé mi cuenta
        </Button>
      ) : (
        <Button size="sm" onClick={handleConnect} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarSync className="size-4" aria-hidden="true" />
          )}
          Conectar Google Calendar
        </Button>
      )}
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {message ?? (awaitingReturn && !connected ? 'Termina de autorizar en la pestaña nueva y vuelve aquí.' : '')}
      </p>
    </div>
  )
}
