import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell
      title="Revisa tu correo"
      description="Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y después inicia sesión."
    >
      <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">
        Ir a iniciar sesión
      </Link>
    </AuthShell>
  )
}
