import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSupabaseError } from '@/lib/supabase/config'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      logSupabaseError('admin-login', error, { emailDomain: email.includes('@') ? email.split('@').pop() : 'invalid' })
      const message = error.message === 'Invalid login credentials' ? 'The email or password is incorrect.' : error.message
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (!data.session) return NextResponse.json({ error: 'No session was created. Confirm this user in Supabase Authentication.' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Quicklink/Auth:login-route] Sign-in request failed', error)
    return NextResponse.json({ error: 'Unable to sign in because the server is not configured correctly. Check the Vercel function logs.' }, { status: 500 })
  }
}
