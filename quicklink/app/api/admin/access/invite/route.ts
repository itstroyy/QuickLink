import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email'

// Invites (or re-invites) a business owner/manager. Only a platform admin
// can call this. Writing the business_invitations row uses the normal
// authenticated client so RLS ("Admins manage invitations") enforces the
// admin check independently of requireAdminSession; only the Supabase Auth
// link-generation step needs the service-role client.
//
// We deliberately never call auth.admin.inviteUserByEmail here: it sends
// Supabase's own unbrandable template and, on a resend, errors out for
// anyone who already has an (unconfirmed) auth account from a prior invite
// — exactly the case a "resend" button is used for. Instead we generate the
// action link ourselves with generateLink() and deliver it through our own
// branded email, falling back from type 'invite' (brand-new email) to type
// 'magiclink' (already-registered email) as needed.
export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })

  const { businessId, email: rawEmail, role } = await request.json().catch(() => ({}))
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!businessId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'A valid businessId and email are required.' }, { status: 400 })
  const memberRole = role === 'manager' ? 'manager' : 'owner'

  const supabase = await createClient()
  const [{ data: business }, { data: { user: admin_user } }] = await Promise.all([
    supabase.from('businesses').select('id,name').eq('id', businessId).maybeSingle(),
    supabase.auth.getUser(),
  ])
  if (!business) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error: invitationError } = await supabase.from('business_invitations').upsert(
    { business_id: businessId, email, role: memberRole, invited_by: admin_user?.id ?? null, expires_at: expiresAt, accepted_at: null },
    { onConflict: 'business_id,email' },
  )
  if (invitationError) return NextResponse.json({ error: invitationError.message }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: true, emailSent: false, reason: 'Server is not configured to send invite emails (SUPABASE_SECRET_KEY missing) — the invitation is saved and will link automatically once this email signs in.' })

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
  const redirectTo = `${origin}/auth/finish`

  let actionLink: string | null = null
  const inviteAttempt = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo, data: { business_id: businessId, role: memberRole } } })
  if (!inviteAttempt.error && inviteAttempt.data?.properties?.action_link) {
    actionLink = inviteAttempt.data.properties.action_link
  } else {
    // Most likely cause: this email already has a Quicklink auth account
    // (from an earlier invite, possibly expired). Fall back to a magic link,
    // which works for any existing account regardless of confirmation state.
    const magicAttempt = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
    if (!magicAttempt.error && magicAttempt.data?.properties?.action_link) actionLink = magicAttempt.data.properties.action_link
  }

  if (!actionLink) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'The invitation is saved, but a sign-in link could not be generated right now. Try resending in a moment.' })
  }

  const emailResult = await sendInviteEmail({ to: email, businessName: (business as { name: string }).name, acceptUrl: actionLink })
  if (!emailResult.sent) {
    // Email delivery isn't configured or failed — hand the admin the raw
    // link so they can still get the invited person unblocked by hand.
    return NextResponse.json({ ok: true, emailSent: false, reason: emailResult.reason || 'Could not send the invitation email.', acceptUrl: actionLink })
  }
  return NextResponse.json({ ok: true, emailSent: true })
}
