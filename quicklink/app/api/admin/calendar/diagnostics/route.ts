import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'

// Temporary, safe diagnostics for the "Google Calendar is not configured"
// error — reports only whether each var is present and the server's
// working directory, never any secret value. Remove once env issues are
// sorted, or leave in place; it exposes nothing sensitive.
export async function GET() {
  // Local diagnostics are intentionally limited to booleans and safe URLs.
  // In production, keep even this metadata behind the admin session.
  if (process.env.NODE_ENV !== 'development') {
    const session = await requireAdminSession()
    if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  }
  return NextResponse.json({
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || null,
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
    hasGoogleRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI?.trim()),
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI?.trim() || null,
    hasSupabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY?.trim()),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    hasEmailFrom: Boolean(process.env.EMAIL_FROM?.trim()),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || null,
  })
}
