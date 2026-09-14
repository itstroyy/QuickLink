import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  if (token_hash && (type === 'invite' || type === 'magiclink' || type === 'recovery' || type === 'email')) {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash, type })
    if (!error) return NextResponse.redirect(new URL('/auth/finish', url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=expired-link', url.origin))
}
