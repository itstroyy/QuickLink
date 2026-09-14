import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (request.nextUrl.pathname === '/admin/login') return response
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  function redirect(path: string) {
    const next = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie))
    return next
  }
  const adminPath = request.nextUrl.pathname.startsWith('/admin')
  if (!user) return redirect(adminPath ? '/admin/login' : '/login')
  if (adminPath) {
    const { data: admin, error } = await supabase.rpc('is_quicklink_admin')
    if (error || admin !== true) return redirect('/login?error=admin-access')
  }
  return response
}
export const config = { matcher: ['/admin/:path*', '/dashboard/:path*'] }
