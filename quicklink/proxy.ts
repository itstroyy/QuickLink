import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (request.nextUrl.pathname === '/admin/login') return response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_quicklink_admin')
  // Before the Phase 1 migration exists, preserve the original authenticated
  // admin behavior. Once installed, the database allowlist is authoritative.
  if (!adminError && !isAdmin) {
    return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url))
  }
  return response
}

export const config = { matcher: ['/admin/:path*'] }
