import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const message = error.message === 'Invalid login credentials' ? 'The email or password is incorrect.' : error.message
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (!data.session) return NextResponse.json({ error: 'No session was created. Confirm this user in Supabase Authentication.' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 })
  }
}
