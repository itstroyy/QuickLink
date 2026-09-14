import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { createClient } from '@/lib/supabase/server'

// Revokes one member's access, or cancels a pending invitation. RLS
// ("Admins manage memberships" / "Admins manage invitations") independently
// enforces that only a platform admin can delete these rows.
export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })

  const { businessId, userId, invitationId, newRole } = await request.json().catch(() => ({}))
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
  const supabase = await createClient()

  // Change role is safe as its own tiny branch: it never touches auth, only
  // the role column, and only when a role is actually supplied.
  if (userId && newRole) {
    if (newRole !== 'owner' && newRole !== 'manager') return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    const { error } = await supabase.from('business_members').update({ role: newRole }).eq('business_id', businessId).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (invitationId) {
    const { error } = await supabase.from('business_invitations').delete().eq('id', invitationId).eq('business_id', businessId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (userId) {
    const { error } = await supabase.from('business_members').delete().eq('business_id', businessId).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Provide userId or invitationId' }, { status: 400 })
}
