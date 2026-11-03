'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

function loginErrorMessage(error: unknown) {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'email_not_confirmed') return 'Confirma tu correo: revisa tu bandeja de entrada.'
  if (code === 'over_request_rate_limit' || status === 429) return 'Demasiados intentos. Espera un momento.'
  if (code === 'invalid_credentials') return 'Correo o contraseña incorrectos.'
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setIsLoading(true)
    setError(null)
    const { error } = await createClient().auth.signInWithPassword({
      email: String(data.get('email')),
      password: String(data.get('password')),
    })
    if (error) {
      setError(loginErrorMessage(error))
      setIsLoading(false)
      return
    }
    router.replace('/')
    router.refresh()
  }

  return (
    <AuthShell title="Iniciar sesión" description="Accede al panel de recordatorios del consultorio.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Entrando…' : 'Entrar'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
