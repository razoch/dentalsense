import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from './env'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Env vars can take a moment to be provisioned; let the page render its setup notice instead of crashing.
  if (!isSupabaseConfigured) return supabaseResponse

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Must run immediately after createServerClient so the session refresh is not lost.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Login is bypassed for the demo: send visitors straight to the dashboard.
  if (request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  void user
  return supabaseResponse
}
