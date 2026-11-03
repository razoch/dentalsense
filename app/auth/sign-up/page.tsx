'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

function signUpErrorMessage(error: unknown) {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'weak_password') return 'Elige una contraseña más segura.'
  if (code === 'email_address_invalid') return 'Usa un correo real; los dominios de prueba no se aceptan.'
  if (code === 'email_address_not_authorized') return 'No podemos enviar el correo de confirmación a esa dirección.'
  if (code === 'validation_failed') return 'Revisa los datos ingresados.'
  if (code === 'over_email_send_rate_limit' || status === 429) return 'Demasiados intentos. Espera un momento.'
  return 'No fue posible completar el registro. Intenta de nuevo.'
}

export default function SignUpPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password'))
    if (password !== String(data.get('repeatPassword'))) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setIsLoading(true)
    setError(null)
    const { error } = await createClient().auth.signUp({
      email: String(data.get('email')),
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        data: { full_name: String(data.get('fullName')).trim() },
      },
    })
    if (error) {
      setError(signUpErrorMessage(error))
      setIsLoading(false)
      return
    }
    router.push('/auth/sign-up-success')
  }

  return (
    <AuthShell
      title="Crear cuenta"
      description="La primera cuenta registrada queda como administradora (Dra. Laura). Las siguientes deben ser activadas por ella."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="repeatPassword">Repite la contraseña</Label>
          <Input id="repeatPassword" name="repeatPassword" type="password" autoComplete="new-password" required />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
