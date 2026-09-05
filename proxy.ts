import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSupabaseConfig, logSupabaseError } from '@/lib/supabase/config'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (request.nextUrl.pathname === '/admin/login') return response
  const { url, publishableKey } = getServerSupabaseConfig('admin-proxy')
  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') {
    logSupabaseError('admin-proxy-auth', error, { path: request.nextUrl.pathname })
  }

  if (!user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  return response
}

export const config = { matcher: ['/admin/:path*'] }
