import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdminSession } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Google redirects here after the admin approves access. This route only
// exchanges the code for tokens and stores them (service-role only, never
// sent to the browser) — it never touches booking data.
export async function GET(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieStore = await cookies()
  const savedState = cookieStore.get('quicklink_google_oauth')?.value
  let oauth: { state?: string; businessId?: string } = {}
  try { oauth = savedState ? JSON.parse(savedState) : {} } catch {}
  const businessId = state && state === oauth.state ? oauth.businessId : undefined
  const homeUrl = new URL(businessId ? `/admin/clients/${businessId}/edit` : '/admin/clients', url.origin)

  function redirect(status: 'connected' | 'error') {
    homeUrl.searchParams.set('calendar', status)
    const response = NextResponse.redirect(homeUrl)
    response.cookies.delete('quicklink_google_oauth')
    return response
  }

  if (!code || !businessId) return redirect('error')

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) return redirect('error')

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      cache: 'no-store',
    })
    if (!tokenResponse.ok) { console.error('[Quicklink calendar] token exchange failed', tokenResponse.status); return redirect('error') }
    const tokens = await tokenResponse.json()
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[Quicklink calendar] token exchange missing refresh_token — the admin may need to revoke prior access and reconnect')
      return redirect('error')
    }

    const admin = createAdminClient()
    if (!admin) return redirect('error')
    const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString()
    const { error } = await admin.from('business_calendar_connections').upsert({
      business_id: businessId, provider: 'google', calendar_id: 'primary',
      access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: expiresAt,
    })
    if (error) { console.error('[Quicklink calendar] failed to store connection', error.message); return redirect('error') }

    return redirect('connected')
  } catch (error) {
    console.error('[Quicklink calendar] callback error', error)
    return redirect('error')
  }
}
