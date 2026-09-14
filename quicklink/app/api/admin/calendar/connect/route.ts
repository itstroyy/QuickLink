import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'

// Starts the Google OAuth flow for one business's calendar connection.
// Calendar is entirely optional — nothing here runs unless an admin clicks
// "Connect Google Calendar" for a specific business.
export async function GET(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })

  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (!clientId || !redirectUri) return NextResponse.json({ error: 'Google Calendar is not configured (missing GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI).' }, { status: 500 })

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',
    state,
  })
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  response.cookies.set('quicklink_google_oauth', JSON.stringify({ state, businessId }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/api/admin/calendar',
    maxAge: 10 * 60,
  })
  return response
}
