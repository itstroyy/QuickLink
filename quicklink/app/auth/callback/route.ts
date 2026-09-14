import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL('/auth/finish', url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=expired-link', url.origin))
}
