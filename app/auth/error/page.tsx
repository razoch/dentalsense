import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'

export default function AuthErrorPage() {
  return (
    <AuthShell title="No pudimos verificar tu acceso" description="El enlace expiró o ya fue utilizado. Intenta iniciar sesión de nuevo.">
      <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">
        Volver a iniciar sesión
      </Link>
    </AuthShell>
  )
}
